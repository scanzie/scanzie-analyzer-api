// src/routes/progress.ts
import express from 'express';
import { seo_analysis } from '../schema';
import { db } from '../db';
import { and, eq } from 'drizzle-orm';
import { contentAnalysisQueue, onPageAnalysisQueue, technicalAnalysisQueue } from '../queues';

const router = express.Router();

// Get progress for a specific analysis session
router.get('/progress/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get jobs from their respective queues
    const onPageJob = await onPageAnalysisQueue.getJob(`${sessionId}`)
    const contentJob = await contentAnalysisQueue.getJob(`${sessionId}`)
    const technicalJob = await technicalAnalysisQueue.getJob(`${sessionId}`)

    const jobs = [onPageJob, contentJob, technicalJob];
    const types = ['on-page', 'content', 'technical'];

    const jobStatuses = await Promise.all(jobs.map(async (job, index) => {
      if (!job) return { type: types[index], status: 'not_found', progress: 0 };

      const state = await job.getState(); // Accurate state: 'completed', 'failed', 'active', 'waiting', etc.
      return {
        type: types[index],
        status: job.failedReason ? 'failed' : (state === 'completed' ? 'completed' : (state === 'active' || Number(job.progress) > 0 ? 'processing' : 'waiting')),
        progress: typeof job.progress === 'number' ? job.progress : 0,
        jobId: job.id,
        error: job.failedReason
      };
    }));


    const allCompleted = jobStatuses.every(job => job.status === 'completed');
    const totalProgress = Math.round(
      jobStatuses.reduce((sum, job) => sum + job.progress, 0) / 3
    );

    res.json({
      sessionId,
      userId,
      status: allCompleted ? 'completed' : 'processing',
      overallProgress: totalProgress,
      jobs: jobStatuses,
      isReady: allCompleted
    });
  } catch (error) {
    console.error('Progress check error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});



export default router;