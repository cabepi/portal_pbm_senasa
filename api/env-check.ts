
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(request: VercelRequest, response: VercelResponse) {
    // Return status of critical variables without revealing values
    const envStatus = {
        POSTGRES_URL: !!process.env.POSTGRES_URL,
        VITE_API_BASE_URL: !!process.env.VITE_API_BASE_URL,
        VITE_AUTH_USERNAME: !!process.env.VITE_AUTH_USERNAME,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV, // 'production', 'preview', or 'development'
    };

    return response.status(200).json(envStatus);
}
