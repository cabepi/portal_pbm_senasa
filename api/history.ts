
import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    try {
        if (request.method === 'GET') {
            const { pharmacyCode } = request.query;
            const pCode = Array.isArray(pharmacyCode) ? pharmacyCode[0] : pharmacyCode;

            let result;
            // If code is '00000' or not provided, return all (limit 100 for now)
            if (!pCode || pCode === '00000') {
                result = await sql`
                SELECT id, data, created_at 
                FROM auth_history 
                ORDER BY created_at DESC 
                LIMIT 100;
            `;
            } else {
                result = await sql`
                SELECT id, data, created_at 
                FROM auth_history 
                WHERE pharmacy_code = ${pCode} 
                ORDER BY created_at DESC 
                LIMIT 100;
            `;
            }

            // Map back to frontend expected structure. 
            // We stored the whole object in 'data', but maybe we want to ensure 'id' is consistent.
            const history = result.rows.map(row => ({
                ...row.data, // Spread the stored JSON
                id: row.id, // Ensure UUID from DB is used
                timestamp: row.created_at // Ensure server timestamp
            }));

            return response.status(200).json(history);

        } else if (request.method === 'POST') {
            const item = request.body;

            if (!item || !item.pharmacy) {
                return response.status(400).json({ error: 'Invalid data' });
            }

            const pharmacyCode = item.pharmacy.code || 'UNKNOWN';

            // Save the whole item as JSONB
            const result = await sql`
            INSERT INTO auth_history (pharmacy_code, data)
            VALUES (${pharmacyCode}, ${JSON.stringify(item)})
            RETURNING id;
        `;

            return response.status(201).json({ id: result.rows[0].id });
        } else {
            return response.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
