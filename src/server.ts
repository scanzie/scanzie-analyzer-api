// src/server.ts
import express from 'express';
import './bullmq/workers';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth';
import progressRoutes from './routes/progress'
import userRoutes from './routes/user';
import analyzerRoutes from './routes/analyzer';
import resultRoutes from './routes/result';
import errorMiddleware from './middleware/error';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_FRONTEND_URL!,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],  // Add if needed
  allowedHeaders: ['Content-Type', 'Authorization']  // Add if custom headers
}));

// Middlewares
app.use('/analyze', authMiddleware); 
app.use('/results', authMiddleware); 
app.use(errorMiddleware);


// Public routes (no authentication required)
app.get('/', async (req, res) => {
  res.json({ message: "Welcome to Use-smeal Site analyzer" });
});

app.head('/health', async (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/health', async (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Progress Route
app.use('/api/progress', progressRoutes);

// Analyzer Route
app.use('/api/analyze', analyzerRoutes);

// User Route
app.use('/api/user', userRoutes);

// Result Route
app.use('api/results', resultRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});