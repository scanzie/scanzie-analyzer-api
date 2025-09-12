// src/routes/progress.ts
import express from 'express';
import { Queue } from 'bullmq';
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
    const [onPageJob, contentJob, technicalJob] = await Promise.all([
      onPageAnalysisQueue.getJob(`on-page-${sessionId}`),
      contentAnalysisQueue.getJob(`content-${sessionId}`),
      technicalAnalysisQueue.getJob(`technical-${sessionId}`)
    ]);

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

// Get stored analysis result (alternative to job queue tracking)
router.get('/result/:userId/:url', async (req, res) => {
  try {
    const { userId, url } = req.params;
    
    // Decode URL if needed
    const decodedUrl = encodeURI(url);
    console.log(url)
    
    // Query the database for complete analysis
    const result = await db
      .select()
      .from(seo_analysis)
      .where(
        and(
          eq(seo_analysis.userId, userId),
          eq(seo_analysis.url, decodedUrl)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const analysis = result[0];
    
    // Check if all three analyses are complete
    const hasOnPage = analysis.on_page !== null;
    const hasContent = analysis.content !== null;
    const hasTechnical = analysis.technical !== null;
    const isComplete = hasOnPage && hasContent && hasTechnical;
    res.json({
      userId,
      url: decodedUrl,
      isComplete,
      progress: isComplete ? 100 : Math.round(
        (Number(hasOnPage) + Number(hasContent) + Number(hasTechnical)) * 33.33
      ),
      analysis: {
        on_page: analysis.on_page,
        content: analysis.content,
        technical: analysis.technical
      }
    });
  } catch (error) {
    console.error('Result query error:', error);
    res.status(500).json({ error: 'Failed to get analysis result' });
  }
});

export default router;