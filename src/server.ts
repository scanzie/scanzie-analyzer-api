// src/server.ts
import express from 'express';
import { addSEOAnalysisJobs, addSingleAnalysisJob } from './jobs';
import './workers';
import cors from 'cors';
import * as dotenv from 'dotenv';
import redis from './redis';
import { authMiddleware, getUserId } from './middleware/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_FRONTEND_URL!,
  credentials: true
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

// Endpoint to analyze a site (add all jobs) - PROTECTED
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const userId = getUserId(req); // Get the authenticated user ID
    const jobIds = await addSEOAnalysisJobs(url, 10); // Pass userId to jobs to store them
    
    console.log(`Analysis jobs queued by user ${userId}:`, jobIds);
    res.json({ 
      message: 'Analysis jobs queued', 
      jobIds,
      user: req.user?.email // Return user info for confirmation
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
app.get('/api/user/jobs', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    // Get all job keys for this user
    const pattern = `job:meta:*`;
    const keys = await redis.keys(pattern);
    
    const userJobs: Array<{ jobId: string; [key: string]: any }> = [];
    for (const key of keys) {
      const meta = await redis.get(key);
      if (meta) {
        const jobMeta = JSON.parse(meta);
        if (jobMeta.userId === userId) {
          const jobId = key.replace('job:meta:', '');
          userJobs.push({
            jobId,
            ...jobMeta,
            createdAt: jobMeta.createdAt || new Date().toISOString()
          });
        }
      }
    }
    
    // Sort by creation date (newest first)
    userJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ 
      jobs: userJobs,
      total: userJobs.length,
      user: req.user?.email
    });
  } catch (error) {
    console.error('Failed to fetch user jobs:', error);
    res.status(500).json({ error: 'Failed to fetch user jobs' });
  }
});

// Endpoint to get current user info - PROTECTED
app.get('/api/user/me', async (req, res) => {
  res.json({ 
    user: req.user,
    message: 'Authenticated successfully' 
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

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