import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { createWebSocketServer, getQuizStats } from './src/controllers/controller.js';
import quizRoutes from './src/routes/scocket.route.js';

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
app.get('/api/quiz-stats', (req, res) => {
  const stats = getQuizStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
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

// Initialize WebSocket server
const wss = createWebSocketServer(server);

console.log("Was : --> ", wss);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Connect using: ws://localhost:${PORT}`);
});