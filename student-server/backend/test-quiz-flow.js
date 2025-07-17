// Simple WebSocket test client for the quiz system
const WebSocket = require('ws');

const WEBSOCKET_URL = 'ws://localhost:3000';

function testQuizFlow() {
   console.log('🧪 Testing Quiz Flow with Redis...\n');

   const ws = new WebSocket(WEBSOCKET_URL);

   ws.on('open', () => {
      console.log('✅ Connected to quiz server');
   });

   ws.on('message', (data) => {
      try {
         const message = JSON.parse(data.toString());
         console.log('📨 Received:', message.type);

         switch (message.type) {
            case 'welcome':
               console.log(`👋 Welcome! Student ID: ${message.studentId}`);
               console.log(`📚 Total Questions: ${message.totalQuestions}`);
               console.log(`⚡ Redis Connected: ${message.redisConnected ? '✅' : '❌'}`);
               break;

            case 'question':
               console.log(`\n❓ Question ${message.questionNumber}/${message.totalQuestions}:`);
               console.log(`   ${message.question}`);
               message.options.forEach((option, index) => {
                  console.log(`   ${String.fromCharCode(65 + index)}. ${option}`);
               });
               console.log(`⏱️  Time limit: ${message.timeLimit}s`);
               console.log(`🔄 Max attempts: ${message.maxAttempts}`);

               // Auto-answer after 2 seconds (pick random answer)
               setTimeout(() => {
                  const randomAnswer = Math.floor(Math.random() * message.options.length);
                  console.log(`🤖 Auto-selecting answer: ${String.fromCharCode(65 + randomAnswer)}`);

                  ws.send(JSON.stringify({
                     type: 'answer',
                     answerIndex: randomAnswer
                  }));

                  // Submit after 1 second
                  setTimeout(() => {
                     console.log('📤 Submitting answer...');
                     ws.send(JSON.stringify({
                        type: 'submit',
                        answerIndex: randomAnswer
                     }));
                  }, 1000);
               }, 2000);
               break;

            case 'feedback':
               console.log(`💬 Feedback: ${message.explanation}`);
               if (message.timedOut) {
                  console.log('⏰ Timed out!');
               }
               break;

            case 'results':
               console.log('\n🎯 Final Results:');
               console.log(`   Score: ${message.score}/${message.totalQuestions} (${message.percentage}%)`);
               console.log(`   Time: ${message.totalTime} seconds`);
               console.log(`   Message: ${message.message}`);

               if (message.leaderboard && message.leaderboard.length > 0) {
                  console.log('\n🏆 Top 5 Leaderboard:');
                  message.leaderboard.slice(0, 5).forEach(entry => {
                     console.log(`   ${entry.rank}. ${entry.studentId} - ${entry.percentage}% (${entry.score}/${entry.totalQuestions})`);
                  });
               }

               console.log('\n✅ Quiz completed successfully!');
               console.log('🔌 Closing connection...');
               ws.close();
               break;

            case 'attempt-warning':
               console.log(`⚠️  ${message.message}`);
               break;

            case 'warning':
               console.log(`⚠️  ${message.message}`);
               break;

            case 'timeout':
               console.log(`⏰ ${message.message}`);
               break;

            case 'pong':
               console.log('🏓 Pong received - Redis:', message.redisConnected ? '✅' : '❌');
               break;

            default:
               console.log(`❓ Unknown message type: ${message.type}`);
         }
      } catch (error) {
         console.error('❌ Error parsing message:', error.message);
      }
   });

   ws.on('close', () => {
      console.log('🔌 Connection closed');
   });

   ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
   });

   // Send a ping every 30 seconds to test connection
   setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify({ type: 'ping' }));
      }
   }, 30000);
}

// Test API endpoints
async function testAPIEndpoints() {
   console.log('\n🔍 Testing API Endpoints...\n');

   const endpoints = [
      'http://localhost:3000/health',
      'http://localhost:3000/api/quiz-stats',
      'http://localhost:3000/api/quiz/stats',
      'http://localhost:3000/api/quiz/leaderboard',
      'http://localhost:3000/api/websocket-info'
   ];

   for (const endpoint of endpoints) {
      try {
         const response = await fetch(endpoint);
         const data = await response.json();
         console.log(`✅ ${endpoint}:`, response.status);
         if (endpoint.includes('leaderboard')) {
            console.log(`   📊 Leaderboard entries: ${data.data?.leaderboard?.length || 0}`);
         }
         if (endpoint.includes('stats')) {
            console.log(`   👥 Active students: ${data.data?.activeStudents || 0}`);
            console.log(`   ⚡ Redis connected: ${data.data?.redisConnected ? '✅' : '❌'}`);
         }
      } catch (error) {
         console.log(`❌ ${endpoint}:`, error.message);
      }
   }
}

// Run tests
console.log('🚀 Starting Quiz System Tests...\n');

// Test API endpoints first
testAPIEndpoints().then(() => {
   console.log('\n' + '='.repeat(50));
   // Then test WebSocket flow
   setTimeout(testQuizFlow, 2000);
});
