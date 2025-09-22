// src/server.ts
import express from 'express';
import { addSEOAnalysisJobs, addSingleAnalysisJob } from './jobs';
import './workers';
import cors from 'cors';
import * as dotenv from 'dotenv';
import redis from './redis';
import { authMiddleware, getUserId } from './middleware/auth';
import progressRoutes from './routes/progress'
import userRoutes from './routes/user';
import analyzerRoutes from './routes/analyzer';
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

app.get('/health', async (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Progress Route
app.use('/api', progressRoutes);

// Analyzer Route
app.post('/api/analyze', analyzerRoutes);

// User Route
app.get('/api/user', userRoutes);


// Endpoint to fetch job results - PROTECTED
app.get('/api/results/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    const userId = getUserId(req);
    
    // Get job metadata to verify ownership
    const jobMeta = await redis.get(`job:meta:${jobId}`);
    if (jobMeta) {
      const meta = JSON.parse(jobMeta);
      if (meta.userId && meta.userId !== userId) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'You can only access your own analysis results' 
        });
      }
    }

    const result = await redis.get(`job:result:${jobId}`);
    if (!result) {
      return res.status(404).json({ error: 'Result not found or still processing' });
    }
    
    res.json({ 
      jobId, 
      result: JSON.parse(result),
      user: req.user?.email
    });
  } catch (error) {
    console.error('Failed to fetch job result:', error);
    res.status(500).json({ error: 'Failed to fetch job result' });
  }
});

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