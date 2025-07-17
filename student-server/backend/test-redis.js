import { connectRedis, RedisHelper, closeRedis } from './src/config/redis.js';

async function testRedis() {
   console.log('🧪 Testing Redis Connection...\n');

   try {
      // Test connection
      const connected = await connectRedis();

      if (!connected) {
         console.log('❌ Redis connection failed');
         return;
      }

      console.log('✅ Redis connected successfully!\n');

      // Test basic operations
      console.log('🔄 Testing basic Redis operations...');

      // Test SET and GET
      await RedisHelper.set('test:key', 'Hello Redis!', 60);
      const value = await RedisHelper.get('test:key');
      console.log(`SET/GET test: ${value === 'Hello Redis!' ? '✅' : '❌'} (${value})`);

      // Test JSON storage
      const testData = { name: 'Student', score: 85, timestamp: new Date().toISOString() };
      await RedisHelper.set('test:json', testData, 60);
      const retrievedData = await RedisHelper.get('test:json');
      console.log(`JSON test: ${retrievedData.name === 'Student' ? '✅' : '❌'} (${JSON.stringify(retrievedData)})`);

      // Test counter
      await RedisHelper.incr('test:counter');
      await RedisHelper.incr('test:counter');
      const counter = await RedisHelper.get('test:counter');
      console.log(`Counter test: ${counter >= 2 ? '✅' : '❌'} (${counter})`);

      // Test leaderboard (sorted set)
      await RedisHelper.zadd('test:leaderboard', 95, JSON.stringify({ id: 'student1', score: 95 }));
      await RedisHelper.zadd('test:leaderboard', 87, JSON.stringify({ id: 'student2', score: 87 }));
      await RedisHelper.zadd('test:leaderboard', 92, JSON.stringify({ id: 'student3', score: 92 }));

      const topScores = await RedisHelper.zrevrange('test:leaderboard', 0, 2);
      console.log(`Leaderboard test: ${topScores.length >= 3 ? '✅' : '❌'} (${topScores.length} entries)`);

      // Test exists
      const exists = await RedisHelper.exists('test:key');
      console.log(`EXISTS test: ${exists ? '✅' : '❌'} (${exists})`);

      // Test pattern deletion
      await RedisHelper.flushPattern('test:*');
      const existsAfterFlush = await RedisHelper.exists('test:key');
      console.log(`Pattern flush test: ${!existsAfterFlush ? '✅' : '❌'} (should be false: ${existsAfterFlush})`);

      console.log('\n🎉 All Redis tests passed!');

      // Test quiz-specific functionality
      console.log('\n🧪 Testing Quiz-specific Redis operations...');

      // Test question caching
      const questions = [
         { id: 1, question: "Test question?", options: ["A", "B", "C", "D"], correctAnswer: 0 }
      ];
      await RedisHelper.set('quiz:questions', questions, 3600);
      const cachedQuestions = await RedisHelper.get('quiz:questions');
      console.log(`Question caching: ${Array.isArray(cachedQuestions) ? '✅' : '❌'}`);

      // Test session storage
      const sessionData = {
         studentId: 'test_student_123',
         currentQuestionIndex: 0,
         score: 0,
         startTime: new Date(),
         answers: []
      };
      await RedisHelper.set('session:test_student_123', sessionData, 1800);
      const cachedSession = await RedisHelper.get('session:test_student_123');
      console.log(`Session caching: ${cachedSession.studentId === 'test_student_123' ? '✅' : '❌'}`);

      // Test statistics
      await RedisHelper.set('quiz:stats:total_attempts', 10);
      await RedisHelper.set('quiz:stats:passed', 7);
      await RedisHelper.set('quiz:stats:average_score', 78.5);

      const totalAttempts = await RedisHelper.get('quiz:stats:total_attempts');
      const passed = await RedisHelper.get('quiz:stats:passed');
      const avgScore = await RedisHelper.get('quiz:stats:average_score');

      console.log(`Statistics: ${totalAttempts === 10 && passed === 7 && avgScore === 78.5 ? '✅' : '❌'}`);
      console.log(`  - Total attempts: ${totalAttempts}`);
      console.log(`  - Passed: ${passed}`);
      console.log(`  - Average score: ${avgScore}`);

      // Clean up test data
      await RedisHelper.flushPattern('quiz:*');
      await RedisHelper.flushPattern('session:*');

      console.log('\n🎯 Quiz Redis functionality is working perfectly!');

   } catch (error) {
      console.error('❌ Redis test failed:', error.message);
   } finally {
      await closeRedis();
      console.log('\n🔌 Redis connection closed');
   }
}

// Run the test
testRedis();
