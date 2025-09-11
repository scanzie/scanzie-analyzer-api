// src/jobs.ts

import {
  onPageAnalysisQueue,
  contentAnalysisQueue,
  technicalAnalysisQueue,
  defaultJobOptions,
} from './queues';

import { v4 as uuidv4 } from 'uuid';

// Interface for job data
interface SEOJobData {
  url: string;
  userId: string;
  timestamp: number;
  options: any;
  analysisType: 'on-page' | 'content' | 'technical';
}

// Function to add complete SEO analysis jobs
export async function addSEOAnalysisJobs(url: string, priority: number = 0, userId) {
  const sessionId = uuidv4();
  try {
    const jobData: Omit<SEOJobData, 'analysisType'> = {
      url,
      timestamp: Date.now(),
      userId,
      options: {
        includeImages: true,
        checkMobileFriendly: true,
      },
    };

    // Add on-page job
    const onPageJob = await onPageAnalysisQueue.add(
      `on-page-${sessionId}`,
      { ...jobData, analysisType: 'on-page' as const },
      {
        ...defaultJobOptions,
        priority, // Higher numbers = higher priority
        delay: 0, // Start immediately
      }
    );

    // Add content job
    const contentJob = await contentAnalysisQueue.add(
      `content-${sessionId}`,
      { ...jobData, analysisType: 'content' as const },
      {
        ...defaultJobOptions,
        priority,
        delay: 1000, // Start 1 second after on-page
      }
    );

    // Add technical job
    const technicalJob = await technicalAnalysisQueue.add(
      `technical-${sessionId}`,
      { ...jobData, analysisType: 'technical' as const },
      {
        ...defaultJobOptions,
        priority,
        delay: 2000, // Start 2 seconds after on-page
      }
    );

    console.log('Jobs added:', {
      onPage: onPageJob.id,
      content: contentJob.id,
      technical: technicalJob.id,
    });

    return {
      sessionId, 
      jobIds: [onPageJob.id, contentJob.id, technicalJob.id],
      trackingUrl: `/api/progress/${sessionId}?userId=${userId}`
    };
  } catch (error) {
    console.error('Error adding jobs:', error);
    throw error;
  }
}

// Function to add a single analysis job
export async function addSingleAnalysisJob(
  queueType: 'on-page' | 'content' | 'technical',
  url: string,
  customOptions: any = {}
) {
  const queues = {
    'on-page': onPageAnalysisQueue,
    'content': contentAnalysisQueue,
    'technical': technicalAnalysisQueue,
  };

  const queue = queues[queueType];
  if (!queue) {
    throw new Error(`Invalid queue type: ${queueType}`);
  }

  const job = await queue.add(
    `${queueType}-analysis`,
    {
      url,
      analysisType: queueType,
      options: customOptions,
      timestamp: Date.now(),
    },
    {
      ...defaultJobOptions,
      ...customOptions.jobOptions, // Allow overriding job options
    }
  );

  return job.id;
}