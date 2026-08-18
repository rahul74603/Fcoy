// src/features/subscription/components/SubscriptionBanner.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, Crown, Clock } from 'lucide-react';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useAuth } from '../../../contexts/AuthContext';
import { SUBSCRIPTION_ENABLED } from '../subscription.config';
import { formatDate } from '../types/subscription.types';

// ─────────────────────────────────────────────
// Slim banner jo har screen ke upar dikhta hai
// jab subscription expiring / expired ho. (NO GRACE — expired = locked)
// Company Commander ko manage button bhi milta hai.
// ─────────────────────────────────────────────
export const SubscriptionBanner: React.FC = () => {
  const { subscription, state, loading } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();

  // 🚩 Is deployment me subscription system hi band hai (company apps)
  if (!SUBSCRIPTION_ENABLED) return null;
  if (loading || !user) return null;
  if (user.isDeveloper) return null; // 🔒 Dev sandbox — subscription sirf customers ki cheez hai
  if (state.status === 'active') return null; // sab theek — kuch mat dikhao

  const isCommander = user.role === 'Company Commander';

  const ManageBtn = ({ dark }: { dark?: boolean }) =>
    isCommander ? (
      <button
        onClick={() => navigate('/subscription')}
        className={`ml-3 text-[10px] font-black uppercase px-2.5 py-1 rounded border transition-colors ${
          dark
            ? 'border-white/40 text-white hover:bg-white/10'
            : 'border-current hover:bg-black/5'
        }`}
      >
        Manage Subscription
      </button>
    ) : null;

  // ── EXPIRING SOON ──
  if (state.status === 'expiring') {
    return (
      <div className="bg-amber-50 border-b border-amber-300 text-amber-800 px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-bold">
        <Clock size={13} className="flex-shrink-0" />
        <span>
          Subscription <strong>{state.daysLeft} din</strong> me expire ho raha hai
          ({formatDate(subscription?.endDate ?? '')}).
          {isCommander ? ' Renewal time pe kar lein.' : ' Commander ko inform karein.'}
        </span>
        <ManageBtn />
      </div>
    );
  }

  // ── EXPIRED ── (⚠️ NO GRACE — endDate ke baad seedha lock)
  if (state.status === 'expired') {
    return (
      <div className="bg-red-700 border-b border-red-800 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-bold">
        <XCircle size={13} className="flex-shrink-0" />
        <span>
          🚫 Subscription EXPIRED. Data safe hai lekin naya entry band hai.
          {isCommander ? ' Turant renew karein.' : ' Company Commander se contact karein.'}
        </span>
        <ManageBtn dark />
      </div>
    );
  }

  // ── NONE (pehli baar setup) — sirf CC ko hint ──
  if (state.status === 'none' && isCommander) {
    return (
      <div className="bg-blue-50 border-b border-blue-300 text-blue-800 px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-bold">
        <Crown size={13} className="flex-shrink-0" />
        <span>Koi subscription active nahi hai. Monthly / 3 Months / Yearly plan choose karein.</span>
        <ManageBtn />
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
