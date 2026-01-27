import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import { usePharmacy } from '../../contexts/PharmacyContext';
import pharmaciesData from '../../data/pharmacies.json';
import type { Pharmacy } from '../../types';

export const PharmacySelector = () => {
    const { selectedPharmacy, setSelectedPharmacy, isLocked } = usePharmacy();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const location = useLocation();

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

    let pharmaciesList = pharmaciesData;

    // Add "Ver Todo" option only on History page
    if (location.pathname === '/historial') {
        const viewAllOption: Pharmacy = { code: '00000', name: 'Ver Todo' };
        pharmaciesList = [viewAllOption, ...pharmaciesData]; // Type casting implicitly handled as long as structure matches
    }

    const filteredPharmacies = pharmaciesList
        .filter((p: Pharmacy) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code.includes(searchTerm)
        )
        .slice(0, 50); // Limit results for performance

    const handleSelect = (pharmacy: Pharmacy) => {
        setSelectedPharmacy(pharmacy);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={wrapperRef} style={{ position: 'relative' }}>
            {/* Trigger Button */}
            <button
                onClick={() => !isLocked && setIsOpen(!isOpen)}
                disabled={isLocked}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: isLocked ? 'rgba(0,0,0,0.05)' : 'rgba(255, 255, 255, 0.5)',
                    border: '1px solid var(--glass-border)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: isLocked ? 'var(--text-secondary)' : 'var(--text-primary)',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    minWidth: '300px',
                    opacity: isLocked ? 0.8 : 1
                }}
                title={isLocked ? "Selección bloqueada durante una operación activa" : "Cambiar Farmacia"}
            >
                <MapPin size={16} className={isLocked ? "text-slate-400" : "text-accent"} />
                <div style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                    {selectedPharmacy ? (
                        <span style={{ fontWeight: 500 }}>{selectedPharmacy.code} - {selectedPharmacy.name}</span>
                    ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>Seleccionar Farmacia</span>
                    )}
                </div>
                {!isLocked && <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '320px',
                    zIndex: 100,
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
                                placeholder="Buscar por código o nombre..."
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

                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {filteredPharmacies.length > 0 ? (
                            filteredPharmacies.map((pharmacy: Pharmacy) => (
                                <div
                                    key={pharmacy.code}
                                    onClick={() => handleSelect(pharmacy)}
                                    style={{
                                        padding: '0.5rem 0.8rem',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                        transition: 'background 0.2s',
                                        marginBottom: '2px'
                                    }}
                                    className="hover:bg-slate-100" // Tailwind utility if available, or use inline style for hover in pure react via state? Inline hover is tricky.
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pharmacy.code}</div>
                                    <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pharmacy.name}</div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                No se encontraron resultados.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
