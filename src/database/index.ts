import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import schema from './schema'
import { config } from 'dotenv';

config()

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, {schema});