import WebSocket from 'ws';

console.log('🧪 Starting Redis Visualization Test...\n');

// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3000');

let questionCount = 0;
const maxQuestions = 5;

ws.on('open', function open() {
   console.log('✅ Connected to quiz server');
});

ws.on('message', function message(data) {
   const msg = JSON.parse(data.toString());
   console.log(`📨 Received: ${msg.type}`);

   switch (msg.type) {
      case 'welcome':
         console.log(`🎉 Welcome! Student ID: ${msg.studentId}`);
         console.log(`📚 Redis Connected: ${msg.redisConnected ? '✅' : '❌'}`);
         break;

      case 'question':
         questionCount++;
         console.log(`❓ Question ${questionCount}/${maxQuestions}: ${msg.question}`);
         console.log(`⏱️  Time limit: ${msg.timeLimit}s`);

         // Answer randomly after 2 seconds
         setTimeout(() => {
            const answer = Math.floor(Math.random() * msg.options.length);
            console.log(`📝 Answering: ${answer} (${msg.options[answer]})`);

            ws.send(JSON.stringify({
               type: 'answer',
               answerIndex: answer
            }));

            // Submit after another second
            setTimeout(() => {
               console.log(`✅ Submitting answer: ${answer}`);
               ws.send(JSON.stringify({
                  type: 'submit',
                  answerIndex: answer
               }));
            }, 1000);
         }, 2000);
         break;

      case 'feedback':
         console.log(`💭 Feedback: ${msg.isCorrect ? '✅ Correct!' : '❌ Incorrect'}`);
         break;

      case 'results':
         console.log(`\n🎯 QUIZ COMPLETED!`);
         console.log(`📊 Score: ${msg.score}/${msg.totalQuestions} (${msg.percentage}%)`);
         console.log(`⏱️  Total time: ${msg.totalTime}s`);
         console.log(`💬 Message: ${msg.message}`);

         if (msg.leaderboard && msg.leaderboard.length > 0) {
            console.log(`\n🏆 LEADERBOARD (Top ${msg.leaderboard.length}):`);
            msg.leaderboard.forEach((entry, index) => {
               const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
               console.log(`   ${medal} #${entry.rank}: ${entry.studentId} - ${entry.percentage}%`);
            });
         }

         console.log('\n📈 SUMMARY:');
         console.log(`   ✅ Correct: ${msg.summary.correct}`);
         console.log(`   ❌ Incorrect: ${msg.summary.incorrect}`);
         console.log(`   ⏰ Timeouts: ${msg.summary.timeouts}`);

         ws.close();
         break;

      case 'error':
         console.error(`❌ Error: ${msg.message}`);
         break;

      default:
         console.log(`ℹ️  Other message: ${msg.type}`);
   }
});

ws.on('close', function close() {
   console.log('\n🔌 Disconnected from quiz server');
   console.log('🎯 Test completed! Check your Redis monitor to see the data!');
   process.exit(0);
});

ws.on('error', function error(err) {
   console.error('❌ WebSocket error:', err.message);
   process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
   console.log('\n🛑 Test interrupted by user');
   ws.close();
   process.exit(0);
});
