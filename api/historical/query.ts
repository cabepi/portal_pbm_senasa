import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

// --- Shared Logic Inlined for Vercel Reliability ---
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

const secondaryDb = {
    query: (text: string, params?: any[]) => pool.query(text, params),
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
    // --- CORS Headers ---
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    // ---------------------

    if (request.method !== 'GET') return response.status(405).json({ error: 'Method Not Allowed' });

    try {
        const page = parseInt(request.query.page as string) || 1;
        const limit = parseInt(request.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const sortField = (request.query.sortField as string) || 'fechareceta';
        const sortOrder = (request.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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
                descripcion ILIKE $${paramIndex} OR
                simon ILIKE $${paramIndex}
            )`;
            values.push(`%${search}%`);
            paramIndex++;
        }

        if (request.query.cedula) {
            whereClause += ` AND cedula ILIKE $${paramIndex}`;
            values.push(`%${request.query.cedula}%`);
            paramIndex++;
        }

        const allowedSorts = ['fechareceta', 'nombrefarmacia', 'nombreafiliado', 'totalcobertura', 'codautorizacion'];
        const safeSortField = allowedSorts.includes(sortField) ? sortField : 'fechareceta';

        const table = (request.query.table as string) || 'dhm';

        // STRICT SECURITY CHECK: Allow only specific table names
        const allowedTables = ['dhm', 'dhm2'];
        if (!allowedTables.includes(table)) {
            return response.status(400).json({ error: 'Invalid table parameter' });
        }

        const query = `
            SELECT * 
            FROM ${table} 
            ${whereClause} 
            ORDER BY ${safeSortField} ${sortOrder} 
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const countQuery = `SELECT count(*) FROM ${table} ${whereClause}`;

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
