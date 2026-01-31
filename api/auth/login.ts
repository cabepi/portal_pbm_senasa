
import { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { allowCors } from '../lib/cors';

const handler = async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET!,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            token,
            user: {
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export default allowCors(handler);
