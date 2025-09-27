import { and, eq } from "drizzle-orm";
import { db } from "../database";
import { seo_analysis } from "../database/schema";
import redis from "../redis";

export const storeResultInNeonDB = async (
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
          updatedAt: new Date(),
        })
        .where(and(eq(seo_analysis.userId, userId), eq(seo_analysis.url, url)));
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
    }
  } catch (error) {
    console.error(`DB Operation Error for ${type} (${url}):`, error);
    throw error; // Re-throw to let BullMQ mark job as failed/retry
  }
};

export const storeResult = async (jobId: string | undefined, result: any) => {
  await redis.set(`job:result:${jobId}`, JSON.stringify(result), 'EX', 3600);
};