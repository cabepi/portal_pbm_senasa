import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Pharmacy } from '../types';

interface PharmacyContextType {
    selectedPharmacy: Pharmacy | null;
    setSelectedPharmacy: (pharmacy: Pharmacy | null) => void;
    isLocked: boolean;
    setIsLocked: (locked: boolean) => void;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

const STORAGE_KEY = 'selected_pharmacy';
const DEFAULT_PHARMACY: Pharmacy = { code: '00000', name: 'Ver Todos' };

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedPharmacy, setSelectedPharmacyState] = useState<Pharmacy | null>(null);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setSelectedPharmacyState(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse selected pharmacy", e);
                setSelectedPharmacyState(DEFAULT_PHARMACY);
            }
        } else {
            // Set default if nothing stored
            setSelectedPharmacyState(DEFAULT_PHARMACY);
        }
    }, []);

    const setSelectedPharmacy = (pharmacy: Pharmacy | null) => {
        setSelectedPharmacyState(pharmacy);
        if (pharmacy) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pharmacy));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    return (
        <PharmacyContext.Provider value={{ selectedPharmacy, setSelectedPharmacy, isLocked, setIsLocked }}>
            {children}
        </PharmacyContext.Provider>
    );
};

export const usePharmacy = () => {
    const context = useContext(PharmacyContext);
    if (context === undefined) {
        throw new Error('usePharmacy must be used within a PharmacyProvider');
    }
    return context;
};
