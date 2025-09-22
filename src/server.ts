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

// Public routes (no authentication required)
app.get('/', async (req, res) => {
  res.json({ message: "Welcome to Use-smeal Site analyzer" });
});

app.get('/health', async (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Protected routes (authentication required)
app.use('/analyze', authMiddleware); 
app.use('/results', authMiddleware); 

// 
app.use('/api', progressRoutes);

// Endpoint to analyze a site (add all jobs) - PROTECTED
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const userId = getUserId(req); // Get the authenticated user ID
    const trackingInfo = await addSEOAnalysisJobs(url, 10, userId);
    console.log(`Analysis jobs queued by user ${userId}:`, trackingInfo);
    
    res.json({
      success: true,
      userId,
      message: 'Analysis jobs queued successfully',
      sessionId: trackingInfo.sessionId,
      trackingUrl: trackingInfo.trackingUrl
    });
  
  } catch (error) {
    console.error('Failed to queue jobs:', error);
    res.status(500).json({ error: 'Failed to queue jobs' });
  }
});

// Endpoint to add a single analysis job - PROTECTED
app.post('/api/analyze/single', async (req, res) => {
  const { type, url, options = {} } = req.body;
  if (!type || !url) {
    return res.status(400).json({ error: 'Type and URL are required' });
  }

  try {
    const userId = getUserId(req);
    const jobId = await addSingleAnalysisJob(type, url, { ...options, userId });
    
    console.log(`Single job queued by user ${userId}:`, jobId);
    res.json({ 
      message: 'Single analysis job queued', 
      jobId,
      user: req.user?.email
    });
  } catch (error) {
    console.error('Failed to queue single job:', error);
    res.status(500).json({ error: 'Failed to queue single job' });
  }
});

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

// Endpoint to get user's job history - PROTECTED
app.get('/api/user', userRoutes);


// Error handling middleware
app.use(errorMiddleware);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});