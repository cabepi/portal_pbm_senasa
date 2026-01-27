import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { beneficiariesApi, drugsApi } from '../api/endpoints';
import { usePharmacy } from '../contexts/PharmacyContext';
import { MedicationSelector } from '../components/ui/MedicationSelector';
import medicationsData from '../data/medications.json';
import type { Beneficiary, MedicationModel, AuthorizeMedicationResponse } from '../types';
import { Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Consultation = () => {
    const [step, setStep] = useState<'consult' | 'authorize' | 'result'>('consult');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Consult State
    const [idNumber, setIdNumber] = useState('');
    const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);

    // Auth State
    const [medications, setMedications] = useState<MedicationModel[]>([]);
    const [newMed, setNewMed] = useState({ code: '', quantity: 1, price: 0 });
    const [authResult, setAuthResult] = useState<AuthorizeMedicationResponse | null>(null);

    // Config
    const { selectedPharmacy, setIsLocked } = usePharmacy();
    const pharmacyCode = selectedPharmacy?.code || '0';
    const [refNumber] = useState('200');

    // Lock pharmacy selector when in authorization or result step
    useEffect(() => {
        if (step === 'authorize' || step === 'result') {
            setIsLocked(true);
        } else {
            setIsLocked(false);
        }
        return () => setIsLocked(false);
    }, [step, setIsLocked]);

    const handleConsult = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        // Do NOT clear beneficiary here so we can keep showing it if we want, 
        // but typically a new search implies clearing old results first.
        setBeneficiary(null);

        try {
            const result = await beneficiariesApi.search({
                identification_number: idNumber,
                identification_type: 'NATIONAL_IDENTIFICATION_NUMBER'
            });

            // Note: If result comes back 202, we might not have data immediately. 
            // For now assuming direct return or "data" field wrapper based on previous Postman vs Swagger ambiguity.
            // We'll treat 'result' as the beneficiary object for now.
            if (result) {
                // If the response is wrapped in { result: ... } or { data: ... } 
                const data = result.result || result.data || result;

                // Check for explicit error status in the response
                if (data.status === 'ERROR') {
                    setError(data.error || 'Error desconocido al consultar el afiliado.');
                    setBeneficiary(null);
                } else {
                    setBeneficiary(data);
                }
            } else {
                setError('No se pudo obtener información del afiliado.');
            }
        } catch (err: any) {
            setError(err.message || 'Error al consultar. Verifique los datos.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const startAuthorization = () => {
        setStep('authorize');
    };

    const addMedication = () => {
        if (newMed.code && newMed.quantity > 0 && newMed.price > 0) {
            const medInfo = medicationsData.find((m: any) => m.code === newMed.code);
            const name = medInfo ? medInfo.name : 'Desconocido';

            setMedications([...medications, {
                code: newMed.code,
                quantity: newMed.quantity,
                price: newMed.price,
                name: name
            }]);
            setNewMed({ code: '', quantity: 1, price: 0 });
        }
    };

    const removeMedication = (index: number) => {
        setMedications(medications.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return medications.reduce((sum, med) => sum + (med.quantity * med.price), 0);
    };

    const handleAuthorize = async () => {
        if (!beneficiary) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Prepare Payload
            const contract = beneficiary.affiliated_number?.toString() || '0';
            const payload = {
                pharmacy_code: pharmacyCode,
                affiliate_contract: contract,
                pyp_program_code: 0,
                external_authorization: `NUM_REF_FARMACIA_${pharmacyCode}_${refNumber}`,
                drugs: medications.map(m => ({
                    code: m.code,
                    quantity: m.quantity,
                    price: m.price
                }))
            };

            // 2. Validation Step
            try {
                await drugsApi.validate({
                    pharmacy_code: payload.pharmacy_code,
                    affiliate_contract: payload.affiliate_contract,
                    pyp_program_code: payload.pyp_program_code,
                    drugs: payload.drugs
                });
            } catch (validateErr: any) {
                console.error("Validation error", validateErr);
                if (validateErr.response && validateErr.response.data && validateErr.response.data.details) {
                    const details = validateErr.response.data.details;
                    const errorMsg = details.map((d: any) => `${d.field}: ${d.error}`).join('\n');
                    throw new Error(`Error de validación:\n${errorMsg}`);
                }
                throw validateErr; // Rethrow to be caught by outer catch
            }

            // 3. Claim (Async Monitor)
            const result = await drugsApi.claim(payload);
            setAuthResult(result);
            setStep('result');

            // 4. Save to Session History
            try {
                const historyItem = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    beneficiaryName: `${beneficiary.name} ${beneficiary.last_name}`,
                    identification: beneficiary.national_identification_number,
                    status: result.status || (result.estado ? result.estado : 'UNKNOWN'),
                    message: result.message || result.mensaje || result.error || 'Sin mensaje',
                    authorizationCode: result.result?.authorization_code || result.authorization_code,
                    pharmacy: selectedPharmacy || { code: 'Unknown', name: 'Unknown' },
                    drugs: result.result?.drugs?.map((d: any) => ({
                        code: d.drug_code,
                        message: d.message || 'Sin mensaje',
                        quantity: 0,
                        authorizedAmount: d.authorized_amount,
                        copaymentAmount: d.copayment_amount,
                        invoiceTotal: d.invoice_total
                    })) || medications.map(m => ({
                        code: m.code,
                        message: 'Solicitado',
                        quantity: m.quantity,
                        authorizedAmount: 0,
                        copaymentAmount: 0,
                        invoiceTotal: 0
                    }))
                };

                const storedHistory = localStorage.getItem('auth_history');
                const historyList = storedHistory ? JSON.parse(storedHistory) : [];
                historyList.push(historyItem);
                localStorage.setItem('auth_history', JSON.stringify(historyList));
            } catch (e) {
                console.error("Failed to save history", e);
            }

        } catch (err: any) {
            setError(err.message || 'Error procesando la autorizacion.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Remove all non-digits
        let val = e.target.value.replace(/\D/g, '');

        // Enforce max length of 11 digits (masked length will be 13)
        if (val.length > 11) val = val.slice(0, 11);

        // Apply mask: 000-0000000-0
        if (val.length > 3 && val.length <= 10) {
            val = `${val.slice(0, 3)}-${val.slice(3)}`;
        } else if (val.length > 10) {
            val = `${val.slice(0, 3)}-${val.slice(3, 10)}-${val.slice(10)}`;
        }

        setIdNumber(val);
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <AnimatePresence mode="wait">
                {step === 'consult' && (
                    <motion.div
                        key="consult"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel"
                        style={{ padding: '2rem' }}
                    >
                        <h2 style={{ marginTop: 0 }}>Consultar Afiliado</h2>
                        <form onSubmit={handleConsult}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    Numero de Identificacion
                                </label>
                                <input
                                    type="text"
                                    className="glass-input"
                                    placeholder="000-0000000-0"
                                    value={idNumber}
                                    onChange={handleIdChange}
                                    maxLength={13}
                                    required
                                />
                            </div>

                            {error && (
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <AlertCircle size={20} />
                                    {error}
                                </div>
                            )}

                            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                                {loading ? 'Consultando...' : 'Buscar Afiliado'}
                            </button>
                        </form>

                        {/* Results Grid */}
                        {beneficiary && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}
                            >
                                <h3 className="text-accent" style={{ marginTop: 0 }}>Resultados de la Búsqueda</h3>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '1rem',
                                    marginBottom: '2rem'
                                }}>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nombre</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.name} {beneficiary.last_name}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cédula</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.national_identification_number}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>NSS</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.social_security_number}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Fecha de Nacimiento</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.birth_date}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Género</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.gender}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Teléfono</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.phone_number}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Régimen</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.regime}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Estado</div>
                                        <div style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{beneficiary.status}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cód. Familiar</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.family_code}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cód. Persona</div>
                                        <div style={{ fontWeight: 600 }}>{beneficiary.person_code}</div>
                                    </div>
                                </div>

                                {/* Plan Details Section */}
                                {beneficiary.drugs_plan_list && beneficiary.drugs_plan_list.length > 0 && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Detalle del Plan</h4>
                                        {beneficiary.drugs_plan_list.map((plan, idx) => (
                                            <div key={idx} style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{plan.plan_name} ({plan.plan_type})</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                                                    <div>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Monto Max:</span> ${plan.max_amount}
                                                    </div>
                                                    <div>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Disponible:</span> ${plan.available_amount}
                                                    </div>
                                                    <div>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Copago:</span> {plan.copayment * 100}%
                                                    </div>
                                                    <div>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Renovación:</span> {plan.renewal_date.split('T')[0]}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* PyP Program Details Section */}
                                {beneficiary.pyp_program_list && beneficiary.pyp_program_list.length > 0 && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Programas PyP</h4>
                                        <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <thead>
                                                    <tr style={{ background: 'rgba(0,0,0,0.05)', textAlign: 'left' }}>
                                                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Cód. Programa</th>
                                                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Programa</th>
                                                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Grupo</th>
                                                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Cód. Grupo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {beneficiary.pyp_program_list.map((prog, idx) => (
                                                        <tr key={idx} style={{ borderTop: '1px solid var(--glass-border)' }}>
                                                            <td style={{ padding: '0.75rem 1rem' }}>{prog.program_code}</td>
                                                            <td style={{ padding: '0.75rem 1rem' }}>{prog.program || '-'}</td>
                                                            <td style={{ padding: '0.75rem 1rem' }}>{prog.group || '-'}</td>
                                                            <td style={{ padding: '0.75rem 1rem' }}>{prog.group_code}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={startAuthorization}
                                    className="btn-primary"
                                    style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)' }} // Greenish for action
                                >
                                    Crear Autorización de Medicamentos &rarr;
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {step === 'authorize' && beneficiary && (
                    <motion.div
                        key="authorize"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel"
                        style={{ padding: '2rem' }}
                    >
                        <div className="flex-between" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{beneficiary.name} {beneficiary.last_name}</h2>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Contrato: {beneficiary.affiliated_number}
                                </div>
                            </div>
                            <div className="text-accent" style={{ fontWeight: 'bold' }}>
                                {beneficiary.status}
                            </div>
                        </div>

                        <h3 style={{ marginBottom: '1rem' }}>Medicamentos</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 1fr auto', gap: '1rem', marginBottom: '1rem', alignItems: 'start' }}>
                            <MedicationSelector
                                value={newMed.code}
                                onChange={code => setNewMed({ ...newMed, code })}
                            />
                            <input
                                type="number"
                                className="glass-input"
                                placeholder="Cant"
                                value={newMed.quantity}
                                onChange={e => setNewMed({ ...newMed, quantity: parseInt(e.target.value) || 0 })}
                                style={{ height: '42px' }} // Match selector height roughly
                            />
                            <input
                                type="number"
                                className="glass-input"
                                placeholder="Precio"
                                value={newMed.price}
                                onChange={e => setNewMed({ ...newMed, price: parseFloat(e.target.value) || 0 })}
                                style={{ height: '42px' }}
                            />
                            <button
                                type="button"
                                onClick={addMedication}
                                className="btn-primary"
                                style={{ aspectRatio: '1', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '42px' }}
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {medications.length > 0 && (
                            <>
                                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden', marginBottom: '2rem' }}>
                                    {medications.map((med, idx) => (
                                        <div key={idx} style={{
                                            display: 'grid', gridTemplateColumns: '3fr 0.8fr 1fr auto', gap: '1rem', padding: '0.8rem',
                                            borderBottom: '1px solid var(--glass-border)', alignItems: 'center'
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{med.code}</span>
                                                {med.name && <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>- {med.name}</span>}
                                            </div>
                                            <span>{med.quantity}</span>
                                            <span>${med.price.toFixed(2)}</span>
                                            <button
                                                onClick={() => removeMedication(idx)}
                                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: 'bold', marginBottom: '2rem', fontSize: '1.2rem' }}>
                                    Total: ${calculateTotal().toFixed(2)}
                                </div>
                            </>
                        )}

                        <div className="flex-between">
                            <button onClick={() => setStep('consult')} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                                &larr; Volver
                            </button>
                            <button onClick={handleAuthorize} className="btn-primary" disabled={loading || medications.length === 0}>
                                {loading ? 'Procesando...' : 'Autorizar'}
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 'result' && authResult && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel"
                        style={{ padding: '3rem', textAlign: 'center' }}
                    >
                        {authResult.status === 'ERROR' ? (
                            <>
                                <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', marginBottom: '1rem' }}>
                                    <AlertCircle size={64} style={{ color: '#ef4444' }} />
                                </div>
                                <h2 style={{ color: '#ef4444' }}>Error en la Solicitud</h2>

                                <div style={{ marginBottom: '2rem', textAlign: 'left', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Código</th>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Detalle del Error</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Support for structured details if available, or fallback to single error string */}
                                            {Array.isArray(authResult.details) ? (
                                                authResult.details.map((d: any, i: number) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                        <td style={{ padding: '1rem' }}>{d.field || d.code || '-'}</td>
                                                        <td style={{ padding: '1rem' }}>{d.error || d.message}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                    <td style={{ padding: '1rem' }}>{authResult.error_code || 'ERR'}</td>
                                                    <td style={{ padding: '1rem' }}>{authResult.error || authResult.message || 'Error desconocido'}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={64} className="text-accent" style={{ marginBottom: '1rem' }} />
                                <h2>Solicitud Procesada</h2>
                                <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                    Estado: <strong className="text-accent">{authResult.estado || authResult.status || 'Enviado'}</strong>
                                </p>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    {authResult.mensaje || authResult.message || 'La autorización ha sido procesada correctamente.'}
                                </p>
                            </>
                        )}

                        {authResult.monitorLink && (
                            <div style={{ marginTop: '2rem' }}>
                                <a href={authResult.monitorLink} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none' }}>
                                    Ver en Monitor
                                </a>
                            </div>
                        )}

                        <button onClick={() => { setStep('consult'); setBeneficiary(null); setMedications([]); }} style={{ marginTop: '2rem', display: 'block', width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'inherit', borderRadius: '8px', cursor: 'pointer' }}>
                            Nueva Consulta
                        </button>

                        <div style={{ marginTop: '1rem' }}>
                            <Link to="/historial" style={{ color: 'var(--text-secondary)', textDecoration: 'underline', fontSize: '0.9rem' }}>
                                Ver Historial de Solicitudes
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
