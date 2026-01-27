import { useState } from 'react';
import { Search, FileText, AlertCircle } from 'lucide-react';
import { drugsApi } from '../api/endpoints';

export const ClaimSearchPage = () => {
    const [authCode, setAuthCode] = useState('');
    const [extAuth, setExtAuth] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authCode || !extAuth) {
            setError('Por favor complete ambos campos.');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await drugsApi.search(authCode, extAuth);
            // Handle wrapped response from monitor logic or direct API
            const finalResult = data.result && data.status === 'COMPLETED' ? data.result : data;
            setResult(finalResult);
        } catch (err: any) {
            console.error('Search error', err);
            setError(err.response?.data?.message || err.message || 'Error al buscar la solicitud.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Search className="text-accent" size={32} />
                    <h2 style={{ margin: 0 }}>Consultar Solicitudes</h2>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '2rem', alignItems: 'end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Código de Autorización</label>
                        <input
                            type="text"
                            className="glass-input"
                            value={authCode}
                            onChange={(e) => setAuthCode(e.target.value)}
                            placeholder="Ej: 01"
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Autorización Externa</label>
                        <input
                            type="text"
                            className="glass-input"
                            value={extAuth}
                            onChange={(e) => setExtAuth(e.target.value)}
                            placeholder="Ej: 02"
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ height: '42px', minWidth: '120px' }}
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>
                {error && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '0.5rem',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}
            </div>

            {result && (
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: result.status === 'ERROR' ? '#dc2626' : 'var(--primary-color)' }}>
                        {result.status === 'ERROR' ? <AlertCircle size={24} /> : <FileText size={24} />}
                        <h3 style={{ margin: 0 }}>{result.status === 'ERROR' ? 'Error en la Solicitud' : 'Resultados de la Búsqueda'}</h3>
                    </div>

                    {result.status === 'ERROR' ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '0.5rem' }}>
                                    {result.status}
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                    {result.error || 'Ocurrió un error desconocido.'}
                                </div>
                                {result.error_code && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                        Código: {result.error_code}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Detailed Result View (Success)
                        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}>
                            {/* Header Info */}
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Autorización Externar</div>
                                    <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{result.external_authorization}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Código Autorización</div>
                                    <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '1.1rem', wordBreak: 'break-word' }}>{result.authorization_code}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Estado</div>
                                    <div style={{
                                        fontWeight: 600,
                                        color: result.status === 'Cerrada' || result.status === 'COMPLETED' ? 'var(--accent-color)' : '#eab308'
                                    }}>
                                        {result.status}
                                    </div>
                                </div>
                            </div>

                            {/* Financials Highlight */}
                            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Factura</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${result.invoice_total?.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Monto Copago</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${result.copayment_amount?.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Coverage Details Table */}
                            <div style={{ padding: '1.5rem' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Detalle de Cobertura</h4>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Código</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Cant</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Precio</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Auth Basica</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Auth Compl</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Copago</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Auth</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.coverage?.map((item: any, idx: number) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{item.drug_code}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{item.quantity}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${item.price?.toFixed(2)}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${item.basic_authorized_amount?.toFixed(2)}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${item.complementary_authorized_amount?.toFixed(2)}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${item.copayment_amount?.toFixed(2)}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--accent-color)' }}>${item.total_authorized_amount?.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
