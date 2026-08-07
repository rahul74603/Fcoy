// src/features/subscription/components/SubscriptionBanner.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, XCircle, Crown, Clock } from 'lucide-react';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDate } from '../types/subscription.types';

// ─────────────────────────────────────────────
// Slim banner jo har screen ke upar dikhta hai
// jab subscription expiring / grace / expired ho.
// Company Commander ko manage button bhi milta hai.
// ─────────────────────────────────────────────
export const SubscriptionBanner: React.FC = () => {
  const { subscription, state, loading } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // ── GRACE PERIOD ──
  if (state.status === 'grace') {
    return (
      <div className="bg-orange-600 border-b border-orange-700 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-bold">
        <AlertTriangle size={13} className="flex-shrink-0" />
        <span>
          ⚠ Subscription EXPIRE ho chuka hai — Grace Period: sirf{' '}
          <strong>{state.graceDaysLeft} din</strong> bache. Abhi renew karein,
          warna system READ-ONLY ho jayega.
        </span>
        <ManageBtn dark />
      </div>
    );
  }

  // ── EXPIRED ──
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
