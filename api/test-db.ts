import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const pool = new Pool(
    process.env.SECONDARY_POSTGRES_URL
        ? {
            connectionString: process.env.SECONDARY_POSTGRES_URL,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
        }
        : {
            host: process.env.KONTROLA_DB_HOST,
            user: process.env.KONTROLA_DB_USER,
            password: process.env.KONTROLA_DB_PASSWORD,
            database: process.env.KONTROLA_DB_NAME,
            port: 5432,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
        }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as time, count(*) as count FROM dhm LIMIT 1');
        client.release();

        return res.status(200).json({
            status: 'OK',
            time: result.rows[0].time,
            db_accessible: true,
            env_vars_detected: {
                google: !!process.env.GOOGLE_API_KEY,
                db_url: !!process.env.SECONDARY_POSTGRES_URL
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            status: 'ERROR',
            message: error.message,
            stack: error.stack
        });
    }
}
