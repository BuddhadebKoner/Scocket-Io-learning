import { WebSocketServer } from 'ws';

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

// Create a new quiz session object
function createQuizSession(ws, studentId) {
   return {
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
}

// Send a question to the student
function sendQuestion(session) {
   if (session.currentQuestionIndex < mcqQuestions.length) {
      // Reset question state
      session.currentAttempts = 0;
      session.hasAnswered = false;
      session.questionStartTime = new Date();

      const question = mcqQuestions[session.currentQuestionIndex];
      const questionData = {
         type: 'question',
         questionNumber: session.currentQuestionIndex + 1,
         totalQuestions: mcqQuestions.length,
         question: question.question,
         options: question.options,
         timeLimit: session.questionTimeLimit,
         maxAttempts: session.maxAttempts,
         attemptsRemaining: session.maxAttempts
      };

      session.ws.send(JSON.stringify(questionData));
      console.log(`📤 Sent question ${session.currentQuestionIndex + 1} to student ${session.studentId}`);

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
function handleTimeOut(session) {
   const currentQuestion = mcqQuestions[session.currentQuestionIndex];

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
function processAnswer(session, answerIndex) {
   // Clear the timer since question is answered
   if (session.questionTimer) {
      clearTimeout(session.questionTimer);
   }

   session.hasAnswered = true;
   const currentQuestion = mcqQuestions[session.currentQuestionIndex];
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

   // Send immediate feedback
   const feedback = {
      type: 'feedback',
      isCorrect: isCorrect,
      explanation: `Answer submitted! Moving to next question...`,
      attempts: session.currentAttempts
   };

   session.ws.send(JSON.stringify(feedback));

   session.currentQuestionIndex++;

   // Send next question after delay
   setTimeout(() => {
      sendQuestion(session);
   }, 3000);
}

// Force move to next question when max attempts reached
function forceNextQuestion(session, lastAnswer) {
   // Clear the timer
   if (session.questionTimer) {
      clearTimeout(session.questionTimer);
   }

   session.hasAnswered = true;
   const currentQuestion = mcqQuestions[session.currentQuestionIndex];
   const isCorrect = lastAnswer === currentQuestion.correctAnswer;

   if (isCorrect) {
      session.score++;
   }

   session.answers.push({
      questionId: currentQuestion.id,
      selectedAnswer: lastAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: isCorrect,
      attempts: session.currentAttempts,
      maxAttemptsReached: true,
      timeTaken: Math.round((new Date() - session.questionStartTime) / 1000)
   });

   console.log(`🚫 Student ${session.studentId} reached max attempts on question ${session.currentQuestionIndex + 1}`);

   // Send feedback
   const feedback = {
      type: 'feedback',
      isCorrect: isCorrect,
      explanation: `Max attempts reached! Moving to next question...`,
      maxAttemptsReached: true
   };

   session.ws.send(JSON.stringify(feedback));

   session.currentQuestionIndex++;

   // Send next question after delay
   setTimeout(() => {
      sendQuestion(session);
   }, 3000);
}

// Send final results to student
function sendResults(session) {
   const endTime = new Date();
   const totalTime = Math.round((endTime - session.startTime) / 1000); // in seconds
   const percentage = Math.round((session.score / mcqQuestions.length) * 100);

   // Create detailed answer breakdown
   const answerBreakdown = session.answers.map((answer, index) => {
      const question = mcqQuestions.find(q => q.id === answer.questionId);
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

   const results = {
      type: 'results',
      score: session.score,
      totalQuestions: mcqQuestions.length,
      percentage: percentage,
      totalTime: totalTime,
      answers: session.answers, // Keep original for backend reference
      answerBreakdown: answerBreakdown, // Detailed breakdown for frontend
      message: getGradeMessage(percentage),
      summary: {
         correct: session.score,
         incorrect: mcqQuestions.length - session.score,
         timeouts: session.answers.filter(a => a.timedOut).length,
         maxAttemptsReached: session.answers.filter(a => a.maxAttemptsReached).length
      }
   };

   session.ws.send(JSON.stringify(results));
   console.log(`🎯 Quiz completed for student ${session.studentId}: ${session.score}/${mcqQuestions.length} (${percentage}%)`);

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
}// Store active quiz sessions
const activeSessions = new Map();

export function createWebSocketServer(server) {
   const wss = new WebSocketServer({ server });

   wss.on('connection', (ws, req) => {
      // Generate a unique student ID
      const studentId = `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`🔗 New student connected: ${studentId}`);
      console.log(`👥 Total active connections: ${wss.clients.size}`);

      // Create new quiz session
      const session = createQuizSession(ws, studentId);
      activeSessions.set(studentId, session);

      // Send welcome message
      const welcome = {
         type: 'welcome',
         message: 'Welcome to the MCQ Quiz!',
         studentId: studentId,
         totalQuestions: mcqQuestions.length,
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
                  ws.send(JSON.stringify({ type: 'pong' }));
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
      ws.on('close', () => {
         // Clean up timer
         if (session.questionTimer) {
            clearTimeout(session.questionTimer);
         }
         activeSessions.delete(studentId);
         console.log(`🔌 Student disconnected: ${studentId}`);
         console.log(`👥 Remaining active connections: ${wss.clients.size - 1}`);
      });

      // Handle errors
      ws.on('error', (error) => {
         console.error(`❌ WebSocket error for ${studentId}:`, error.message);
         // Clean up timer
         if (session.questionTimer) {
            clearTimeout(session.questionTimer);
         }
         activeSessions.delete(studentId);
      });
   });

   console.log('🚀 WebSocket server initialized');
   return wss;
}

// Get quiz statistics
export function getQuizStats() {
   return {
      activeStudents: activeSessions.size,
      totalQuestions: mcqQuestions.length,
      activeSessions: Array.from(activeSessions.keys())
   };
}