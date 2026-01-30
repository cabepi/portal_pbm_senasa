import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Helper to handle CORS in Vercel Serverless Functions.
 * Call this at the start of your handler.
 * If it returns true, execution should stop (OPTIONS request or error).
 */
export function allowCors(fn: Function) {
    return async (req: VercelRequest, res: VercelResponse) => {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
        );

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        return await fn(req, res);
    };
}
