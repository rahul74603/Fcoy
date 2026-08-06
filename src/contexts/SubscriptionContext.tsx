// src/contexts/SubscriptionContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  UnitSubscription, SubscriptionState,
  computeSubscriptionState,
} from '../features/subscription/types/subscription.types';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscription: UnitSubscription | null;
  state: SubscriptionState;
  loading: boolean;
  refresh: () => void;
}

const INITIAL_STATE: SubscriptionState = {
  status: 'none', daysLeft: 0, totalDays: 0, usedPct: 0, graceDaysLeft: 0,
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  state: INITIAL_STATE,
  loading: true,
  refresh: () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UnitSubscription | null>(null);
  const [state, setState] = useState<SubscriptionState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sirf logged-in user ke liye listener lagao
    if (!user) {
      setSubscription(null);
      setState(INITIAL_STATE);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 🔥 Real-time listener — /subscription screen pe change hote hi
    // banner/status poore app me INSTANT update
    const unsubscribe = onSnapshot(
      doc(db, 'subscription', 'current'),
      (snap) => {
        const sub = snap.exists() ? (snap.data() as UnitSubscription) : null;
        setSubscription(sub);
        setState(computeSubscriptionState(sub));
        setLoading(false);
      },
      (error) => {
        console.error('Subscription listener error:', error);
        setSubscription(null);
        setState(INITIAL_STATE);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  // Din raat ko cross ho jayein to har ghante status re-check
  useEffect(() => {
    const timer = setInterval(() => {
      setState(computeSubscriptionState(subscription));
    }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [subscription]);

  const refresh = useCallback(() => {
    setState(computeSubscriptionState(subscription));
  }, [subscription]);

  return (
    <SubscriptionContext.Provider value={{ subscription, state, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
