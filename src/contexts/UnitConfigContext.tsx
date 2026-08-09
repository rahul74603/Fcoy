// src/contexts/UnitConfigContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

interface UnitConfig {
  parentUnit: string;
  companyName: string;
  companyShort: string;
  location: string;
  commanderName: string;
  updatedAt: string;
  updatedBy: string;
}

interface UnitConfigContextType {
  unitConfig: UnitConfig;
  loading: boolean;
  refreshUnitConfig: () => void;
}

// Default values — jab tak Firebase se data nahi aata
const DEFAULT_CONFIG: UnitConfig = {
  parentUnit: 'INTERNAL (OWNER USE ONLY)',
  companyName: 'MASTER COY',
  companyShort: 'MASTER',
  location: 'SANDBOX',
  commanderName: 'Developer (Owner)',
  updatedAt: '',
  updatedBy: '',
};

const UnitConfigContext = createContext<UnitConfigContextType>({
  unitConfig: DEFAULT_CONFIG,
  loading: true,
  refreshUnitConfig: () => {},
});

export const useUnitConfig = () => useContext(UnitConfigContext);

export const UnitConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unitConfig, setUnitConfig] = useState<UnitConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔥 Real-time listener — Settings mein change hote hi INSTANT update
    const unsubscribe = onSnapshot(
      doc(db, 'unitConfig', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UnitConfig;
          setUnitConfig({
            parentUnit: data.parentUnit || DEFAULT_CONFIG.parentUnit,
            companyName: data.companyName || DEFAULT_CONFIG.companyName,
            companyShort: data.companyShort || DEFAULT_CONFIG.companyShort,
            location: data.location || DEFAULT_CONFIG.location,
            commanderName: data.commanderName || DEFAULT_CONFIG.commanderName,
            updatedAt: data.updatedAt || '',
            updatedBy: data.updatedBy || '',
          });
        } else {
          // Document exist nahi karta — defaults use karo
          setUnitConfig(DEFAULT_CONFIG);
        }
        setLoading(false);
      },
      (error) => {
        console.error('UnitConfig listener error:', error);
        setLoading(false);
      }
    );

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  const refreshUnitConfig = useCallback(() => {
    // onSnapshot already handles real-time updates
    // ye manual trigger ke liye hai agar kahi zarurat ho
    console.log('UnitConfig is real-time synced via onSnapshot');
  }, []);

  return (
    <UnitConfigContext.Provider value={{ unitConfig, loading, refreshUnitConfig }}>
      {children}
    </UnitConfigContext.Provider>
  );
};