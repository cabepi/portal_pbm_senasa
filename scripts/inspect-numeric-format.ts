
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

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

async function inspectData() {
    try {
        console.log('🔍 Inspecting numeric column formats...');
        const res = await pool.query(`
            SELECT totalcobertura, precio, copago, cantidad 
            FROM dhm 
            LIMIT 5;
        `);

        console.log('--- DATA SAMPLES ---');
        console.table(res.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

inspectData();
