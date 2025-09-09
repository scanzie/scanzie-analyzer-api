// src/redis.ts

import Redis  from 'ioredis';

// Create Redis connection
const redis = new Redis(process.env.REDIS_URL!, {maxRetriesPerRequest: null});

export default redis;