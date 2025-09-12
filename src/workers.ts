// src/workers.ts
import { Worker, Job } from 'bullmq';
import redis from './redis';
import {
  performOnPageAnalysis,
  performContentAnalysis,
  performTechnicalAnalysis,
} from './actions/seo-analysis';
import { db } from './db';
import { seo_analysis } from './schema';
import { eq, and } from 'drizzle-orm';
import { config } from 'dotenv';

config();

// Optional: Log connection test
const testConnection = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL env var - cannot connect to NeonDB');
    process.exit(1);
  }
  try {
    await db.select().from(seo_analysis).limit(0); // Ping query
    console.log('NeonDB connection OK');
  } catch (err) {
    console.error('NeonDB connection failed:', err);
  }
};
testConnection();

// Store job results in Redis with a TTL of 1 hour (3600 seconds)
const storeResult = async (jobId: string | undefined, result: any) => {
  await redis.set(`job:result:${jobId}`, JSON.stringify(result), 'EX', 3600);
};

const storeResultInNeonDB = async (
  userId: string,
  url: string,
  type: 'on-page' | 'content' | 'technical',
  result: Object
) => {
  try {
    // Check if a record exists for the userId and url
    const existingRecord = await db
      .select()
      .from(seo_analysis)
      .where(and(eq(seo_analysis.userId, userId), eq(seo_analysis.url, url)))
      .limit(1);

    if (existingRecord.length > 0) {
      // Update existing record
      await db
        .update(seo_analysis)
        .set({
          title: `SEO analysis - ${url}`,
          on_page: type === 'on-page' ? result : existingRecord[0].on_page,
          content: type === 'content' ? result : existingRecord[0].content,
          technical: type === 'technical' ? result : existingRecord[0].technical,
        })
        .where(and(eq(seo_analysis.userId, userId), eq(seo_analysis.url, url)));
      console.log(`Updated ${type} analysis for ${url} in DB`);
    } else {
      // Insert new record
      await db.insert(seo_analysis).values({
        userId,
        url,
        title: `SEO analysis - ${url}`,
        on_page: type === 'on-page' ? result : null,
        content: type === 'content' ? result : null,
        technical: type === 'technical' ? result : null,
      });
      console.log(`Inserted ${type} analysis for ${url} in DB`);
    }
  } catch (error) {
    console.error(`DB Operation Error for ${type} (${url}):`, error);
    throw error; // Re-throw to let BullMQ mark job as failed/retry
  }
};

// Worker for on-page analysis with progress tracking
new Worker(
  'on-page-analysis',
  async (job: Job) => {
    const { url, userId, options } = job.data;
    console.log(`Processing on-page analysis for ${url}`);
    
    // Report 10% progress at start
    await job.updateProgress(10);
    
    try {
      const result = await performOnPageAnalysis(url, options);
      console.log(`On-page analysis result:`, result);
      
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
    console.log(`Processing content analysis for ${url}`);
    
    await job.updateProgress(10);
    
    try {
      const result = await performContentAnalysis(url, options);
      console.log(`Content analysis result:`, result);
      
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
    console.log(`Processing technical analysis for ${url}`);
    
    await job.updateProgress(10);
    
    try {
      const result = await performTechnicalAnalysis(url, options);
      console.log(`Technical analysis result:`, result);
      
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