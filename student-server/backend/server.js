import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { createWebSocketServer, getQuizStats } from './src/controllers/controller.js';
import quizRoutes from './src/routes/scocket.route.js';
import { connectRedis, closeRedis } from './src/config/redis.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Simple CORS - allow all origins for localhost testing
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/quiz', quizRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Quiz statistics endpoint
app.get('/api/quiz-stats', async (req, res) => {
  try {
    const stats = await getQuizStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting quiz stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get quiz statistics',
      error: error.message
    });
  }
});

// WebSocket connection info endpoint
app.get('/api/websocket-info', (req, res) => {
  res.json({
    success: true,
    websocketUrl: `ws://localhost:${PORT}`,
    message: 'Connect to this URL using WebSocket client',
    sampleMessages: {
      answer: { type: 'answer', answerIndex: 0 },
      ping: { type: 'ping' }
    }
  });
});


// Simple error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Server error' });
});

// Initialize Redis connection
async function startServer() {
  try {
    // Connect to Redis (graceful degradation if Redis is not available)
    const redisConnected = await connectRedis();

    if (redisConnected) {
      console.log('✅ Redis connected successfully');
    } else {
      console.log('⚠️ Starting server without Redis (performance may be reduced)');
    }

    // Initialize WebSocket server
    const wss = createWebSocketServer(server);
    console.log("WebSocket server initialized:", !!wss);

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Connect using: ws://localhost:${PORT}`);
      console.log(`   Redis status: ${redisConnected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`   Quiz API: http://localhost:${PORT}/api/quiz-stats`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Gracefully shutting down...');

      // Close WebSocket connections
      if (wss && wss.clients) {
        wss.clients.forEach(ws => {
          ws.close(1000, 'Server shutting down');
        });
      }

      // Close Redis connection
      await closeRedis();

      // Close HTTP server
      server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();