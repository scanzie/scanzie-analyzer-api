// src/workers.ts
import { Worker, Job } from 'bullmq';
import {
  performOnPageAnalysis,
  performContentAnalysis,
  performTechnicalAnalysis,
} from '../actions/seo-analysis';
import { config } from 'dotenv';
import redis from '../redis';
import { storeResult, storeResultInNeonDB } from '../actions/db';
import { testConnection } from '../lib/db';

config();

testConnection();

// Worker for on-page analysis with progress tracking
new Worker(
  'on-page-analysis',
  async (job: Job) => {
    const { url, userId, options } = job.data;
    // Report 10% progress at start
    await job.updateProgress(10);
    
    try {
      const result = await performOnPageAnalysis(url, options);
      
      // Report 90% progress before storing
      await job.updateProgress(90);
      
      await storeResult(job.id, result);
      await storeResultInNeonDB(userId, url, 'on-page', result);
      
      // Report 100% progress on completion
      await job.updateProgress(100);
      
      return { status: 'completed', type: 'on-page', result };
    } catch (error) {
      await job.updateProgress(0); // Reset progress on error
      throw error;
    }
  },
  { connection: redis }
);

// Worker for content analysis with progress tracking
new Worker(
  'content-analysis',
  async (job: Job) => {
    const { url, userId, options } = job.data;
    await job.updateProgress(10);
    
    try {
      const result = await performContentAnalysis(url, options);
      
      await job.updateProgress(90);
      await storeResult(job.id, result);
      await storeResultInNeonDB(userId, url, 'content', result);
      
      await job.updateProgress(100);
      
      return { status: 'completed', type: 'content', result };
    } catch (error) {
      await job.updateProgress(0);
      throw error;
    }
  },
  { connection: redis }
);

// Worker for technical analysis with progress tracking
new Worker(
  'technical-analysis',
  async (job: Job) => {
    const { url, userId, options } = job.data;
    await job.updateProgress(10);
    
    try {
      const result = await performTechnicalAnalysis(url, options);
      await job.updateProgress(90);
      await storeResult(job.id, result);
      await storeResultInNeonDB(userId, url, 'technical', result);
      
      await job.updateProgress(100);
      
      return { status: 'completed', type: 'technical', result };
    } catch (error) {
      await job.updateProgress(0);
      throw error;
    }
  },
  { connection: redis }
);

console.log('Workers started and listening for jobs...');