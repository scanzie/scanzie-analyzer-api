// src/redis.ts
import Redis  from 'ioredis';

// Create Redis connection
const redis = new Redis({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!),
    maxRetriesPerRequest: null,
    password: process.env.REDIS_PASSWORD,
    tls: {}
});

export default redis;