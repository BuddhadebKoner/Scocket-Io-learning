import { WebSocketServer } from 'ws';
import { RedisHelper } from '../config/redis.js';

// Sample MCQ questions
const mcqQuestions = [
   {
      id: 1,
      question: "What does HTML stand for?",
      options: ["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink and Text Markup Language"],
      correctAnswer: 0
   },
   {
      id: 2,
      question: "Which of the following is not a JavaScript data type?",
      options: ["String", "Boolean", "Float", "Number"],
      correctAnswer: 2
   },
   {
      id: 3,
      question: "What does CSS stand for?",
      options: ["Computer Style Sheets", "Cascading Style Sheets", "Creative Style Sheets", "Colorful Style Sheets"],
      correctAnswer: 1
   },
   {
      id: 4,
      question: "Which HTTP method is used to retrieve data?",
      options: ["POST", "PUT", "GET", "DELETE"],
      correctAnswer: 2
   },
   {
      id: 5,
      question: "What is the default port for HTTP?",
      options: ["8080", "443", "80", "3000"],
      correctAnswer: 2
   }
];

// Cache questions in Redis on startup
async function cacheQuestions() {
   const cacheKey = 'quiz:questions';
   const cached = await RedisHelper.get(cacheKey);

   if (!cached) {
      console.log('📚 Caching questions in Redis...');
      await RedisHelper.set(cacheKey, mcqQuestions, 3600); // Cache for 1 hour
   }

   return mcqQuestions;
}

// Get questions from cache or fallback to in-memory
async function getQuestions() {
   try {
      const cacheKey = 'quiz:questions';
      const cached = await RedisHelper.get(cacheKey);

      if (cached && Array.isArray(cached) && cached.length > 0) {
         // Validate each question in the cached array
         for (let i = 0; i < cached.length; i++) {
            const q = cached[i];
            if (!q || !q.question || !Array.isArray(q.options) || typeof q.correctAnswer !== 'number') {
               console.error(`❌ Invalid cached question at index ${i}:`, q);
               // Fall back to in-memory questions
               console.log('📚 Using in-memory questions (invalid cached data)');
               return mcqQuestions;
            }
         }
         return cached;
      }

      // Fallback to in-memory questions
      console.log('📚 Using in-memory questions (Redis cache miss)');
      return mcqQuestions;
   } catch (error) {
      console.error('❌ Error getting questions:', error.message);
      // Always fall back to in-memory questions
      console.log('📚 Using in-memory questions (error fallback)');
      return mcqQuestions;
   }
}

// Create a new quiz session object
async function createQuizSession(ws, studentId) {
   const session = {
      ws: ws,
      studentId: studentId,
      currentQuestionIndex: 0,
      answers: [],
      score: 0,
      startTime: new Date(),
      questionTimer: null,
      currentAttempts: 0,
      maxAttempts: 3,
      questionTimeLimit: 10, // 10 seconds per question
      questionStartTime: null,
      hasAnswered: false
   };

   // Cache session data in Redis (excluding ws connection)
   const sessionData = { ...session };
   delete sessionData.ws;
   delete sessionData.questionTimer;

   const cacheKey = `session:${studentId}`;
   await RedisHelper.set(cacheKey, sessionData, 1800); // Cache for 30 minutes

   console.log(`📝 Session created and cached for student: ${studentId}`);
   return session;
}

// Get session from Redis or fallback to in-memory
async function getSessionData(studentId) {
   const cacheKey = `session:${studentId}`;
   const sessionData = await RedisHelper.get(cacheKey);

   if (sessionData) {
      console.log(`📖 Session data loaded from cache for: ${studentId}`);
      return sessionData;
   }

   console.log(`⚠️ No cached session found for: ${studentId}`);
   return null;
}

// Update session in Redis
async function updateSession(session) {
   const sessionData = { ...session };
   delete sessionData.ws;
   delete sessionData.questionTimer;

   const cacheKey = `session:${session.studentId}`;
   await RedisHelper.set(cacheKey, sessionData, 1800);
}

// Remove session from Redis
async function removeSession(studentId) {
   const cacheKey = `session:${studentId}`;
   await RedisHelper.del(cacheKey);
   console.log(`🗑️ Session removed from cache: ${studentId}`);
}

// Send a question to the student
async function sendQuestion(session) {
   const questions = await getQuestions();

   // Validate questions array
   if (!questions || !Array.isArray(questions)) {
      console.error(`❌ Send question error: Invalid questions array:`, questions);
      session.ws.send(JSON.stringify({
         type: 'error',
         message: 'Quiz error: Could not load questions. Please restart the quiz.'
      }));
      return;
   }

   if (session.currentQuestionIndex < questions.length) {
      // Validate current question
      const question = questions[session.currentQuestionIndex];
      if (!question || !question.question || !Array.isArray(question.options)) {
         console.error(`❌ Send question error: Invalid question data at index ${session.currentQuestionIndex}:`, question);
         session.ws.send(JSON.stringify({
            type: 'error',
            message: 'Quiz error: Invalid question data. Please restart the quiz.'
         }));
         return;
      }

      // Reset question state
      session.currentAttempts = 0;
      session.hasAnswered = false;
      session.questionStartTime = new Date();

      const questionData = {
         type: 'question',
         questionNumber: session.currentQuestionIndex + 1,
         totalQuestions: questions.length,
         question: question.question,
         options: question.options,
         timeLimit: session.questionTimeLimit,
         maxAttempts: session.maxAttempts,
         attemptsRemaining: session.maxAttempts
      };

      session.ws.send(JSON.stringify(questionData));
      console.log(`📤 Sent question ${session.currentQuestionIndex + 1} to student ${session.studentId}`);

      // Update session in cache
      await updateSession(session);

      // Start the 10-second timer
      startQuestionTimer(session);
   } else {
      sendResults(session);
   }
}

// Start the question timer
function startQuestionTimer(session) {
   // Clear any existing timer
   if (session.questionTimer) {
      clearTimeout(session.questionTimer);
   }

   // Set timer for auto-skip after 10 seconds
   session.questionTimer = setTimeout(() => {
      if (!session.hasAnswered) {
         console.log(`⏰ Time's up for student ${session.studentId} on question ${session.currentQuestionIndex + 1}`);

         // Send timeout warning
         session.ws.send(JSON.stringify({
            type: 'timeout',
            message: "⏰ Time's up! Moving to next question...",
            timeUp: true
         }));

         // Auto-skip to next question (no answer recorded)
         handleTimeOut(session);
      }
   }, session.questionTimeLimit * 1000);
}

// Handle timeout for a question
async function handleTimeOut(session) {
   const questions = await getQuestions();

   // Validate question index and questions array
   if (!questions || !Array.isArray(questions) || session.currentQuestionIndex >= questions.length) {
      console.error(`❌ Timeout error: Invalid question state: questionIndex=${session.currentQuestionIndex}, questionsLength=${questions?.length}`);
      session.ws.send(JSON.stringify({
         type: 'error',
         message: 'Quiz error: Invalid question state during timeout. Please restart the quiz.'
      }));
      return;
   }

   const currentQuestion = questions[session.currentQuestionIndex];

   // Additional validation for current question
   if (!currentQuestion || typeof currentQuestion.correctAnswer === 'undefined') {
      console.error(`❌ Timeout error: Invalid question data:`, currentQuestion);
      session.ws.send(JSON.stringify({
         type: 'error',
         message: 'Quiz error: Invalid question data during timeout. Please restart the quiz.'
      }));
      return;
   }

   // Record as unanswered (no points)
   session.answers.push({
      questionId: currentQuestion.id,
      selectedAnswer: null,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: false,
      timedOut: true
   });

   console.log(`⏰ Student ${session.studentId} timed out on question ${session.currentQuestionIndex + 1}`);

   // Move to next question
   session.currentQuestionIndex++;
   session.hasAnswered = true;

   // Update session in cache
   await updateSession(session);

   // Send timeout feedback
   const feedback = {
      type: 'feedback',
      isCorrect: false,
      explanation: `⏰ Time's up! Moving to next question...`,
      timedOut: true
   };

   session.ws.send(JSON.stringify(feedback));

   // Send next question after delay
   setTimeout(() => {
      sendQuestion(session);
   }, 3000);
}

// Handle student's answer
function handleAnswer(session, answerIndex) {
   // Check if already answered or timed out
   if (session.hasAnswered) {
      session.ws.send(JSON.stringify({
         type: 'warning',
         message: '⚠️ You have already answered this question!'
      }));
      return;
   }

   // Count this as an attempt (selecting/changing answer)
   session.currentAttempts++;
   const attemptsRemaining = session.maxAttempts - session.currentAttempts;

   console.log(`📝 Student ${session.studentId} selected answer ${answerIndex} on attempt ${session.currentAttempts}`);

   // If this is the final attempt (3rd selection), auto-submit
   if (session.currentAttempts >= session.maxAttempts) {
      session.ws.send(JSON.stringify({
         type: 'warning',
         message: `⚠️ Maximum attempts (${session.maxAttempts}) reached! Auto-submitting your answer...`
      }));

      // Auto-submit the current answer
      setTimeout(() => {
         processAnswer(session, answerIndex);
      }, 2000);
      return;
   }

   // Not the final attempt - allow changing answer
   session.ws.send(JSON.stringify({
      type: 'attempt-warning',
      message: `⚠️ Answer selected! You have ${attemptsRemaining} attempts remaining to change your answer, or click Submit to confirm.`,
      attemptsRemaining: attemptsRemaining,
      currentAnswer: answerIndex
   }));
}

// Handle manual submission (when user clicks Submit button)
function handleSubmit(session, answerIndex) {
   // Check if already answered or timed out
   if (session.hasAnswered) {
      session.ws.send(JSON.stringify({
         type: 'warning',
         message: '⚠️ You have already answered this question!'
      }));
      return;
   }

   // Check if they have selected an answer
   if (session.currentAttempts === 0) {
      session.ws.send(JSON.stringify({
         type: 'warning',
         message: '⚠️ Please select an answer first!'
      }));
      return;
   }

   console.log(`✅ Student ${session.studentId} manually submitted answer ${answerIndex} after ${session.currentAttempts} attempts`);

   // Process the submitted answer immediately
   processAnswer(session, answerIndex);
}

// Process the final answer
async function processAnswer(session, answerIndex) {
   // Clear the timer since question is answered
   if (session.questionTimer) {
      clearTimeout(session.questionTimer);
   }

   session.hasAnswered = true;
   const questions = await getQuestions();

   // Validate question index and questions array
   if (!questions || !Array.isArray(questions) || session.currentQuestionIndex >= questions.length) {
      console.error(`❌ Invalid question state: questionIndex=${session.currentQuestionIndex}, questionsLength=${questions?.length}`);
      session.ws.send(JSON.stringify({
         type: 'error',
         message: 'Quiz error: Invalid question state. Please restart the quiz.'
      }));
      return;
   }

   const currentQuestion = questions[session.currentQuestionIndex];

   // Additional validation for current question
   if (!currentQuestion || typeof currentQuestion.correctAnswer === 'undefined') {
      console.error(`❌ Invalid question data:`, currentQuestion);
      session.ws.send(JSON.stringify({
         type: 'error',
         message: 'Quiz error: Invalid question data. Please restart the quiz.'
      }));
      return;
   }

   const isCorrect = answerIndex === currentQuestion.correctAnswer;

   if (isCorrect) {
      session.score++;
   }

   session.answers.push({
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: isCorrect,
      attempts: session.currentAttempts,
      timeTaken: Math.round((new Date() - session.questionStartTime) / 1000)
   });

   console.log(`📝 Student ${session.studentId} answered question ${session.currentQuestionIndex + 1}: ${isCorrect ? 'Correct' : 'Incorrect'} (${session.currentAttempts} attempts)`);

   session.currentQuestionIndex++;

   // Update session in cache
   await updateSession(session);

   // Send immediate feedback
   const feedback = {
      type: 'feedback',
      isCorrect: isCorrect,
      explanation: `Answer submitted! Moving to next question...`,
      attempts: session.currentAttempts
   };

   session.ws.send(JSON.stringify(feedback));

   // Send next question after delay
   setTimeout(() => {
      sendQuestion(session);
   }, 3000);
}

// Send final results to student
async function sendResults(session) {
   const questions = await getQuestions();
   const endTime = new Date();
   const totalTime = Math.round((endTime - session.startTime) / 1000); // in seconds
   const percentage = Math.round((session.score / questions.length) * 100);

   // Add to leaderboard
   const leaderboardKey = 'quiz:leaderboard';
   const leaderboardEntry = JSON.stringify({
      studentId: session.studentId,
      score: session.score,
      totalQuestions: questions.length,
      percentage: percentage,
      totalTime: totalTime,
      completedAt: endTime.toISOString()
   });

   await RedisHelper.zadd(leaderboardKey, percentage, leaderboardEntry);

   // Update quiz statistics
   await updateQuizStats(session.score, percentage, totalTime);

   // Create detailed answer breakdown
   const answerBreakdown = session.answers.map((answer, index) => {
      const question = questions.find(q => q.id === answer.questionId);
      return {
         questionNumber: index + 1,
         question: question.question,
         options: question.options,
         yourAnswer: answer.selectedAnswer !== null ? question.options[answer.selectedAnswer] : 'No answer (Timed out)',
         correctAnswer: question.options[question.correctAnswer],
         isCorrect: answer.isCorrect,
         attempts: answer.attempts || 0,
         timedOut: answer.timedOut || false,
         maxAttemptsReached: answer.maxAttemptsReached || false,
         timeTaken: answer.timeTaken || 0
      };
   });

   // Get top 5 leaderboard
   const topScores = await getTopScores(5);

   const results = {
      type: 'results',
      score: session.score,
      totalQuestions: questions.length,
      percentage: percentage,
      totalTime: totalTime,
      answers: session.answers, // Keep original for backend reference
      answerBreakdown: answerBreakdown, // Detailed breakdown for frontend
      message: getGradeMessage(percentage),
      leaderboard: topScores,
      summary: {
         correct: session.score,
         incorrect: questions.length - session.score,
         timeouts: session.answers.filter(a => a.timedOut).length,
         maxAttemptsReached: session.answers.filter(a => a.maxAttemptsReached).length
      }
   };

   session.ws.send(JSON.stringify(results));
   console.log(`🎯 Quiz completed for student ${session.studentId}: ${session.score}/${questions.length} (${percentage}%)`);

   // Update session in cache one final time
   await updateSession(session);

   // Close connection after results
   setTimeout(() => {
      session.ws.close();
      console.log(`🔐 Connection closed for student ${session.studentId}`);
   }, 10000); // Give 10 seconds to read detailed results
}

// Get grade message based on percentage
function getGradeMessage(percentage) {
   if (percentage >= 90) return "🏆 Excellent! Outstanding performance!";
   if (percentage >= 80) return "🎉 Great job! Very good score!";
   if (percentage >= 70) return "👍 Good work! Above average!";
   if (percentage >= 60) return "📈 Fair performance. Keep studying!";
   return "📚 Need improvement. Please review the topics.";
}

// Update quiz statistics in Redis
async function updateQuizStats(score, percentage, totalTime) {
   try {
      // Increment counters
      await RedisHelper.incr('quiz:stats:total_attempts');

      if (percentage >= 70) {
         await RedisHelper.incr('quiz:stats:passed');
      }

      // Update average score (simplified)
      const avgKey = 'quiz:stats:average_score';
      const currentAvg = await RedisHelper.get(avgKey) || 0;
      const totalAttempts = await RedisHelper.get('quiz:stats:total_attempts') || 1;
      const newAvg = ((currentAvg * (totalAttempts - 1)) + percentage) / totalAttempts;
      await RedisHelper.set(avgKey, Math.round(newAvg * 100) / 100);

      console.log(`📊 Updated quiz statistics: Score ${score}, Percentage ${percentage}%`);
   } catch (error) {
      console.error('❌ Error updating quiz stats:', error.message);
   }
}

// Get top scores from leaderboard
async function getTopScores(limit = 10) {
   try {
      const leaderboardKey = 'quiz:leaderboard';
      const topEntries = await RedisHelper.zrevrange(leaderboardKey, 0, limit - 1);

      const leaderboard = [];
      for (let i = 0; i < topEntries.length; i++) {
         const entry = topEntries[i];
         try {
            const entryData = JSON.parse(entry.value);
            leaderboard.push({
               rank: i + 1,
               studentId: entryData.studentId.substring(0, 12) + '...', // Anonymize
               score: entryData.score,
               totalQuestions: entryData.totalQuestions,
               percentage: entry.score,
               completedAt: entryData.completedAt
            });
         } catch (parseError) {
            console.error('❌ Error parsing leaderboard entry:', parseError.message);
         }
      }

      return leaderboard;
   } catch (error) {
      console.error('❌ Error getting leaderboard:', error.message);
      return [];
   }
}// Store active quiz sessions (in-memory for WebSocket connections)
const activeSessions = new Map();

export function createWebSocketServer(server) {
   const wss = new WebSocketServer({ server });

   // Cache questions on startup
   cacheQuestions().then(() => {
      console.log('📚 Questions cached successfully');
   }).catch(err => {
      console.error('❌ Error caching questions:', err.message);
   });

   wss.on('connection', async (ws, req) => {
      // Generate a unique student ID
      const studentId = `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`🔗 New student connected: ${studentId}`);
      console.log(`👥 Total active connections: ${wss.clients.size}`);

      // Increment active students counter
      await RedisHelper.incr('quiz:stats:active_students');

      // Create new quiz session
      const session = await createQuizSession(ws, studentId);
      activeSessions.set(studentId, session);

      // Send welcome message
      const welcome = {
         type: 'welcome',
         message: 'Welcome to the MCQ Quiz!',
         studentId: studentId,
         totalQuestions: (await getQuestions()).length,
         redisConnected: RedisHelper.isConnected(),
         instructions: [
            'You will receive 5 multiple choice questions',
            'Each question has 10 seconds time limit',
            'You can change your answer up to 3 times',
            'Click Submit to confirm your answer early',
            'Results will be shown at the end'
         ]
      };

      ws.send(JSON.stringify(welcome));

      // Start quiz after 3 seconds
      setTimeout(() => {
         sendQuestion(session);
      }, 3000);

      // Handle incoming messages
      ws.on('message', (data) => {
         try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Received from ${studentId}:`, message);

            switch (message.type) {
               case 'answer':
                  // This is for selecting/changing an answer (counts as attempt)
                  if (session && typeof message.answerIndex === 'number') {
                     handleAnswer(session, message.answerIndex);
                  }
                  break;

               case 'submit':
                  // This is for manually submitting the selected answer
                  if (session && typeof message.answerIndex === 'number') {
                     handleSubmit(session, message.answerIndex);
                  }
                  break;

               case 'ping':
                  ws.send(JSON.stringify({
                     type: 'pong',
                     redisConnected: RedisHelper.isConnected(),
                     timestamp: new Date().toISOString()
                  }));
                  break;

               default:
                  console.log(`❓ Unknown message type: ${message.type}`);
            }
         } catch (error) {
            console.error(`❌ Error parsing message from ${studentId}:`, error.message);
            ws.send(JSON.stringify({
               type: 'error',
               message: 'Invalid message format. Please send valid JSON.'
            }));
         }
      });

      // Handle connection close
      ws.on('close', async () => {
         // Clean up timer
         if (session.questionTimer) {
            clearTimeout(session.questionTimer);
         }

         // Remove from in-memory sessions
         activeSessions.delete(studentId);

         // Remove from Redis cache
         await removeSession(studentId);

         // Decrement active students counter
         const current = await RedisHelper.get('quiz:stats:active_students') || 1;
         if (current > 0) {
            await RedisHelper.set('quiz:stats:active_students', current - 1);
         }

         console.log(`🔌 Student disconnected: ${studentId}`);
         console.log(`👥 Remaining active connections: ${wss.clients.size - 1}`);
      });

      // Handle errors
      ws.on('error', async (error) => {
         console.error(`❌ WebSocket error for ${studentId}:`, error.message);
         // Clean up timer
         if (session.questionTimer) {
            clearTimeout(session.questionTimer);
         }
         activeSessions.delete(studentId);
         await removeSession(studentId);
      });
   });

   console.log('🚀 WebSocket server initialized with Redis support');
   return wss;
}

// Get quiz statistics
export async function getQuizStats() {
   try {
      const questions = await getQuestions();
      const activeStudents = await RedisHelper.get('quiz:stats:active_students') || 0;
      const totalAttempts = await RedisHelper.get('quiz:stats:total_attempts') || 0;
      const passed = await RedisHelper.get('quiz:stats:passed') || 0;
      const averageScore = await RedisHelper.get('quiz:stats:average_score') || 0;
      const topScores = await getTopScores(5);

      return {
         activeStudents: Math.max(activeSessions.size, activeStudents), // Use max of in-memory and Redis
         totalQuestions: questions.length,
         activeSessions: Array.from(activeSessions.keys()),
         redisConnected: RedisHelper.isConnected(),
         statistics: {
            totalAttempts: totalAttempts,
            passed: passed,
            passRate: totalAttempts > 0 ? Math.round((passed / totalAttempts) * 100) : 0,
            averageScore: averageScore
         },
         leaderboard: topScores,
         cacheInfo: {
            questionsFromCache: await RedisHelper.exists('quiz:questions'),
            sessionsCached: activeSessions.size
         }
      };
   } catch (error) {
      console.error('❌ Error getting quiz stats:', error.message);
      // Fallback to basic stats
      return {
         activeStudents: activeSessions.size,
         totalQuestions: (await getQuestions()).length,
         activeSessions: Array.from(activeSessions.keys()),
         redisConnected: false,
         error: 'Redis unavailable - using fallback data'
      };
   }
}