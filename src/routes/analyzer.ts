import express from "express";
import { getUserId } from "../middleware/auth";
import { addSEOAnalysisJobs, addSingleAnalysisJob } from "../bullmq/jobs";

const router = express.Router();

router.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const userId = getUserId(req);
    const trackingInfo = await addSEOAnalysisJobs(url, 10, userId);

    res.json({
      success: true,
      userId,
      message: "Analysis jobs queued successfully",
      sessionId: trackingInfo.sessionId,
      trackingUrl: trackingInfo.trackingUrl,
    });
  } catch (error) {
    console.error("Failed to queue jobs:", error);
    res.status(500).json({ error: "Failed to queue jobs" });
  }
});

router.post("/single", async (req, res) => {
  const { type, url, options = {} } = req.body;
  if (!type || !url) {
    return res.status(400).json({ error: "Type and URL are required" });
  }

  try {
    const userId = getUserId(req);
    const jobId = await addSingleAnalysisJob(type, url, { ...options, userId });

    console.log(`Single job queued by user ${userId}:`, jobId);
    res.json({
      message: "Single analysis job queued",
      jobId,
      user: req.user?.email,
    });
  } catch (error) {
    console.error("Failed to queue single job:", error);
    res.status(500).json({ error: "Failed to queue single job" });
  }
});

export default router;
