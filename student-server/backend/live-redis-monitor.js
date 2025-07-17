import { connectRedis, RedisHelper, closeRedis } from './src/config/redis.js';

async function liveMonitorRedis() {
   console.log('🔍 Starting Redis Live Monitor...\n');

   try {
      await connectRedis();

      console.log('📊 Real-time Redis Usage Monitoring');
      console.log('Press Ctrl+C to stop monitoring\n');

      // Monitor every 2 seconds
      const intervalId = setInterval(async () => {
         try {
            console.clear();
            console.log('🔍 Redis Live Monitor - ' + new Date().toLocaleTimeString());
            console.log('='.repeat(60));

            // Connection status
            const connected = RedisHelper.isConnected();
            console.log(`🔗 Connection: ${connected ? '✅ Connected' : '❌ Disconnected'}`);

            if (connected) {
               // Questions cache
               const questionsExist = await RedisHelper.exists('quiz:questions');
               console.log(`📚 Questions Cached: ${questionsExist ? '✅ Yes' : '❌ No'}`);

               // Statistics
               const totalAttempts = await RedisHelper.get('quiz:stats:total_attempts') || 0;
               const passed = await RedisHelper.get('quiz:stats:passed') || 0;
               const avgScore = await RedisHelper.get('quiz:stats:average_score') || 0;
               const activeStudents = await RedisHelper.get('quiz:stats:active_students') || 0;

               console.log('\n📈 Quiz Statistics:');
               console.log(`   Total Attempts: ${totalAttempts}`);
               console.log(`   Passed: ${passed}`);
               console.log(`   Pass Rate: ${totalAttempts > 0 ? Math.round((passed / totalAttempts) * 100) : 0}%`);
               console.log(`   Average Score: ${avgScore}`);
               console.log(`   Active Students: ${activeStudents}`);

               // Leaderboard
               const leaderboard = await RedisHelper.zrevrange('quiz:leaderboard', 0, 4);
               console.log('\n🏆 Top 5 Leaderboard:');
               if (leaderboard.length > 0) {
                  for (let i = 0; i < leaderboard.length; i++) {
                     try {
                        const entry = JSON.parse(leaderboard[i].value);
                        const rank = i + 1;
                        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
                        console.log(`   ${medal} #${rank}: ${entry.studentId.substring(0, 12)}... - ${leaderboard[i].score}%`);
                     } catch (e) {
                        console.log(`   #${i + 1}: Parse error`);
                     }
                  }
               } else {
                  console.log('   No entries yet');
               }

               // Key distribution
               console.log('\n🔑 Redis Keys Status:');
               console.log(`   quiz:questions: ${questionsExist ? '✅' : '❌'}`);
               console.log(`   quiz:leaderboard: ${leaderboard.length > 0 ? `✅ (${leaderboard.length} entries)` : '❌'}`);
               console.log(`   quiz:stats:*: ✅ (${Object.keys({ totalAttempts, passed, avgScore, activeStudents }).length} keys)`);

               // Memory estimation
               const estimatedMemory = (
                  (questionsExist ? 5 : 0) + // Questions ~5KB
                  (leaderboard.length * 0.5) + // Leaderboard entries ~0.5KB each
                  (activeStudents * 2) + // Sessions ~2KB each
                  1 // Stats ~1KB
               );
               console.log(`\n💾 Estimated Memory Usage: ~${estimatedMemory.toFixed(1)}KB`);
            }

            console.log('\n' + '='.repeat(60));
            console.log('Press Ctrl+C to stop monitoring');

         } catch (error) {
            console.error('❌ Monitor error:', error.message);
         }
      }, 2000);

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
         console.log('\n\n🛑 Stopping monitor...');
         clearInterval(intervalId);
         await closeRedis();
         console.log('✅ Redis monitor stopped');
         process.exit(0);
      });

   } catch (error) {
      console.error('❌ Failed to start Redis monitor:', error.message);
      process.exit(1);
   }
}

// Start monitoring
liveMonitorRedis();
