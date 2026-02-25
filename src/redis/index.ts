// src/redis.ts
import Redis  from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config()

const redisPort = Number(process.env.REDIS_PORT!);
const redisHost = process.env.REDIS_HOST!;

const redis = new Redis({
    host: redisHost,
    port: redisPort,
    maxRetriesPerRequest: null,
    password: process.env.REDIS_PASSWORD,
});

// Connect and weeor stmt
redis.on("connect", () => console.log("✅ Redis connected!"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

export default redis;