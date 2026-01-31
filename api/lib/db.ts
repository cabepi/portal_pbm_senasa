import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Primary DB (Vercel Postgres - Neon)
// Uses POSTGRES_URL from .env
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }, // Neon/Vercel usually require SSL
    connectionTimeoutMillis: 5000,
});

export default pool;
