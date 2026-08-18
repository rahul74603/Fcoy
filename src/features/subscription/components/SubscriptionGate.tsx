// 🔒 SUBSCRIPTION GATE (HARD LOCK) — "only subscription k baad hi khule"
//
// Rules (owner ka kanun — SIRF 2 RASTE, KOI GRACE NAHI):
//   - status 'active' / 'expiring'             → app chalti hai
//   - status 'none' (kabhi plan bana hi nahi)  → FULL LOCK
//   - status 'expired' (endDate nikal gayi)    → turant FULL LOCK
//   - Developer account (TEST-77) → KABHI lock nahi (sandbox bypass)
//
// Lock screen me embedded OwnerRenewPanel — payment ke baad owner key se
// yahin se renew ho jata hai (koi alag login nahi chahiye).
// NOTE: Ye client-side gate hai — asli enforcement Firestore rules hardening
// ke saath aayegi (customer handover se pehle pending task).
import React from 'react';
import { Lock, ShieldAlert, BadgeIndianRupee, CalendarClock } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useUnitConfig } from '../../../contexts/UnitConfigContext';
import OwnerRenewPanel from './OwnerRenewPanel';
import { SUBSCRIPTION_ENABLED } from '../subscription.config';

// Owner ka contact — lock screen pe dikhta hai (yahin se badal sakte ho)
const OWNER_CONTACT = {
  name: 'App Owner (Developer)',
  email: 'trainingcommand.erp@gmail.com',
};

const SubscriptionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { state, subscription, loading } = useSubscription();
  const { unitConfig } = useUnitConfig();

  // 🚩 Is deployment me subscription system hi band hai (company apps) — koi lock nahi
  if (!SUBSCRIPTION_ENABLED) return <>{children}</>;

  // 🧪 Dev sandbox kabhi lock nahi hota
  if (!user || user.isDeveloper) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-military-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const locked = state.status === 'none' || state.status === 'expired';
  if (!locked) return <>{children}</>;

  const endedOn = subscription
    ? new Date(subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const overdueDays = subscription
    ? Math.max(0, Math.floor((Date.now() - new Date(subscription.endDate).getTime()) / 86400000))
    : 0;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-military-950 -m-4">
      <div className="w-full max-w-lg bg-slate-900 border-t-8 border-red-600 shadow-2xl rounded-lg p-6 md:p-8 text-center space-y-5">

        <div className="w-20 h-20 mx-auto rounded-full bg-red-900/50 border-2 border-red-600 flex items-center justify-center">
          <Lock size={36} className="text-red-400" />
        </div>

        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-wide">
            🔒 App Locked — Subscription Required
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            {unitConfig.companyName} · {unitConfig.companyShort}
          </p>
        </div>

        <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-4 text-left space-y-2">
          {state.status === 'none' ? (
            <p className="text-sm font-bold text-slate-200 flex items-start gap-2">
              <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              Is company app pe abhi tak koi subscription activate nahi hui hai.
            </p>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-200 flex items-start gap-2">
                <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                Aapki subscription <span className="text-red-400">{subscription?.planName}</span> expire ho chuki hai.
              </p>
              <p className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <CalendarClock size={13} className="text-slate-500" />
                End date: <span className="text-slate-200 font-black">{endedOn}</span>
                {overdueDays > 0 && <span className="text-red-400">· {overdueDays} din pehle khatam</span>}
              </p>
            </>
          )}
          <p className="text-xs font-semibold text-slate-400 flex items-start gap-2">
            <BadgeIndianRupee size={13} className="text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              App sirf <span className="text-slate-200 font-black">ACTIVE subscription</span> ke baad khulegi.
              Payment ke liye apne App Owner se baat karo: <span className="text-amber-300 font-bold">{OWNER_CONTACT.email}</span>
            </span>
          </p>
        </div>

        {/* 🔑 Owner yahin se renew kar dega (payment milne ke baad) */}
        <OwnerRenewPanel defaultMonths={1} />

        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          {OWNER_CONTACT.name} · Subscription System
        </p>
      </div>
    </div>
  );
};

export default SubscriptionGate;
