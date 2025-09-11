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

// Store job results in Redis with a TTL of 1 hour (3600 seconds)
const storeResult = async (jobId: string | undefined, result: any) => {
  await redis.set(`job:result:${jobId}`, JSON.stringify(result), 'EX', 3600);
};

const storeResultInNeonDB = async ( userId : string, url : string, type : "on-page" | "content" | "technical" , result : Object) => {
  try { 
    await db
    .insert(seo_analysis)
    .values({
      id: crypto.randomUUID(),
      userId: userId,
      title: `Use-smeal analysis - ${url}`,
      on_page: type == 'on-page' && result,
      content: type == 'content' && result,
      technical: type == 'technical' && result
    })
    
  } catch(error) {
    console.error("Error: ",error)
  }
}

// Worker for on-page analysis
new Worker(
  'on-page-analysis',
  async (job) => {
    const { url, userId, options } = job.data;
    console.log(`Processing on-page analysis for ${url}`);
    const result = await performOnPageAnalysis(url, options);
    console.log(`On-page analysis result:`, result);
    await storeResult(job.id, result); // Store result in Redis
    await storeResultInNeonDB(userId,url,'on-page', result)
    return result;
  },
  { connection: redis }
);

// Worker for content analysis
new Worker(
  'content-analysis',
  async (job) => {
    const { url, options } = job.data;
    console.log(`Processing content analysis for ${url}`);
    const result = await performContentAnalysis(url, options);
    console.log(`Content analysis result:`, result);
    await storeResult(job.id, result);
    return result;
  },
  { connection: redis }
);

// Worker for technical analysis
new Worker(
  'technical-analysis',
  async (job) => {
    const { url, options } = job.data;
    console.log(`Processing technical analysis for ${url}`);
    const result = await performTechnicalAnalysis(url, options);
    console.log(`Technical analysis result:`, result);
    await storeResult(job.id, result);
    return result;
  },
  { connection: redis }
);

console.log('Workers started and listening for jobs...');