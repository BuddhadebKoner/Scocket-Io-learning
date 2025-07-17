import express from 'express';
import { getQuizStats } from '../controllers/controller.js';
import { RedisHelper } from '../config/redis.js';
import { getRedisUsage, getRedisRealTimeStats } from '../controllers/redis-monitor.js';

const router = express.Router();

// Get current quiz statistics
router.get('/stats', async (req, res) => {
   try {
      const stats = await getQuizStats();
      res.json({
         success: true,
         data: stats,
         timestamp: new Date().toISOString()
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: 'Failed to get quiz statistics',
         error: error.message
      });
   }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
   try {
      const limit = parseInt(req.query.limit) || 10;
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

      res.json({
         success: true,
         data: {
            leaderboard: leaderboard,
            total: leaderboard.length,
            redisConnected: RedisHelper.isConnected()
         },
         timestamp: new Date().toISOString()
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: 'Failed to get leaderboard',
         error: error.message
      });
   }
});

// Reset quiz data (for testing)
router.post('/reset', async (req, res) => {
   try {
      // Clear Redis data
      await RedisHelper.flushPattern('quiz:*');

      res.json({
         success: true,
         message: 'Quiz data reset successfully',
         timestamp: new Date().toISOString()
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: 'Failed to reset quiz data',
         error: error.message
      });
   }
});

// Redis monitoring endpoints
router.get('/redis/usage', async (req, res) => {
   try {
      const usage = await getRedisUsage();
      res.json({
         success: true,
         data: usage,
         timestamp: new Date().toISOString()
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: 'Failed to get Redis usage',
         error: error.message
      });
   }
});

router.get('/redis/realtime', async (req, res) => {
   try {
      const stats = await getRedisRealTimeStats();
      res.json({
         success: true,
         data: stats,
         timestamp: new Date().toISOString()
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: 'Failed to get Redis real-time stats',
         error: error.message
      });
   }
});

router.get('/redis/keys', async (req, res) => {
   try {
      const keyInfo = {
         questions: {
            key: 'quiz:questions',
            exists: await RedisHelper.exists('quiz:questions'),
            data: await RedisHelper.get('quiz:questions')
         },
         statistics: {
            totalAttempts: await RedisHelper.get('quiz:stats:total_attempts'),
            passed: await RedisHelper.get('quiz:stats:passed'),
            averageScore: await RedisHelper.get('quiz:stats:average_score'),
            activeStudents: await RedisHelper.get('quiz:stats:active_students')
         },
         leaderboard: {
            key: 'quiz:leaderboard',
            size: (await RedisHelper.zrevrange('quiz:leaderboard', 0, -1)).length,
            topEntries: await RedisHelper.zrevrange('quiz:leaderboard', 0, 4)
         }
      };

      res.json({
         success: true,
         data: keyInfo,
         redisConnected: RedisHelper.isConnected(),
         timestamp: new Date().toISOString()
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: 'Failed to get Redis keys info',
         error: error.message
      });
   }
});

// Get WebSocket connection information
router.get('/connection-info', (req, res) => {
   const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
   const protocol = req.secure ? 'wss' : 'ws';

   res.json({
      success: true,
      websocketUrl: `${protocol}://${host}`,
      message: 'Use this URL to connect via WebSocket',
      messageFormats: {
         answer: {
            description: 'Send your answer (0-3 for option index)',
            example: { type: 'answer', answerIndex: 0 }
         },
         ping: {
            description: 'Test connection',
            example: { type: 'ping' }
         }
      },
      instructions: [
         '1. Connect to the WebSocket URL',
         '2. Wait for welcome message and first question',
         '3. Answer questions by sending answer messages',
         '4. Receive feedback and next question',
         '5. Get final results after all 5 questions'
      ]
   });
});

export default router;