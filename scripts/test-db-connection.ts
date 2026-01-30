import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
    console.log('Env Check:', {
        HOST: process.env.KONTROLA_DB_HOST,
        USER: process.env.KONTROLA_DB_USER,
        DB: process.env.KONTROLA_DB_NAME
    });

    // Dynamic import to ensure process.env is populated before module request
    const { secondaryDb } = await import('../api/lib/secondary-db');

    console.log('Testing connection to Kontrola DB...');
    try {
        const res = await secondaryDb.query('SELECT count(*) FROM dhm');
        console.log('Connection successful! 🎉');
        console.log(`Total rows in dhm table: ${res.rows[0].count}`);
    } catch (err) {
        console.error('Connection failed! ❌', err);
    } finally {
        process.exit(0);
    }
}

testConnection();
