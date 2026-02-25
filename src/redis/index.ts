// src/redis.ts
import Redis  from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config()

const redisPort = parseInt(process.env.REDIS_PORT!);
const redisHost = process.env.REDIS_HOST!;

const redis = new Redis({
    host: redisHost,
    port: redisPort,
    maxRetriesPerRequest: null,
    password: process.env.REDIS_PASSWORD,
});

export default redis;