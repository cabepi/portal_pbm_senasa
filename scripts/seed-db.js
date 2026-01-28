
import { createPool } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
    const db = createPool({ connectionString: process.env.POSTGRES_URL });

    try {
        console.log('🌱 Connected to database...');

        // 1. Create Tables
        console.log('Creating tables...');

        await db.sql`
      CREATE TABLE IF NOT EXISTS pharmacies (
        code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );
    `;

        await db.sql`
      CREATE TABLE IF NOT EXISTS medications (
        code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );
    `;

        await db.sql`
      CREATE TABLE IF NOT EXISTS auth_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pharmacy_code VARCHAR(50),
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        // Create index for faster pharmacy filtering
        await db.sql`
      CREATE INDEX IF NOT EXISTS idx_history_pharmacy ON auth_history(pharmacy_code);
    `;

        console.log('✅ Tables created.');

        // 2. Seed Pharmacies
        const pharmaciesPath = path.join(__dirname, '../src/data/pharmacies.json');
        if (fs.existsSync(pharmaciesPath)) {
            const pharmacies = JSON.parse(fs.readFileSync(pharmaciesPath, 'utf8'));
            console.log(`seeding ${pharmacies.length} pharmacies...`);

            // Batch insert manually for performance/simplicity in raw driver
            // For large datasets, batching is safer. Doing 500 at a time.
            const batchSize = 500;
            for (let i = 0; i < pharmacies.length; i += batchSize) {
                const batch = pharmacies.slice(i, i + batchSize);
                // Construct VALUES part dynamically
                await Promise.all(batch.map(p =>
                    db.sql`
                INSERT INTO pharmacies (code, name) 
                VALUES (${p.code}, ${p.name}) 
                ON CONFLICT (code) DO UPDATE SET name = ${p.name}
            `
                ));
                console.log(`  Processed ${Math.min(i + batchSize, pharmacies.length)}/${pharmacies.length}`);
            }
        } else {
            console.warn('⚠️ pharmacies.json not found');
        }

        // 3. Seed Medications
        const medicationsPath = path.join(__dirname, '../src/data/medications.json');
        if (fs.existsSync(medicationsPath)) {
            const medications = JSON.parse(fs.readFileSync(medicationsPath, 'utf8'));
            console.log(`seeding ${medications.length} medications...`);

            const batchSize = 500;
            for (let i = 0; i < medications.length; i += batchSize) {
                const batch = medications.slice(i, i + batchSize);
                await Promise.all(batch.map(m =>
                    db.sql`
                INSERT INTO medications (code, name) 
                VALUES (${m.code}, ${m.name}) 
                ON CONFLICT (code) DO UPDATE SET name = ${m.name}
            `
                ));
                console.log(`  Processed ${Math.min(i + batchSize, medications.length)}/${medications.length}`);
            }
        } else {
            console.warn('⚠️ medications.json not found');
        }

        console.log('🎉 Seeding completed successfully.');

    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    } finally {
        // End connection via pool if needed, though script exit handles it
    }
}

seed();
