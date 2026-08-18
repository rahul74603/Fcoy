// src/contexts/SubscriptionContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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
  status: 'none', daysLeft: 0, totalDays: 0, usedPct: 0,
};

// Company deployments me subscription ENFORCEMENT (banner/gate/admin route)
// feature flag se OFF rehta hai. Lekin read-only status top bar me dikhane ke
// liye ye context har signed-in unit me `subscription/current` padhta hai.
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
    // Sirf logged-in user ke liye read-only status listener lagao.
    // 🔒 Developer account = subscription-free sandbox — koi reads nahi
    if (!user || user.isDeveloper) {
      setSubscription(null);
      setState(INITIAL_STATE);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    // 🔥 Real-time listener — unit (is app) ki subscription
    const unsubscribe = onSnapshot(
      doc(db, 'subscription', 'current'),
      async (snap) => {
        if (snap.exists()) {
          const sub = snap.data() as UnitSubscription;
          if (!cancelled) {
            setSubscription(sub);
            setState(computeSubscriptionState(sub));
            setLoading(false);
          }
          return;
        }
        // 👑 Unit sub nahi hai → logged-in user ka APNI company ka plan dekho
        // (CC customer ke users doc me customerId hota hai)
        if (user.customerId) {
          try {
            const cs = await getDoc(doc(db, 'customerSubscriptions', user.customerId));
            const sub = cs.exists() ? (cs.data() as UnitSubscription) : null;
            if (!cancelled) {
              setSubscription(sub);
              setState(computeSubscriptionState(sub));
              setLoading(false);
            }
          } catch (e) {
            console.error('Customer subscription fetch error:', e);
            if (!cancelled) setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setSubscription(null);
          setState(INITIAL_STATE);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Subscription listener error:', error);
        setSubscription(null);
        setState(INITIAL_STATE);
        setLoading(false);
      },
    );

    return () => { cancelled = true; unsubscribe(); };
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
