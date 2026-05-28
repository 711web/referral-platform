import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set');

export const pool = new Pool({ connectionString: url, max: 10 });
export const db = drizzle(pool, { schema });
