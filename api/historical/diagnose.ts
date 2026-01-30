import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const envVar = process.env.SECONDARY_POSTGRES_URL;

    // 1. Check Env Var presence
    if (!envVar) {
        return res.status(500).json({
            status: 'error',
            message: 'SECONDARY_POSTGRES_URL is undefined'
        });
    }

    // 2. Check content (masked)
    const masked = envVar.replace(/:[^:]*@/, ':****@');

    // 3. Attempt Connection
    const pool = new Pool({
        connectionString: envVar,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000 // 3s timeout
    });

    try {
        const client = await pool.connect();
        try {
            const timeRes = await client.query('SELECT NOW()');
            return res.status(200).json({
                status: 'ok',
                message: 'Connection Successful',
                dbTime: timeRes.rows[0].now,
                connectionString: masked
            });
        } finally {
            client.release();
        }
    } catch (err: any) {
        return res.status(500).json({
            status: 'error',
            message: 'Connection Failed',
            error: err.message,
            stack: err.stack,
            connectionString: masked
        });
    } finally {
        await pool.end();
    }
}
