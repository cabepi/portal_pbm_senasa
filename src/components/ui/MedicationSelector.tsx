import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Pill } from 'lucide-react';
import medicationsData from '../../data/medications.json';

interface Medication {
    code: string;
    name: string;
}

interface MedicationSelectorProps {
    value: string; // The selected code
    onChange: (code: string) => void;
    placeholder?: string;
}

export const MedicationSelector = ({ value, onChange, placeholder = "Buscar medicamento..." }: MedicationSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Find selected medication object for display
    const selectedMed = medicationsData.find((m: Medication) => m.code === value);

    // Initial effect to set search term if value exists? 
    // Actually, maybe better to keep the search independent.

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

    const filteredMedications = medicationsData
        .filter((m: Medication) =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.code.includes(searchTerm)
        )
        .slice(0, 50);

    const handleSelect = (med: Medication) => {
        onChange(med.code);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            {/* Trigger Button - Looks like an input */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    padding: '0.6rem 0.8rem', // Match typical input padding
                    borderRadius: '8px',
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                }}
            >
                <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedMed ? (
                        <span style={{ fontWeight: 500 }}>{selectedMed.code} - {selectedMed.name}</span>
                    ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '105%',
                    left: 0,
                    right: 0, // Full width of container
                    zIndex: 50,
                    padding: '0.5rem',
                    background: 'var(--bg-primary)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
                            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Escriba nombre o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    outline: 'none',
                                    width: '100%',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredMedications.length > 0 ? (
                            filteredMedications.map((med: Medication) => (
                                <div
                                    key={med.code}
                                    onClick={() => handleSelect(med)}
                                    style={{
                                        padding: '0.5rem 0.8rem',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'background 0.2s',
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
