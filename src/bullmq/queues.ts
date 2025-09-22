// src/queues.ts

import { Queue } from 'bullmq';
import redis from '../database/redis';

// Default job options
export const defaultJobOptions = {
  removeOnComplete: 10,
  removeOnFail: 5,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};

// Create separate queues
export const onPageAnalysisQueue = new Queue('on-page-analysis', { connection: redis });
export const contentAnalysisQueue = new Queue('content-analysis', { connection: redis });
export const technicalAnalysisQueue = new Queue('technical-analysis', { connection: redis });