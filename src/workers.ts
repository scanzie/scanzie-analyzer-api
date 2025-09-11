import { Worker } from 'bullmq';
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

// Load env vars early (if not loaded in db.ts)
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

// Worker for on-page analysis
new Worker(
  'on-page-analysis',
  async (job) => {
    const { url, userId, options } = job.data;
    console.log(`Processing on-page analysis for ${url}`);
    const result = await performOnPageAnalysis(url, options);
    console.log(`On-page analysis result:`, result);
    await storeResult(job.id, result);
    await storeResultInNeonDB(userId, url, 'on-page', result);
    return result;
  },
  { connection: redis }
);

// Worker for content analysis
new Worker(
  'content-analysis',
  async (job) => {
    const { url, userId, options } = job.data;
    console.log(`Processing content analysis for ${url}`);
    const result = await performContentAnalysis(url, options);
    console.log(`Content analysis result:`, result);
    await storeResult(job.id, result);
    await storeResultInNeonDB(userId, url, 'content', result);
    return result;
  },
  { connection: redis }
);

// Worker for technical analysis
new Worker(
  'technical-analysis',
  async (job) => {
    const { url, userId, options } = job.data;
    console.log(`Processing technical analysis for ${url}`);
    const result = await performTechnicalAnalysis(url, options);
    console.log(`Technical analysis result:`, result);
    await storeResult(job.id, result);
    await storeResultInNeonDB(userId, url, 'technical', result);
    return result;
  },
  { connection: redis }
);

console.log('Workers started and listening for jobs...');