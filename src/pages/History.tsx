import { useEffect, useState } from 'react';
import { FileText, Ban, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { drugsApi } from '../api/endpoints';
import { usePharmacy } from '../contexts/PharmacyContext';
import type { HistoryItem } from '../types';

export const HistoryPage = () => {
    const { selectedPharmacy } = usePharmacy();
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // Void State
    const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
    const [selectedAuth, setSelectedAuth] = useState<HistoryItem | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voidLoading, setVoidLoading] = useState(false);
    const [voidError, setVoidError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Determine parameter
                let url = '/api/history';
                if (selectedPharmacy && selectedPharmacy.code !== '00000') {
                    url += `?pharmacyCode=${selectedPharmacy.code}`;
                }

                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    setHistory(data);
                }
            } catch (e) {
                console.error('Failed to fetch history', e);
            }
        };

        fetchHistory();
    }, [selectedPharmacy]);

    const handleVoidClick = (item: HistoryItem) => {
        setSelectedAuth(item);
        setVoidReason('');
        setVoidError(null);
        setSuccessMessage(null);
        setIsVoidModalOpen(true);
    };

    const confirmVoid = async () => {
        if (!selectedAuth || !voidReason.trim()) return;

        setVoidLoading(true);
        setVoidError(null);

        try {
            // 1. Call External API
            const result = await drugsApi.void({
                authorization_code: selectedAuth.authorizationCode || '',
                pharmacy_code: selectedPharmacy?.code || '0',
                reason: voidReason
            });

            // Check resulting status
            if (result.status === 'COMPLETED' || result.status === 'ANULADA' || result.status === 'VOIDED') {
                const newStatus = result.status === 'COMPLETED' ? 'ANULADA' : result.status;

                // 2. Update Database via our Serverless Function
                await fetch('/api/history/void', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: selectedAuth.id,
                        reason: voidReason,
                        status: newStatus
                    })
                });

                // 3. Update UI state locally to reflect change immediately
                const updatedHistory = history.map(item =>
                    item.id === selectedAuth.id
                        ? { ...item, status: newStatus, message: `Anulada: ${voidReason}` }
                        : item
                );
                setHistory(updatedHistory);

                setSuccessMessage('Autorización anulada correctamente.');

                setTimeout(() => {
                    setIsVoidModalOpen(false);
                    setSuccessMessage(null);
                    setSelectedAuth(null);
                }, 2000);
            } else if (result.status === 'ERROR') {
                setVoidError(result.error || result.message || 'Error al anular la autorización.');
            } else {
                // Fallback for other statuses
                setVoidError(`La anulación terminó con estado: ${result.status}`);
            }

        } catch (e: any) {
            setVoidError(e.message || 'Error de comunicación al anular.');
        } finally {
            setVoidLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <FileText className="text-accent" size={32} />
                    <h2 style={{ margin: 0 }}>Historial de Autorizaciones</h2>
                </div>
                {selectedPharmacy && (
                    <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Mostrando registros de: <strong style={{ color: 'var(--text-primary)' }}>{selectedPharmacy.name}</strong>
                    </div>
                )}
                <Link to="/consultar" className="btn-primary" style={{ textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                    &larr; Nueva Consulta
                </Link>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', overflowX: 'auto' }}>
                {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <p>No hay registros de autorizaciones para la farmacia seleccionada.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Fecha / Hora</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Farmacia</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Cédula</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Afiliado</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Medicamentos</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Estado</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Código Autorización</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>

                            {history.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                        <div style={{ fontWeight: 500 }}>
                                            {new Date(item.timestamp).toLocaleDateString('en-GB').replace(/\//g, '-')}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            {new Date(item.timestamp).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>
                                        {item.pharmacy ? (
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{item.pharmacy.code}</span>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.pharmacy.name}
                                                </div>
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                        {item.identification}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 500, minWidth: '180px' }}>
                                        {item.beneficiaryName}
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', minWidth: '220px' }}>
                                        {item.drugs && item.drugs.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {item.drugs.map((d, i) => (
                                                    <div key={i} style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                                                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                            {d.code} {d.quantity ? `(x${d.quantity})` : ''}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                            {d.message}
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                                                            <div>
                                                                <span style={{ color: 'var(--text-secondary)' }}>Monto:</span>
                                                                <div style={{ fontWeight: 500 }}>${d.authorizedAmount?.toFixed(2) || '0.00'}</div>
                                                            </div>
                                                            <div>
                                                                <span style={{ color: 'var(--text-secondary)' }}>Copago:</span>
                                                                <div style={{ fontWeight: 500 }}>${d.copaymentAmount?.toFixed(2) || '0.00'}</div>
                                                            </div>
                                                            <div>
                                                                <span style={{ color: 'var(--text-secondary)' }}>Total:</span>
                                                                <div style={{ fontWeight: 500 }}>${d.invoiceTotal?.toFixed(2) || '0.00'}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            background: item.status === 'ERROR' ? 'rgba(239, 68, 68, 0.1)' : (item.status === 'ANULADA' ? 'rgba(100, 116, 139, 0.2)' : 'rgba(16, 185, 129, 0.1)'),
                                            color: item.status === 'ERROR' ? '#dc2626' : (item.status === 'ANULADA' ? '#94a3b8' : '#059669')
                                        }}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {item.authorizationCode || '-'}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {item.status === 'COMPLETED' && item.authorizationCode && (
                                            <button
                                                onClick={() => handleVoidClick(item)}
                                                className="btn-primary"
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#ef4444',
                                                    padding: '0.4rem 0.8rem',
                                                    fontSize: '0.85rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title="Anular Autorización"
                                            >
                                                <Ban size={14} />
                                                Anular
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Void Modal */}
            {isVoidModalOpen && selectedAuth && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ width: '90%', maxWidth: '450px', padding: '2rem', background: 'var(--bg-primary)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={24} />
                                Anular Autorización
                            </h3>
                            <button
                                onClick={() => setIsVoidModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {successMessage ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                <CheckCircle size={48} className="text-accent" style={{ margin: '0 auto 1rem' }} />
                                <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{successMessage}</div>
                            </div>
                        ) : (
                            <>
                                <p style={{ marginBottom: '1.5rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                                    ¿Está seguro que desea anular la autorización <strong>{selectedAuth.authorizationCode}</strong>?
                                    Esta acción no se puede deshacer.
                                </p>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Motivo de Anulación <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <textarea
                                        className="glass-input"
                                        rows={3}
                                        value={voidReason}
                                        onChange={(e) => setVoidReason(e.target.value)}
                                        placeholder="Ingrese la razón..."
                                        style={{ background: 'var(--bg-secondary)' }}
                                    />
                                </div>

                                {voidError && (
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                        {voidError}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setIsVoidModalOpen(false)}
                                        className="btn-primary"
                                        style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                                        disabled={voidLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmVoid}
                                        className="btn-primary"
                                        style={{ background: '#dc2626', borderColor: '#b91c1c', color: 'white' }}
                                        disabled={voidLoading || !voidReason.trim()}
                                    >
                                        {voidLoading ? 'Anulando...' : 'Confirmar Anulación'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
