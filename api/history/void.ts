
import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { id, reason, status } = request.body;

    if (!id || !reason) {
        return response.status(400).json({ error: 'Missing id or reason' });
    }

    try {
        // We need to update the JSONB 'data' column to reflect the new status and message
        // Postgres JSONB update is a bit tricky. We want to set data.status and data.message

        // Construct the new Status and Message
        const newStatus = status || 'ANULADA';
        const newMessage = `Anulada: ${reason}`;

        // Update query using jsonb_set or || operator
        // Using || to merge new properties is cleaner in simple cases
        await sql`
        UPDATE auth_history
        SET data = data || jsonb_build_object('status', ${newStatus}, 'message', ${newMessage})
        WHERE id = ${id};
    `;

        return response.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
