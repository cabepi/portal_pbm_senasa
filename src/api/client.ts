import axios from 'axios';
import { ensureToken, fetchToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    async (config) => {
        // Skip auth for oauth endpoints if any (though we used separate call in auth.ts)
        if (config.url?.includes('/oauth/token')) {
            return config;
        }

        try {
            const token = await ensureToken();
            config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.error('Could not attach token', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                await fetchToken(); // Force refresh
                const token = await ensureToken();
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);
