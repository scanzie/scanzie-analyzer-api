import express from "express";
import { getUserId } from "../middleware/auth";
import redis from "../database/redis";

const router = express.Router();

router.get('/jobs',  async (req, res) => {
  try {
    const userId = getUserId(req);
    
    // Get all job keys for this user
    const pattern = `job:meta:*`;
    const keys = await redis.keys(pattern);
    
    const userJobs: Array<{ jobId: string; [key: string]: any }> = [];
    for (const key of keys) {
      const meta = await redis.get(key);
      if (meta) {
        const jobMeta = JSON.parse(meta);
        if (jobMeta.userId === userId) {
          const jobId = key.replace('job:meta:', '');
          userJobs.push({
            jobId,
            ...jobMeta,
            createdAt: jobMeta.createdAt || new Date().toISOString()
          });
        }
      }
    }
    
    // Sort by creation date (newest first)
    userJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ 
      jobs: userJobs,
      total: userJobs.length,
      user: req.user?.email
    });
  } catch (error) {
    console.error('Failed to fetch user jobs:', error);
    res.status(500).json({ error: 'Failed to fetch user jobs' });
  }
});

router.get('/me',  async (req, res) => {
  res.json({ 
    user: req.user,
    message: 'Authenticated successfully' 
  });
});


export default router;