import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, ChevronRight, Database, ArrowUp, ArrowDown, Sparkles, Send, Eye, X, Download } from 'lucide-react';
import '../styles/HistoricalData.css';

interface HistoryRow {
    codautorizacion: string;
    codigofarmacia: string;
    nombrefarmacia: string;
    tipofarmacia: string;
    numeroafiliado: string;
    nombreafiliado: string;
    fechanacimiento: string;
    edad: string;
    sexo: string;
    cedula: string;
    telefono: string;
    doctor: string;
    centro: string;
    simon: string;
    descripcion: string;
    cantidad: string;
    dias: string;
    precio: string;
    facturado: string;
    copago: string;
    totalcobertura: string;
    coberturaplancomplementario: string;
    coberturaplanvolunatario: string;
    coberturaplanpbs: string;
    coberturapyp: string;
    fechareceta: string;
    tiporeceta: string;
    fechadesolicitud: string;
    horasolicitud: string;
    fechadeprocesamiento: string;
    cedulasolicitante: string;
    pasaporte: string;
    licenciadeconducir: string;
    permisodetrabajo: string;
    fechareverso: string;
    motivodereverso: string;
    reversado: string;
    usuariogenerador: string;
    numerorecetapyp: string;
    usuariopyp: string;
    esprogramapyp: string;
}

const SUGGESTIONS = [
    "¿Cuántas recetas de Acetaminofen hay?",
    "¿Cuál es la farmacia con más ventas hoy?",
    "Total autorizado este mes",
    "Listar las últimas 5 anulaciones"
];

const HistoricalData: React.FC = () => {
    // --- Data Grid State ---
    const [data, setData] = useState<HistoryRow[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState({ field: 'fechareceta', order: 'DESC' });
    const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);

    // --- Chat State (Session Storage Persistence) ---
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<any[]>(() => {
        // Load from Session Storage if available
        const saved = sessionStorage.getItem('chat_history');
        if (saved) return JSON.parse(saved);
        return [{ role: 'model', text: 'Hola 👋 Soy tu Analista Inteligente. Puedo consultar los 4 millones de registros por ti. ¿Qué necesitas saber?' }];
    });
    const [chatLoading, setChatLoading] = useState(false);
    const [showChat, setShowChat] = useState(true);

    // Save to Session Storage whenever messages change
    useEffect(() => {
        sessionStorage.setItem('chat_history', JSON.stringify(messages));
    }, [messages]);

    // --- Grid Logic ---
    const fetchData = async () => {
        setLoading(true);
        try {
            // Optimization for High Volume: Don't fetch data to render, just get metadata (count)
            // We use limit=1 to be fast, but we "pretend" the limit is the high one in the UI state
            const effectiveLimit = pagination.limit >= 100000 ? 1 : pagination.limit;

            const res = await axios.get('/api/historical/query', {
                params: {
                    page: pagination.page,
                    limit: effectiveLimit,
                    search,
                    sortField: sort.field,
                    sortOrder: sort.order
                }
            });

            if (pagination.limit >= 100000) {
                setData([]); // Clear data to prevent rendering
            } else {
                setData(res.data.data);
            }

            // Keep the selected limit in pagination state, but update total/pages from response
            setPagination(prev => ({
                ...prev,
                total: res.data.pagination.total,
                totalPages: Math.ceil(res.data.pagination.total / prev.limit) // Recalculate based on requested limit
            }));

            // Update welcome message with real count on first load
            if (messages.length === 1 && messages[0].text.includes('Soy tu Analista')) {
                const realCount = res.data.pagination.total.toLocaleString();
                setMessages([
                    { role: 'model', text: `Hola 👋 Soy tu Analista Inteligente. Puedo consultar los ${realCount} registros por ti. ¿Qué necesitas saber?` }
                ]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [pagination.page, pagination.limit, sort]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination({ ...pagination, page: 1 });
        fetchData();
    };

    const handleSort = (field: string) => {
        setSort(prev => ({
            field,
            order: prev.field === field && prev.order === 'DESC' ? 'ASC' : 'DESC'
        }));
    };

    // --- Chat Logic ---
    const processChat = async (msg: string) => {
        console.log("Processing chat request:", msg);
        if (!msg.trim()) return;
        const userMsg = msg;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput('');
        setChatLoading(true);

        try {
            console.log("Sending POST to /api/historical/chat...");
            // Send history excluding the temporary user message we just added (it's in 'message')
            const previousMessages = messages;
            const res = await axios.post('/api/historical/chat', {
                message: userMsg,
                previousMessages
            });
            console.log("Response received:", res.data);

            setMessages(prev => [...prev, {
                role: 'model',
                text: res.data.text,
                sql: res.data.generatedSql,
                explanation: res.data.explanation
            }]);
        } catch (error: any) {
            console.error("Chat Error:", error);
            const errMsg = error.response?.data?.error || 'Lo siento, tuve un error al consultar los datos.';
            setMessages(prev => [...prev, { role: 'model', text: `⚠️ Error: ${errMsg}` }]);
        } finally {
            setChatLoading(false);
        }
    }

    const [exporting, setExporting] = useState(false);

    const handleExportCSV = async () => {
        let exportData = data;

        // On-demand fetch for High Volume
        if (pagination.limit >= 100000) {
            const confirmExport = window.confirm(`Vas a descargar ${pagination.limit.toLocaleString()} registros. Esto puede tardar varios minutos y consumir mucha memoria. ¿Deseas continuar?`);
            if (!confirmExport) return;

            setExporting(true);
            try {
                const res = await axios.get('/api/historical/query', {
                    params: {
                        page: pagination.page,
                        limit: pagination.limit, // The REAL large limit
                        search,
                        sortField: sort.field,
                        sortOrder: sort.order
                    }
                });
                exportData = res.data.data;
            } catch (error) {
                console.error("Export Fetch Error", error);
                alert("Error al descargar los datos masivos.");
                setExporting(false);
                return;
            } finally {
                setExporting(false);
            }
        }

        if (!exportData || exportData.length === 0) return;

        // 1. Define Headers
        const headers = Object.keys(exportData[0]);

        // 2. Map Data to CSV Rows
        const csvRows = [
            headers.join(';'),
            ...exportData.map(row => {
                return headers.map(header => {
                    const val = row[header as keyof HistoryRow] || '';
                    const escaped = String(val).replace(/"/g, '""');
                    return `"${escaped}"`;
                }).join(';');
            })
        ];

        // 3. Create Blob and Download
        const csvString = csvRows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `data_historica_${new Date().toISOString().split('T')[0]}_limit${pagination.limit}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        processChat(chatInput);
    };

    return (
        <div className="historical-layout">
            {/* Main Content Area */}
            <div className={`main-content ${showChat ? 'shrunk' : ''}`}>
                <header className="page-header">
                    <div>
                        <h1><Database className="icon" size={24} style={{ marginRight: '.5rem' }} /> Data Histórica</h1>
                        <p>
                            {pagination.total > 0
                                ? `Explora el archivo histórico (${pagination.total.toLocaleString()} registros)`
                                : 'Explora el archivo histórico...'}
                        </p>
                    </div>
                    <button
                        className={`btn-ai-toggle ${showChat ? 'active' : ''}`}
                        onClick={() => setShowChat(!showChat)}
                    >
                        <Sparkles size={18} />
                        {showChat ? 'Ocultar Analista' : 'Abrir Analista IA'}
                    </button>
                    <button
                        className="btn-export"
                        onClick={handleExportCSV}
                        disabled={exporting}
                        title="Descargar datos visibles"
                    >
                        {exporting ? <div className="spinner-small" style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div> : <Download size={18} />}
                        {exporting ? 'Descargando...' : 'Exportar CSV'}
                    </button>
                </header>

                <div className="grid-controls">
                    <form onSubmit={handleSearch} className="search-bar">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Filtrar tabla (nombre, cédula, autorización)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </form>
                    <div className="pagination-info">
                        <strong>{pagination.total.toLocaleString()}</strong> registros encontrados
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Ver</th>
                                <th onClick={() => handleSort('codautorizacion')}>Autorización {sort.field === 'codautorizacion' && (sort.order === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}</th>
                                <th onClick={() => handleSort('fechareceta')}>Fecha {sort.field === 'fechareceta' && (sort.order === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}</th>
                                <th>Farmacia</th>
                                <th>Afiliado</th>
                                <th onClick={() => handleSort('simon')}>Cód. Simón {sort.field === 'simon' && (sort.order === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}</th>
                                <th>Descripción</th>
                                <th>Monto</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="loading-cell">Cargando datos...</td></tr>
                            ) : data.map((row, i) => (
                                <tr key={i}>
                                    <td>
                                        <button className="btn-view-details" onClick={() => setSelectedRow(row)} title="Ver detalles completos">
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                    <td className="font-mono">{row.codautorizacion}</td>
                                    <td>{row.fechareceta}</td>
                                    <td>
                                        <div className="cell-title">{row.nombrefarmacia}</div>
                                        <div className="cell-sub">{row.codigofarmacia}</div>
                                    </td>
                                    <td>
                                        <div className="cell-title">{row.nombreafiliado}</div>
                                        <div className="cell-sub">{row.cedula}</div>
                                    </td>
                                    <td className="font-mono" style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                        {row.simon}
                                    </td>
                                    <td>
                                        <div className="cell-title">{row.descripcion}</div>
                                        <div className="cell-sub">Cant: {row.cantidad}</div>
                                    </td>
                                    <td className="font-mono">RD$ {row.totalcobertura}</td>
                                    <td>
                                        {row.reversado === 'S'
                                            ? <span className="status-badge anulada">Anulada</span>
                                            : <span className="status-badge al-dia">Activa</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {pagination.limit >= 100000 && (
                        <div style={{
                            padding: '4rem 2rem',
                            textAlign: 'center',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            marginTop: '1rem',
                            border: '1px dashed #cbd5e1'
                        }}>
                            <Database size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                            <h3 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>Vista Masiva Detectada ({pagination.limit.toLocaleString()} filas)</h3>
                            <p style={{ color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>
                                Para garantizar el rendimiento del navegador, los datos masivos no se muestran en la tabla en pantalla.
                            </p>
                            <p style={{ color: '#64748b', maxWidth: '600px', margin: '1rem auto 0', fontWeight: 500 }}>
                                ℹ️ Puedes visualizar esta información descargando el reporte CSV.<br />
                                El proceso de descarga puede tardar varios minutos.
                            </p>
                        </div>
                    )}
                </div>

                <div className="pagination-controls">
                    <div className="limit-selector" style={{ marginRight: '1rem' }}>
                        <select
                            value={pagination.limit}
                            onChange={(e) => setPagination({ ...pagination, page: 1, limit: parseInt(e.target.value) })}
                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                            <option value={20}>20 por pág.</option>
                            <option value={50}>50 por pág.</option>
                            <option value={100}>100 por pág.</option>
                            <option value={500}>500 por pág.</option>
                            <option value={1000}>1,000 por pág.</option>
                            <option value={10000}>10,000 por pág.</option>
                            <option value={50000}>50,000 por pág.</option>
                            <option value={100000}>100,000 por pág.</option>
                            <option value={500000}>500,000 por pág.</option>
                            <option value={1000000}>1,000,000 por pág.</option>
                        </select>
                    </div>

                    <button
                        disabled={pagination.page === 1}
                        onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span>Página {pagination.page} de {pagination.totalPages || 1}</span>
                    <button
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* AI Analyst Sidebar */}
            <div className={`ai-sidebar ${showChat ? 'visible' : ''}`}>
                <div className="ai-header">
                    <h2><Sparkles size={20} /> Analista Inteligente</h2>
                    <p>Tu experto en datos SQL</p>
                </div>

                <div className="ai-messages">
                    {messages.map((m, idx) => (
                        <div key={idx} className={`ai-msg ${m.role}`}>
                            <div className="bubble">
                                {m.text}
                            </div>
                            {m.sql && (
                                <div className="sql-box">
                                    <div className="sql-label">Consulté esto:</div>
                                    <code>{m.sql}</code>
                                </div>
                            )}
                        </div>
                    ))}
                    {chatLoading && (
                        <div className="ai-msg model">
                            <div className="typing-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="ai-suggestions">
                    {SUGGESTIONS.map((s, i) => (
                        <button key={i} onClick={() => processChat(s)}>
                            {s}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleChatSubmit} className="ai-input">
                    <input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="Pregunta sobre los datos..."
                    />
                    <button type="submit" disabled={!chatInput.trim() || chatLoading}>
                        <Send size={18} />
                    </button>
                </form>
            </div>

            {/* Detail Modal */}
            {selectedRow && (
                <div className="modal-overlay" onClick={() => setSelectedRow(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalle de Autorización</h2>
                            <button onClick={() => setSelectedRow(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-section">
                                <h3>Información General</h3>
                                <div className="detail-grid">
                                    <div className="field">
                                        <label>Autorización</label>
                                        <span>{selectedRow.codautorizacion}</span>
                                    </div>
                                    <div className="field">
                                        <label>Fecha Solicitud</label>
                                        <span>{selectedRow.fechadesolicitud} {selectedRow.horasolicitud}</span>
                                    </div>
                                    <div className="field">
                                        <label>Usuario</label>
                                        <span>{selectedRow.usuariogenerador}</span>
                                    </div>
                                    <div className="field">
                                        <label>Estado</label>
                                        <span>{selectedRow.reversado === 'S' ? 'Anulada' : 'Activa'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3>Afiliado & Receta</h3>
                                <div className="detail-grid">
                                    <div className="field">
                                        <label>Nombre</label>
                                        <span>{selectedRow.nombreafiliado}</span>
                                    </div>
                                    <div className="field">
                                        <label>Cédula</label>
                                        <span>{selectedRow.cedula}</span>
                                    </div>
                                    <div className="field">
                                        <label>NSS / Afiliado</label>
                                        <span>{selectedRow.numeroafiliado}</span>
                                    </div>
                                    <div className="field">
                                        <label>Datos Demográficos</label>
                                        <span>{selectedRow.sexo} | {selectedRow.edad} años | Nac: {selectedRow.fechanacimiento}</span>
                                    </div>
                                    <div className="field">
                                        <label>Doctor</label>
                                        <span>{selectedRow.doctor}</span>
                                    </div>
                                    <div className="field">
                                        <label>Centro</label>
                                        <span>{selectedRow.centro}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3>Farmacia & Medicamento</h3>
                                <div className="detail-grid">
                                    <div className="field">
                                        <label>Farmacia</label>
                                        <span>{selectedRow.nombrefarmacia} ({selectedRow.codigofarmacia})</span>
                                    </div>
                                    <div className="field">
                                        <label>Tipo Farmacia</label>
                                        <span>{selectedRow.tipofarmacia}</span>
                                    </div>
                                    <div className="field col-span-2">
                                        <label>Medicamento</label>
                                        <span>{selectedRow.descripcion}</span>
                                    </div>
                                    <div className="field">
                                        <label>Cód. Simón</label>
                                        <span className="font-mono">{selectedRow.simon}</span>
                                    </div>
                                    <div className="field">
                                        <label>Cantidad</label>
                                        <span>{selectedRow.cantidad}</span>
                                    </div>
                                    <div className="field">
                                        <label>Días Tx</label>
                                        <span>{selectedRow.dias}</span>
                                    </div>
                                    <div className="field">
                                        <label>Fecha Receta</label>
                                        <span>{selectedRow.fechareceta}</span>
                                    </div>
                                    <div className="field">
                                        <label>Tipo Receta</label>
                                        <span>{selectedRow.tiporeceta}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3>Información Adicional del Afiliado / Solicitante</h3>
                                <div className="detail-grid">
                                    <div className="field">
                                        <label>Teléfono</label>
                                        <span>{selectedRow.telefono}</span>
                                    </div>
                                    <div className="field">
                                        <label>Cédula Solicitante</label>
                                        <span>{selectedRow.cedulasolicitante}</span>
                                    </div>
                                    <div className="field">
                                        <label>Pasaporte</label>
                                        <span>{selectedRow.pasaporte}</span>
                                    </div>
                                    <div className="field">
                                        <label>Licencia / Permiso</label>
                                        <span>{selectedRow.licenciadeconducir} {selectedRow.permisodetrabajo}</span>
                                    </div>
                                    <div className="field">
                                        <label>Fecha Procesamiento</label>
                                        <span>{selectedRow.fechadeprocesamiento}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3>Desglose Financiero & PyP</h3>
                                <div className="detail-grid costs">
                                    <div className="field">
                                        <label>Precio Unitario</label>
                                        <span>RD$ {selectedRow.precio}</span>
                                    </div>
                                    <div className="field">
                                        <label>Total Facturado</label>
                                        <span>RD$ {selectedRow.facturado}</span>
                                    </div>
                                    <div className="field">
                                        <label>Copago Afiliado</label>
                                        <span>RD$ {selectedRow.copago}</span>
                                    </div>
                                    <div className="field highlight">
                                        <label>Cobertura Total</label>
                                        <span>RD$ {selectedRow.totalcobertura}</span>
                                    </div>
                                </div>
                                <div className="detail-grid small-text">
                                    <div className="field"><label>Plan Comp.</label><span>{selectedRow.coberturaplancomplementario}</span></div>
                                    <div className="field"><label>Plan Vol.</label><span>{selectedRow.coberturaplanvolunatario}</span></div>
                                    <div className="field"><label>PBS</label><span>{selectedRow.coberturaplanpbs}</span></div>
                                    <div className="field"><label>PyP</label><span>{selectedRow.coberturapyp}</span></div>
                                </div>

                                {selectedRow.esprogramapyp === 'S' && (
                                    <div className="detail-grid" style={{ marginTop: '1rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                                        <div className="field"><label>Programa PyP</label><span>Sí</span></div>
                                        <div className="field"><label>Receta PyP</label><span>{selectedRow.numerorecetapyp}</span></div>
                                        <div className="field"><label>Usuario PyP</label><span>{selectedRow.usuariopyp}</span></div>
                                    </div>
                                )}
                            </div>

                            {selectedRow.reversado === 'S' && (
                                <div className="detail-section alert">
                                    <h3>Información de Reverso</h3>
                                    <div className="detail-grid">
                                        <div className="field">
                                            <label>Fecha Reverso</label>
                                            <span>{selectedRow.fechareverso}</span>
                                        </div>
                                        <div className="field">
                                            <label>Motivo</label>
                                            <span>{selectedRow.motivodereverso}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoricalData;
