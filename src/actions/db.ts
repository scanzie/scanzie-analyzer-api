import { and, eq } from "drizzle-orm";
import { db } from "../database";
import { seo_analysis, project } from "../database/schema";
import redis from "../redis";

// Get or create a "general" project for the user
const getOrCreateGeneralProject = async (userId: string) => {
  try {
    // Check if "general" project exists for the user
    const existingProject = await db
      .select()
      .from(project)
      .where(and(eq(project.userId, userId), eq(project.name, "general")))
      .limit(1);

    if (existingProject.length > 0) {
      return existingProject[0].id;
    }

    // Create a new "general" project if it doesn't exist
    const newProject = await db
      .insert(project)
      .values({
        name: "general",
        userId,
      })
      .returning();

    return newProject[0].id;
  } catch (error) {
    console.error(
      `Error getting or creating general project for user ${userId}:`,
      error,
    );
    throw error;
  }
};

export const storeResultInNeonDB = async (
  userId: string,
  url: string,
  type: "on-page" | "content" | "technical",
  result: Object,
) => {
  try {
    // Get or create the "general" project
    const projectId = await getOrCreateGeneralProject(userId);

    // Check if a record exists for the userId, url, and projectId
    const existingRecord = await db
      .select()
      .from(seo_analysis)
      .where(
        and(
          eq(seo_analysis.userId, userId),
          eq(seo_analysis.url, url),
          eq(seo_analysis.projectId, projectId),
        ),
      )
      .limit(1);

    if (existingRecord.length > 0) {
      // Update existing record
      await db
        .update(seo_analysis)
        .set({
          title: `SEO analysis - ${url}`,
          on_page: type === "on-page" ? result : existingRecord[0].on_page,
          content: type === "content" ? result : existingRecord[0].content,
          technical:
            type === "technical" ? result : existingRecord[0].technical,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(seo_analysis.userId, userId),
            eq(seo_analysis.url, url),
            eq(seo_analysis.projectId, projectId),
          ),
        );
    } else {
      // Insert new record
      await db.insert(seo_analysis).values({
        projectId,
        userId,
        url,
        title: `SEO analysis - ${url}`,
        on_page: type === "on-page" ? result : null,
        content: type === "content" ? result : null,
        technical: type === "technical" ? result : null,
      });
    }
  } catch (error) {
    console.error(`DB Operation Error for ${type} (${url}):`, error);
    throw error; // Re-throw to let BullMQ mark job as failed/retry
  }
};

export const storeResult = async (jobId: string | undefined, result: any) => {
  await redis.set(`job:result:${jobId}`, JSON.stringify(result), "EX", 3600);
};
