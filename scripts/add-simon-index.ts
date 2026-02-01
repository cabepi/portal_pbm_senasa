
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

async function applyIndex() {
    try {
        console.log('🚀 Creating Index on "simon" column...');
        // CREATE INDEX IF NOT EXISTS is safe to run multiple times
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_dhm_simon ON dhm(simon);`);
        console.log('✅ Index idx_dhm_simon created successfully.');
    } catch (err) {
        console.error('❌ Error creating index:', err);
    } finally {
        await pool.end();
    }
}

applyIndex();
