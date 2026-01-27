import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export const Home = () => {
    return (
        <div style={{ textAlign: 'center', marginTop: '4rem' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                Bienvenido al Portal <span className="text-accent">PBM SeNaSa</span>
            </h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
                Sistema de gestion de autorizaciones de medicamentos.
            </p>

            <Link to="/consultar" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                <ShieldCheck /> Iniciar Consulta
                <ArrowRight size={20} />
            </Link>
        </div>
    );
};
