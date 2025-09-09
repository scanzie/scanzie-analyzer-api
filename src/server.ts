// src/server.ts
import express from 'express';
import { addSEOAnalysisJobs, addSingleAnalysisJob } from './jobs';
import './workers';
import cors from 'cors';
import * as dotenv from 'dotenv';
import redis from './redis';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_FRONTEND_URL!
}));

// Endpoint to analyze a site (add all jobs)
app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const jobIds = await addSEOAnalysisJobs(url, 10);
    console.log('Analysis jobs queued:', jobIds);
    res.json({ message: 'Analysis jobs queued', jobIds });
  } catch (error) {
    console.error('Failed to queue jobs:', error);
    res.status(500).json({ error: 'Failed to queue jobs' });
  }
});

// Endpoint to add a single analysis job
app.post('/analyze/single', async (req, res) => {
  const { type, url, options } = req.body;
  if (!type || !url) {
    return res.status(400).json({ error: 'Type and URL are required' });
  }

  try {
    const jobId = await addSingleAnalysisJob(type, url, options);
    console.log('Single job queued:', jobId);
    res.json({ message: 'Single analysis job queued', jobId });
  } catch (error) {
    console.error('Failed to queue single job:', error);
    res.status(500).json({ error: 'Failed to queue single job' });
  }
});

// Endpoint to fetch job results
app.get('/results/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    const result = await redis.get(`job:result:${jobId}`);
    if (!result) {
      return res.status(404).json({ error: 'Result not found or still processing' });
    }
    res.json({ jobId, result: JSON.parse(result) });
  } catch (error) {
    console.error('Failed to fetch job result:', error);
    res.status(500).json({ error: 'Failed to fetch job result' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});