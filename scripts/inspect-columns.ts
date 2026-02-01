
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

async function inspect() {
    try {
        console.log('🔍 Inspecting dhm table columns...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'dhm' 
            ORDER BY ordinal_position;
        `);

        console.log('--- COLUMNS ---');
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
        console.log('---------------');
        console.log(`Total: ${res.rows.length} columns`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

inspect();
