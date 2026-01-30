import type { VercelRequest, VercelResponse } from '@vercel/node';
import { allowCors } from '../lib/cors';

async function handler(req: VercelRequest, res: VercelResponse) {
    return res.status(200).json({
        status: 'ok',
        message: 'Pong! API is alive.',
        timestamp: new Date().toISOString()
    });
}

export default allowCors(handler);
