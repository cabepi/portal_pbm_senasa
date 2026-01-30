
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { secondaryDb } from '../lib/secondary-db';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') return response.status(405).json({ error: 'Method Not Allowed' });

    try {
        const page = parseInt(request.query.page as string) || 1;
        const limit = parseInt(request.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const sortField = (request.query.sortField as string) || 'fechareceta';
        const sortOrder = (request.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Dynamic Filter Generation
        // Expects `filters` as a JSON string: { "col": "value", "col2": "val2" }
        // Or simple query params? Let's support simple query params for now as "search" 
        // OR specific fields if passed.
        // For simplicity in this iteration, we'll parse a `search` param to search across main fields.

        const search = request.query.search as string;
        let whereClause = "WHERE 1=1";
        const values: any[] = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (
                nombrefarmacia ILIKE $${paramIndex} OR 
                nombreafiliado ILIKE $${paramIndex} OR 
                cedula ILIKE $${paramIndex} OR 
                codautorizacion ILIKE $${paramIndex} OR
                descripcion ILIKE $${paramIndex}
            )`;
            values.push(`%${search}%`);
            paramIndex++;
        }

        // Specific column filters can be added here if needed by parsing other query params
        // Example: ?cedula=402...
        if (request.query.cedula) {
            whereClause += ` AND cedula ILIKE $${paramIndex}`;
            values.push(`%${request.query.cedula}%`);
            paramIndex++;
        }

        // Secure Sort Field (Prevent SQL Injection)
        const allowedSorts = ['fechareceta', 'nombrefarmacia', 'nombreafiliado', 'totalcobertura', 'codautorizacion'];
        const safeSortField = allowedSorts.includes(sortField) ? sortField : 'fechareceta';

        const query = `
            SELECT * 
            FROM dhm 
            ${whereClause} 
            ORDER BY ${safeSortField} ${sortOrder} 
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const countQuery = `SELECT count(*) FROM dhm ${whereClause}`;

        // Run in parallel
        const [rowsResult, countResult] = await Promise.all([
            secondaryDb.query(query, [...values, limit, offset]),
            secondaryDb.query(countQuery, values)
        ]);

        return response.status(200).json({
            data: rowsResult.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page,
                limit,
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });

    } catch (error: any) {
        console.error('Historical Query Error:', error);
        return response.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
