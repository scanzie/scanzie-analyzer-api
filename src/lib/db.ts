import { db } from "../database";
import { seo_analysis } from "../database/schema";

export const testConnection = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL env var - cannot connect to NeonDB');
    process.exit(1);
  }
  try {
    await db.select().from(seo_analysis).limit(0); // Ping query
    console.log('NeonDB connection OK');
  } catch (err) {
    console.error('NeonDB connection failed:', err);
  }
};
