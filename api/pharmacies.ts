
import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { search = '' } = request.query;
    const searchTerm = Array.isArray(search) ? search[0] : search;

    try {
        // Debug: Log environment status (DO NOT log full values in production)
        const dbUrl = process.env.POSTGRES_URL;
        console.log(`[Vercel] DB Connection Attempt. POSTGRES_URL defined: ${!!dbUrl}`);

        if (!dbUrl) {
            throw new Error("Missing POSTGRES_URL environment variable.");
        }

        let result;
        if (searchTerm) {
            // Safe parameterized query
            const pattern = `%${searchTerm}%`;
            result = await sql`
            SELECT * FROM pharmacies 
            WHERE name ILIKE ${pattern} OR code ILIKE ${pattern}
            LIMIT 50;
        `;
        } else {
            result = await sql`SELECT * FROM pharmacies LIMIT 50;`;
        }

        return response.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
