import express from "express";
import { getUserId } from "../middleware/auth";
import { seo_analysis } from "../schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import redis from "../redis";

const router = express.Router();

router.get('/:userId/:url',  async (req, res) => {
  try {
    const { userId, url } = req.params;
    
    // Decode URL if needed
    const decodedUrl = encodeURI(url);
    
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
      return res.status(400).json({ error: 'Analysis not found' });
    }

    const analysis = result[0];
    
    // Check if all three analyses are complete
    const hasOnPage = analysis.on_page !== null;
    const hasContent = analysis.content !== null;
    const hasTechnical = analysis.technical !== null;
    const isComplete = hasOnPage && hasContent && hasTechnical;

    if(!analysis) {
      res.status(400).json({ message: "Site analysis hasn't completed "})
    }
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

router.get('/:jobId',  async (req, res) => {
  const { jobId } = req.params;
  try {
    const userId = getUserId(req);
    
    // Get job metadata to verify ownership
    const jobMeta = await redis.get(`job:meta:${jobId}`);
    if (jobMeta) {
      const meta = JSON.parse(jobMeta);
      if (meta.userId && meta.userId !== userId) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'You can only access your own analysis results' 
        });
      }
    }

    const result = await redis.get(`job:result:${jobId}`);
    if (!result) {
      return res.status(404).json({ error: 'Result not found or still processing' });
    }
    
    res.json({ 
      jobId, 
      result: JSON.parse(result),
      user: req.user?.email
    });
  } catch (error) {
    console.error('Failed to fetch job result:', error);
    res.status(500).json({ error: 'Failed to fetch job result' });
  }
});

export default router;