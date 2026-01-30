import { Link, Outlet, useLocation } from 'react-router-dom';
import { Activity, ShieldCheck, Home, Search, Database } from 'lucide-react';
import { PharmacySelector } from '../ui/PharmacySelector';
import { ChatAssistant } from '../Chat/ChatAssistant';

export const MainLayout = () => {
    const location = useLocation();
    return (
        <div className="min-h-screen">
            <nav className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, position: 'sticky', top: 0, zIndex: 1000 }}>
                <div className="container flex-between" style={{ padding: '1rem 2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Activity className="text-accent" size={28} />
                        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>PBM SeNaSa Portal</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <div style={{ marginRight: '1rem' }}>
                            {location.pathname !== '/data-historica' && <PharmacySelector />}
                        </div>
                        <Link to="/" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Home size={18} /> Inicio
                        </Link>
                        <Link to="/consultar" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShieldCheck size={18} /> Consultar Afiliado
                        </Link>
                        <Link to="/consultar-solicitudes" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Search size={18} /> Consultar Solicitudes
                        </Link>
                        <Link to="/data-historica" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Database size={18} /> Data Histórica
                        </Link>
                        <Link to="/historial" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Activity size={18} /> Historial
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="container" style={{ paddingTop: '2rem' }}>
                <Outlet />
            </main>

            {/* Hide global generic chatbot on Historical Data page to avoid confusion with specialized SQL Agent */}
            {location.pathname !== '/data-historica' && <ChatAssistant />}
        </div>
    );
};
