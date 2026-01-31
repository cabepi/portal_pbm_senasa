
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

interface TokenPayload {
    exp: number;
    email: string;
    name: string;
}

const ProtectedRoute: React.FC = () => {
    const token = localStorage.getItem('token');

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    try {
        const decoded = jwtDecode<TokenPayload>(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return <Navigate to="/login" replace />;
        }

        return <Outlet />;

    } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return <Navigate to="/login" replace />;
    }
};

export default ProtectedRoute;
