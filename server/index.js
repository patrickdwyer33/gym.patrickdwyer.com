import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import workoutRoutes from './routes/workouts.js';
import syncRoutes from './routes/sync.js';
import configRoutes from './routes/config.js';
import errorHandler from './middleware/errorHandler.js';
import { initWebSocketServer } from './websocket.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('combined'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/config', configRoutes);

// Error handling
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
