// src/contexts/SubscriptionContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  UnitSubscription, SubscriptionState,
  computeSubscriptionState,
} from '../features/subscription/types/subscription.types';
import { SUBSCRIPTION_ENABLED } from '../features/subscription/subscription.config';
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

// 🚩 Subscription OFF deployment (company apps) — hamesha "sab theek" state,
// koi Firestore listener nahi, koi banner/gate nahi.
const ALWAYS_ACTIVE_STATE: SubscriptionState = {
  status: 'active', daysLeft: 36500, totalDays: 36500, usedPct: 0, graceDaysLeft: 0,
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
    // 🚩 Subscription system is deployment me band hai — listener hi mat lagao
    if (!SUBSCRIPTION_ENABLED) {
      setSubscription(null);
      setState(ALWAYS_ACTIVE_STATE);
      setLoading(false);
      return;
    }

    // Sirf logged-in user ke liye listener lagao
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
      if (!SUBSCRIPTION_ENABLED) return;
      setState(computeSubscriptionState(subscription));
    }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [subscription]);

  const refresh = useCallback(() => {
    if (!SUBSCRIPTION_ENABLED) return;
    setState(computeSubscriptionState(subscription));
  }, [subscription]);

  return (
    <SubscriptionContext.Provider value={{ subscription, state, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
