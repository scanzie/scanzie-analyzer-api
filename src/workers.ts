// src/workers.ts
import { Worker } from 'bullmq';
import redis from './redis';
import {
  performOnPageAnalysis,
  performContentAnalysis,
  performTechnicalAnalysis,
} from './actions/seo-analysis';
import { db } from './db';
import { seo_analysis } from './schema';
import { eq } from 'drizzle-orm'; // Import for .where() if using update
import { config } from 'dotenv'; // For env loading (if not already in db.ts)

// Load env vars early (if not loaded in db.ts)
config();

// Optional: Log connection test (add to startup or a health check)
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
    // Optional: Retry logic or exit
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
    // Use INSERT for new analysis records (assumes id auto-generates)
    // If updating existing, uncomment the update below and comment the insert
    await db.insert(seo_analysis).values({
      userId,
      title: `Use-smeal analysis - ${url}`,
      on_page: type === 'on-page' ? result : null,
      content: type === 'content' ? result : null,
      technical: type === 'technical' ? result : null,
    });

    // Alternative: UPDATE existing record (e.g., by userId - add url match if needed)
    // await db
    //   .update(seo_analysis)
    //   .set({
    //     title: `Use-smeal analysis - ${url}`,
    //     on_page: type === 'on-page' ? result : sql`NULL`,
    //     content: type === 'content' ? result : sql`NULL`,
    //     technical: type === 'technical' ? result : sql`NULL`,
    //   })
    //   .where(eq(seo_analysis.userId, userId)); // Add .and(eq(seo_analysis.url, url)) if schema has 'url' col

    console.log(`Stored ${type} analysis for ${url} in DB`);
  } catch (error) {
    console.error(`DB Insert Error for ${type} (${url}):`, error);
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
    await storeResult(job.id, result); // Store result in Redis
    await storeResultInNeonDB(userId, url, 'on-page', result);
    return result;
  },
  { connection: redis }
);

// Worker for content analysis
new Worker(
  'content-analysis',
  async (job) => {
    const { url, userId, options } = job.data; // Add userId if not present in job data
    console.log(`Processing content analysis for ${url}`);
    const result = await performContentAnalysis(url, options);
    console.log(`Content analysis result:`, result);
    await storeResult(job.id, result);
    await storeResultInNeonDB(userId, url, 'content', result); // Now storing in DB
    return result;
  },
  { connection: redis }
);

// Worker for technical analysis
new Worker(
  'technical-analysis',
  async (job) => {
    const { url, userId, options } = job.data; // Add userId if not present in job data
    console.log(`Processing technical analysis for ${url}`);
    const result = await performTechnicalAnalysis(url, options);
    console.log(`Technical analysis result:`, result);
    await storeResult(job.id, result);
    await storeResultInNeonDB(userId, url, 'technical', result); // Now storing in DB
    return result;
  },
  { connection: redis }
);

console.log('Workers started and listening for jobs...');