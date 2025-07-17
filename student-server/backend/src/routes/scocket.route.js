import express from 'express';
import { getQuizStats } from '../controllers/controller.js';

const router = express.Router();

// Get current quiz statistics
router.get('/stats', (req, res) => {
   try {
      const stats = getQuizStats();
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