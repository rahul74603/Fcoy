// 🔒 SUBSCRIPTION GATE — hard lock ONLY for a never-activated install
//
// Rules (owner ka kanun):
//   - status 'active' / 'expiring' / 'grace'  → app chalti hai (grace me banner chillata hai)
//   - status 'none' (kabhi plan bana hi nahi)  → FULL LOCK
//   - status 'expired' (grace bhi nikal gayi)  → FULL LOCK
//   - Developer account (TEST-77) → KABHI lock nahi (sandbox bypass)
//
// Lock screen me embedded OwnerRenewPanel — payment ke baad owner key se
// yahin se renew ho jata hai (koi alag login nahi chahiye).
// NOTE: Ye client-side gate hai — asli enforcement Firestore rules hardening
// ke saath aayegi (customer handover se pehle pending task).
import React from 'react';
import { Lock, ShieldAlert, BadgeIndianRupee } from 'lucide-react';
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
  const { state, loading } = useSubscription();
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

  // ── EXPIRED = READ-ONLY, NOT LOCKED OUT ──
  // Firestore rules (licenceWritable) now let an expired company READ all of
  // its data and renew, while denying every business mutation. Hard-locking
  // the UI here would contradict that: the customer still owns their records
  // and must be able to look at them — and, practically, a locked screen is a
  // worse place to be asked for money than a working app with a red banner.
  //
  // So `expired` now renders the app. Writes fail at the rules layer, which is
  // the real boundary; SubscriptionBanner shows the persistent warning and the
  // renewal route stays reachable.
  //
  // 'none' still hard-locks: that means no licence was ever activated, i.e. an
  // unpaid install rather than a lapsed customer with data to protect.
  const locked = state.status === 'none';
  if (!locked) return <>{children}</>;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-military-950 -m-4">
      <div className="w-full max-w-lg bg-slate-900 border-t-8 border-red-600 shadow-2xl rounded-lg p-6 md:p-8 text-center space-y-5">

        <div className="w-20 h-20 mx-auto rounded-full bg-red-900/50 border-2 border-red-600 flex items-center justify-center">
          <Lock size={36} className="text-red-400" />
        </div>

        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-wide">
            🔒 Subscription Activate Nahi Hui
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            {unitConfig.companyName} · {unitConfig.companyShort}
          </p>
        </div>

        <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-4 text-left space-y-2">
          {/* Only status 'none' reaches this screen now — an EXPIRED company
              keeps its app in read-only mode instead of being locked out. */}
          <p className="text-sm font-bold text-slate-200 flex items-start gap-2">
            <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            Is company app pe abhi tak koi subscription activate nahi hui hai.
          </p>
          <p className="text-xs font-semibold text-slate-400 flex items-start gap-2">
            <BadgeIndianRupee size={13} className="text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              Pehli baar activate karne ke liye apne App Owner se baat karo:{' '}
              <span className="text-amber-300 font-bold">{OWNER_CONTACT.email}</span>
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
