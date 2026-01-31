
import pool from '../api/lib/db';
import bcrypt from 'bcrypt';

const USERS = [
    { email: 'fmarinez@unipago.com.do', name: 'F. Marinez' },
    { email: 'agonzalez@unipago.com.do', name: 'A. Gonzalez' },
    { email: 'cbetancur@unipago.com.do', name: 'C. Betancur' }
];

const DEFAULT_PASSWORD = 'Unipago2026@';

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🚀 Connecting to Primary Database...');

        // 1. Create Users Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Table "users" ensures.');

        // 2. Hash Password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, saltRounds);
        console.log('🔐 Password hashed.');

        // 3. Upsert Users
        for (const user of USERS) {
            await client.query(`
                INSERT INTO users (email, password, name)
                VALUES ($1, $2, $3)
                ON CONFLICT (email) 
                DO UPDATE SET password = $2;
            `, [user.email, hashedPassword, user.name]);
            console.log(`👤 User processed: ${user.email}`);
        }

        console.log('✨ Seeding completed successfully.');
    } catch (error) {
        console.error('❌ Error seeding users:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
