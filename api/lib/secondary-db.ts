
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.KONTROLA_DB_HOST,
    user: process.env.KONTROLA_DB_USER,
    password: process.env.KONTROLA_DB_PASSWORD,
    database: process.env.KONTROLA_DB_NAME,
    port: 5432,
    ssl: { rejectUnauthorized: false }, // Try SSL just in case
    connectionTimeoutMillis: 5000, // Fail fast if IP is blocked
});

export const secondaryDb = {
    query: (text: string, params?: any[]) => pool.query(text, params),
    pool // Export pool for graceful shutdown if needed
};
