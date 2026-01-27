import axios from 'axios';
import type { AuthResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const USERNAME = import.meta.env.VITE_AUTH_USERNAME;
const PASSWORD = import.meta.env.VITE_AUTH_PASSWORD;
const API_KEY = import.meta.env.VITE_API_KEY;

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

export const getAccessToken = (): string | null => accessToken;

export const fetchToken = async (): Promise<string> => {
    try {
        const response = await axios.post<AuthResponse>(
            `${API_BASE_URL}/oauth/token`,
            null,
            {
                params: {
                    grant_type: 'client_credentials',
                },
                auth: {
                    username: USERNAME,
                    password: PASSWORD,
                },
                headers: {
                    'x-api-key': API_KEY,
                },
            }
        );

        accessToken = response.data.access_token;
        // Set expiry slightly before actual expiry to be safe (e.g., -60s)
        if (response.data.expires_in) {
            tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
        }

        return accessToken;
    } catch (error) {
        console.error('Failed to fetch token', error);
        throw error;
    }
};

export const ensureToken = async (): Promise<string> => {
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }
    return fetchToken();
};
