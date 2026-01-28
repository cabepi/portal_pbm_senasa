import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Loader2, Pill } from 'lucide-react';

// Omit 'qty' and 'price' from standard selection, we just need code/name
interface MedicationItem {
    code: string;
    name: string;
}

interface Props {
    value: string;
    onChange: (med: MedicationItem | null) => void;
}

export const MedicationSelector = ({ value, onChange }: Props) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [medications, setMedications] = useState<MedicationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial selected medication details
    const [selectedMed, setSelectedMed] = useState<MedicationItem | null>(null);

    // Load initial name if value is provided? We might need an effect or just rely on manual selection.
    // For now, if value is set, we might not know the name until we fetch. 
    // Optimization: If value is set but no selectedMed, fetch details specifically? 
    // We'll skip complex initial load for now as usually user selects it.

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Focus input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Fetch medications
    useEffect(() => {
        const fetchMedications = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/medications?search=${encodeURIComponent(searchTerm)}`);
                if (response.ok) {
                    const data = await response.json();
                    setMedications(data);
                }
            } catch (error) {
                console.error("Failed to fetch medications", error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            if (isOpen) {
                fetchMedications();
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm, isOpen]);

    const handleSelect = (med: MedicationItem) => {
        onChange(med);
        setSelectedMed(med);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Clear selection helper
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSelectedMed(null);
    };

    const placeholder = value ? (selectedMed ? `${selectedMed.code} - ${selectedMed.name}` : value) : "Buscar Medicamento...";

    return (
        <div className="relative" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    width: '100%',
                    height: '42px' // Match text inputs
                }}
            >
                <Search size={16} className="text-slate-400" />
                <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedMed ? (
                        <span style={{ fontWeight: 500 }}>{selectedMed.code} - {selectedMed.name}</span>
                    ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{placeholder}</span>
                    )}
                </div>
                {value && (
                    <div onClick={handleClear} style={{ background: '#cbd5e1', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'white', fontWeight: 'bold' }}>x</span>
                    </div>
                )}
                <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>

            {isOpen && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '110%',
                    left: 0,
                    width: '100%',
                    minWidth: '300px',
                    zIndex: 100,
                    padding: '0.5rem',
                    background: 'var(--bg-primary)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                }}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="glass-input"
                        placeholder="Filtrar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ marginBottom: '0.5rem', padding: '0.5rem' }}
                    />

                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <Loader2 className="animate-spin" size={20} style={{ margin: '0 auto' }} />
                            </div>
                        ) : medications.length > 0 ? (
                            medications.map((med) => (
                                <div
                                    key={med.code}
                                    onClick={() => handleSelect(med)}
                                    style={{
                                        padding: '0.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        marginBottom: '2px'
                                    }}
                                    className="hover-bg-secondary" // We need a way to do hover without inline styles cleanly in pure react without css modules
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <Pill size={14} style={{ color: 'var(--accent-color)', minWidth: '14px' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{med.code}</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{med.name}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                No se encontraron medicamentos.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
