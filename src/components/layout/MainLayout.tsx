import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck, Home, Search, Database, LogOut } from 'lucide-react';
import { PharmacySelector } from '../ui/PharmacySelector';
import { ChatAssistant } from '../Chat/ChatAssistant';

export const MainLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'inherit', fontWeight: 'bold' }}>
                                <Database size={18} /> Data Histórica
                            </div>
                            <Link to="/data-historica?source=dhm" style={{ marginLeft: '1.5rem', fontSize: '0.85rem', color: 'inherit', textDecoration: 'none', opacity: 0.8 }}>
                                • Enero 30 del 2026
                            </Link>
                            <Link to="/data-historica?source=dhm2" style={{ marginLeft: '1.5rem', fontSize: '0.85rem', color: 'inherit', textDecoration: 'none', opacity: 0.8 }}>
                                • Febrero 02 del 2026
                            </Link>
                        </div>
                        <Link to="/historial" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Activity size={18} /> Historial
                        </Link>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: 0
                            }}
                            title="Cerrar Sesión"
                        >
                            <LogOut size={18} /> Salir
                        </button>
                    </div>
                </div>
            </nav>

            <main className="container" style={{ paddingTop: '2rem' }}>
                <Outlet key={location.pathname + location.search} />
            </main>

            {/* Hide global generic chatbot on Historical Data page to avoid confusion with specialized SQL Agent */}
            {location.pathname !== '/data-historica' && <ChatAssistant />}
        </div>
    );
};
