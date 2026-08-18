// 💳 SUBSCRIPTION / LICENSE STATUS CHIP — top bar pe HAMESHA dikhta hai
// Master me subscription enforcement chalta hai. Company apps me gate/banner
// OFF rehte hain, lekin synced plan ka read-only status aur days-left dikhta hai.
//   ✅ ACTIVE (green)      - plan chal raha, X din bache
//   ⚠️ EXPIRING (amber)    - 7 din se kam bache
//   🔒 EXPIRED (red)       - app LOCKED
//   🔒 NO PLAN (red)       - kabhi plan bana hi nahi -> app LOCKED
//   🧪 DEV (gray)          - testing account (subscription-free)
import React from 'react';
import { BadgeCheck, AlertTriangle, Lock, FlaskConical } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { SUBSCRIPTION_ENABLED } from '../subscription.config';

const SubscriptionStatusChip: React.FC = () => {
  const { user } = useAuth();
  const { state, subscription, loading } = useSubscription();

  if (!user) return null;

  // 🧪 Dev sandbox — testing account, sub-free
  if (user.isDeveloper) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-300 print:hidden"
        title="Testing account — subscription ki zaroorat nahi">
        <FlaskConical size={12} className="text-slate-500" />
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">DEV · Sub-Free</span>
      </div>
    );
  }

  if (loading) {
    return <div className="w-20 h-6 bg-slate-200 animate-pulse rounded print:hidden" />;
  }

  const days = state.daysLeft;
  const endOn = subscription?.endDate
    ? new Date(subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const cfg: Record<string, { cls: string; icon: React.ReactNode; text: string }> = {
    none: {
      cls: 'bg-red-100 border-red-400 text-red-800',
      icon: <Lock size={12} />,
      text: SUBSCRIPTION_ENABLED ? 'NO PLAN · LOCKED' : 'NO PLAN · NOT SYNCED',
    },
    active: {
      cls: 'bg-green-100 border-green-400 text-green-800',
      icon: <BadgeCheck size={12} />,
      text: `ACTIVE · ${days} DIN BACHE`,
    },
    expiring: {
      cls: 'bg-amber-100 border-amber-400 text-amber-800',
      icon: <AlertTriangle size={12} />,
      text: `${days} DIN BACHE · RENEW!`,
    },
    expired: {
      cls: 'bg-red-600 border-red-700 text-white',
      icon: <Lock size={12} />,
      text: SUBSCRIPTION_ENABLED ? 'EXPIRED · LOCKED' : 'EXPIRED · RENEW',
    },
  };

  const c = cfg[state.status] ?? cfg.none;
  const planInfo = subscription?.planName ? `${subscription.planName} · ` : '';
  const pulse = state.status === 'expiring';

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded border-2 print:hidden ${c.cls}`}
      title={`${planInfo}End date: ${endOn}${state.status === 'none' || state.status === 'expired' ? (SUBSCRIPTION_ENABLED ? ' — app locked (owner key se renew)' : ' — owner se plan sync/renew karayein') : ''}`}
    >
      {(pulse || state.status === 'expired') && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {c.icon}
      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{c.text}</span>
    </div>
  );
};

export default SubscriptionStatusChip;
