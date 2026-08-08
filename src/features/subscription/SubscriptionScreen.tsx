// src/features/subscription/SubscriptionScreen.tsx
// ─────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT (Company Commander)
// Monthly / 3 Months / Yearly plans
// Sab kuch ek jagah: status, renew, extend,
// price edit, history — EASY MANAGEMENT
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown, CalendarDays, CreditCard, History, RefreshCw,
  Loader2, CheckCircle2, AlertTriangle, X, Save, Edit3,
  Zap, ShieldCheck, TrendingDown, PlusCircle, Ban, IndianRupee,
} from 'lucide-react';
import OwnerRenewPanel from './components/OwnerRenewPanel';
import { useAuth } from '../../contexts/AuthContext';
import {
  SubscriptionPlan, UnitSubscription, SubscriptionHistoryEntry,
  DEFAULT_PLANS, PAYMENT_MODES, STATUS_META,
  computeSubscriptionState, formatDate, formatINR,
  perMonthRate, savingsPct,
} from './types/subscription.types';
import {
  fetchPlans, savePlan, fetchCurrentSubscription,
  activatePlan, extendSubscription, cancelSubscription,
  fetchHistory, logHistory,
} from './api/subscription.api';

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const SubscriptionScreen = () => {
  const { user } = useAuth();
  const isCommander = user?.role === 'Company Commander';

  const [activeTab, setActiveTab] = useState<'current' | 'plans' | 'history'>('current');

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [current, setCurrent] = useState<UnitSubscription | null>(null);
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // ── Activate/Renew modal ──
  const [payModal, setPayModal] = useState<{ plan: SubscriptionPlan; isRenew: boolean } | null>(null);
  const [payForm, setPayForm] = useState({ paymentMode: 'UPI', paymentRef: '', remarks: '' });
  const [payLoading, setPayLoading] = useState(false);

  // ── Plan edit (price manage) ──
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [planSaving, setPlanSaving] = useState(false);

  // ── Extend ──
  const [extendLoading, setExtendLoading] = useState(false);

  const inputCls = 'w-full border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-military-700 bg-white rounded';
  const labelCls = 'text-[10px] font-bold text-slate-500 uppercase block mb-1';

  // ─────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, h] = await Promise.all([
        fetchPlans(),
        fetchCurrentSubscription(),
        fetchHistory(50),
      ]);
      setPlans(p);
      setCurrent(c);
      setHistory(h);
    } catch (err: any) {
      console.error(err);
      setError(`Data load nahi hua: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ═════════════════════════════════════════
  // 🔒 DEV-ONLY GATE — subscription management
  // sirf Developer account se (baaki kisi ko nahi)
  // ═════════════════════════════════════════
  if (!user?.isDeveloper) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-amber-50 border border-amber-300 rounded-xl p-6 text-center">
        <Crown size={32} className="mx-auto mb-3 text-amber-500" />
        <h2 className="text-sm font-black text-amber-800 uppercase">Developer Mode Only</h2>
        <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
          Subscription & License management sirf <strong>Developer account</strong> se hota hai.<br />
          Dev account se login karo → <strong>/dev-practice</strong> (Practice Console) → "👑 Subscription & License".
        </p>
      </div>
    );
  }

  const state = computeSubscriptionState(current);
  const meta = STATUS_META[state.status];
  const monthlyPlan = plans.find(p => p.durationMonths === 1);
  const monthlyPrice = monthlyPlan?.price ?? DEFAULT_PLANS[0].price;
  const currentPlan = plans.find(p => p.id === current?.planId);
  const byName = user?.name ?? user?.email ?? 'Commander';

  const activeLikeStatus = state.status === 'active' || state.status === 'expiring';

  // ─────────────────────────────────────────
  // ACTIVATE / RENEW
  // ─────────────────────────────────────────
  const openActivate = (plan: SubscriptionPlan) => {
    setPayForm({ paymentMode: 'UPI', paymentRef: '', remarks: '' });
    setPayModal({ plan, isRenew: activeLikeStatus });
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal || !isCommander) return;
    setPayLoading(true);
    setError(''); setSuccess('');
    try {
      const sub = await activatePlan(payModal.plan, byName, {
        ...payForm,
        continueFromCurrentEnd: payModal.isRenew,
        currentEndDate: current?.endDate,
      });
      setCurrent(sub);
      await loadAll();
      setSuccess(
        payModal.isRenew
          ? `✓ ${payModal.plan.name} renew ho gaya! Nayi expiry: ${formatDate(sub.endDate)}`
          : `✓ ${payModal.plan.name} activate ho gaya! Valid till ${formatDate(sub.endDate)}`,
      );
      setPayModal(null);
      setActiveTab('current');
    } catch (err: any) {
      setError(`Activate failed: ${err.message}`);
    } finally {
      setPayLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // QUICK EXTEND (+1 / +3 / +12 months)
  // ─────────────────────────────────────────
  const handleExtend = async (months: number) => {
    if (!current || !isCommander) return;
    setExtendLoading(true);
    setError(''); setSuccess('');
    try {
      const updated = await extendSubscription(current, months, byName, `Quick extend +${months}M`);
      setCurrent(updated);
      await loadAll();
      setSuccess(`✓ Subscription +${months} month extend. Nayi expiry: ${formatDate(updated.endDate)}`);
    } catch (err: any) {
      setError(`Extend failed: ${err.message}`);
    } finally {
      setExtendLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────
  const handleCancel = async () => {
    if (!current || !isCommander) return;
    if (!window.confirm('Pakka subscription cancel karna hai? System read-only ho jayega.')) return;
    setError(''); setSuccess('');
    try {
      await cancelSubscription(current, byName, 'Cancelled by Commander');
      await loadAll();
      setSuccess('Subscription cancel ho gaya.');
    } catch (err: any) {
      setError(`Cancel failed: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────
  // PLAN PRICE EDIT (easy manage)
  // ─────────────────────────────────────────
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPlan || !isCommander) return;
    if (editPlan.price <= 0) { setError('Price 0 se zyada honi chahiye'); return; }
    setPlanSaving(true);
    setError(''); setSuccess('');
    try {
      await savePlan(editPlan, byName);
      await logHistory({
        action: 'PLAN_UPDATED', planId: editPlan.id, planName: editPlan.name,
        amount: editPlan.price, startDate: '', endDate: '',
        remarks: `${editPlan.name} price updated to ${formatINR(editPlan.price)}`,
        by: byName,
      });
      setPlans(await fetchPlans());
      setHistory(await fetchHistory(50));
      setSuccess(`✓ ${editPlan.name} update ho gaya — nayi price ${formatINR(editPlan.price)}`);
      setEditPlan(null);
    } catch (err: any) {
      setError(`Plan save failed: ${err.message}`);
    } finally {
      setPlanSaving(false);
    }
  };

  // ═════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-military-900 uppercase tracking-wider flex items-center gap-2">
            <Crown size={22} className="text-amber-500" />
            Subscription & License
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Monthly · 3 Months · Yearly — plan choose karo, renew karo, price manage karo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${meta.bg} ${meta.color}`}>
            ● {meta.label}
          </span>
          <button onClick={loadAll} disabled={loading}
            className="p-2 text-military-700 hover:bg-military-50 border border-military-300 rounded">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── ALERTS ── */}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* ── TABS ── */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {([
          { key: 'current', label: 'Current Plan',     icon: <ShieldCheck size={13} />  },
          { key: 'plans',   label: 'Plans & Pricing',  icon: <IndianRupee size={13} />  },
          { key: 'history', label: 'History',          icon: <History size={13} />      },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-military-800 text-military-800'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 size={28} className="animate-spin text-military-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Subscription data load ho raha hai...</p>
        </div>
      ) : (
        <>
          {/* ════════════════════════════════════ */}
          {/* TAB: CURRENT PLAN                   */}
          {/* ════════════════════════════════════ */}
          {activeTab === 'current' && (
            <div className="space-y-4">

              {!current ? (
                /* ── Koi subscription nahi ── */
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
                  <Crown size={40} className="mx-auto mb-3 text-slate-300" />
                  <h3 className="text-sm font-black text-slate-700 uppercase">Koi Subscription Active Nahi</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Monthly, 3 Months ya Yearly plan choose karke ERP activate karein.
                  </p>
                  <button
                    onClick={() => setActiveTab('plans')}
                    className="bg-military-800 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-military-700 rounded inline-flex items-center gap-2"
                  >
                    <Zap size={13} /> View Plans
                  </button>
                </div>
              ) : (
                <>
                  {/* ── STATUS CARD ── */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${meta.bg}`}>
                      <div className="flex items-center gap-2">
                        <Crown size={15} className={meta.color} />
                        <h3 className="text-xs font-black text-slate-800 uppercase">
                          {current.planName}
                        </h3>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-white/70 ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-lg font-black text-slate-800">{formatINR(current.amount)}</span>
                    </div>

                    <div className="p-5 space-y-4">

                      {/* Days left — big number */}
                      <div className="flex items-center gap-6 flex-wrap">
                        <div className={`w-28 h-28 rounded-full border-8 flex flex-col items-center justify-center flex-shrink-0 ${
                          state.status === 'active'   ? 'border-green-400 bg-green-50'
                          : state.status === 'expiring' ? 'border-amber-400 bg-amber-50'
                          : state.status === 'grace'  ? 'border-orange-400 bg-orange-50'
                          : 'border-red-400 bg-red-50'
                        }`}>
                          <span className="text-3xl font-black text-slate-800">
                            {state.status === 'grace' ? state.graceDaysLeft
                             : activeLikeStatus ? state.daysLeft : 0}
                          </span>
                          <span className="text-[9px] font-black text-slate-500 uppercase">
                            {state.status === 'grace' ? 'Grace Days' : 'Din Bache'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-[220px] space-y-2">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                            <span className="flex items-center gap-1">
                              <CalendarDays size={11} /> {formatDate(current.startDate)}
                            </span>
                            <span className={`flex items-center gap-1 ${
                              activeLikeStatus ? 'text-slate-700' : 'text-red-600'
                            }`}>
                              {formatDate(current.endDate)} <CalendarDays size={11} />
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                state.usedPct < 70 ? 'bg-green-500'
                                : state.usedPct < 90 ? 'bg-amber-500'
                                : 'bg-red-500'
                              }`}
                              style={{ width: `${state.usedPct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            {state.usedPct}% period use ho gaya
                            {state.status === 'grace' && (
                              <span className="text-orange-600 font-black">
                                {' '}— GRACE PERIOD chal raha hai, jaldi renew karein!
                              </span>
                            )}
                            {state.status === 'expired' && (
                              <span className="text-red-600 font-black">
                                {' '}— EXPIRED. Data safe hai, renew karke access wapas lein.
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Payment details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                        {[
                          { label: 'Payment Mode', value: current.paymentMode || '—' },
                          { label: 'Reference / PO', value: current.paymentRef || '—' },
                          { label: 'Last Updated By', value: current.updatedBy || '—' },
                          { label: 'Remarks', value: current.remarks || '—' },
                        ].map(f => (
                          <div key={f.label}>
                            <p className="text-[9px] font-black text-slate-400 uppercase">{f.label}</p>
                            <p className="text-xs font-bold text-slate-700 truncate" title={f.value}>{f.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── QUICK ACTIONS ── */}
                  {isCommander && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      {/* Renew */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap size={14} className="text-green-600" />
                          <h4 className="text-[11px] font-black text-slate-800 uppercase">Renew Plan</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-3">
                          Same ya naya plan — bache hue din add honge, waste nahi.
                        </p>
                        <button
                          onClick={() => currentPlan ? openActivate(currentPlan) : setActiveTab('plans')}
                          className="w-full bg-green-700 text-white py-2 text-[11px] font-black uppercase hover:bg-green-800 rounded flex items-center justify-center gap-1.5"
                        >
                          <Zap size={12} />
                          {currentPlan ? `Renew ${currentPlan.name}` : 'Choose Plan'}
                        </button>
                      </div>

                      {/* Quick Extend */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <PlusCircle size={14} className="text-blue-600" />
                          <h4 className="text-[11px] font-black text-slate-800 uppercase">Quick Extend</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-3">
                          Current expiry me seedha din jodo (payment baad me note karo).
                        </p>
                        <div className="flex gap-1.5">
                          {[1, 3, 12].map(m => (
                            <button key={m}
                              onClick={() => handleExtend(m)}
                              disabled={extendLoading}
                              className="flex-1 bg-blue-50 border border-blue-300 text-blue-700 py-2 text-[11px] font-black hover:bg-blue-100 rounded disabled:opacity-50"
                            >
                              {extendLoading ? <Loader2 size={12} className="animate-spin mx-auto" /> : `+${m}M`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cancel */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Ban size={14} className="text-red-600" />
                          <h4 className="text-[11px] font-black text-slate-800 uppercase">Cancel</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-3">
                          Subscription band karo. Data delete NAHI hoga — sirf access rukegi.
                        </p>
                        <button
                          onClick={handleCancel}
                          className="w-full bg-red-50 border border-red-300 text-red-700 py-2 text-[11px] font-black uppercase hover:bg-red-100 rounded"
                        >
                          Cancel Subscription
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════ */}
          {/* TAB: PLANS & PRICING                */}
          {/* ════════════════════════════════════ */}
          {activeTab === 'plans' && (
            <div className="space-y-4">

              <div className="bg-blue-50 border border-blue-200 rounded p-3 flex items-center gap-2">
                <AlertTriangle size={13} className="text-blue-700 flex-shrink-0" />
                <p className="text-[10px] text-blue-700 font-semibold">
                  Plan activate karte hi validity usi din se shuru hoti hai.
                  Renew karne par bache hue din automatically add ho jate hain.
                  Prices badalne ke liye <strong>Edit (✎)</strong> dabao.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map(plan => {
                  const isCurrent = current?.planId === plan.id && activeLikeStatus;
                  const save = savingsPct(plan, monthlyPrice);
                  const highlighted = plan.badge && plan.isActive;

                  return (
                    <div
                      key={plan.id}
                      className={`relative bg-white rounded-xl overflow-hidden shadow-sm border-2 transition-all ${
                        isCurrent ? 'border-green-500 ring-2 ring-green-100'
                        : highlighted ? 'border-amber-400'
                        : 'border-slate-200 hover:border-military-300'
                      } ${!plan.isActive ? 'opacity-60' : ''}`}
                    >
                      {/* Badge */}
                      {plan.badge && plan.isActive && (
                        <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[8px] font-black px-2.5 py-1 rounded-bl-lg uppercase tracking-wider">
                          ★ {plan.badge}
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute top-0 left-0 bg-green-600 text-white text-[8px] font-black px-2.5 py-1 rounded-br-lg uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={9} /> Current
                        </div>
                      )}

                      <div className="p-5 pt-7">
                        {/* Name + duration */}
                        <h3 className="text-sm font-black text-slate-800 uppercase">{plan.name}</h3>
                        <p className="text-[10px] text-slate-500 font-bold">
                          {plan.durationMonths === 1 ? 'Har mahine renew'
                           : plan.durationMonths === 3 ? '3 mahine ki validity'
                           : '12 mahine (1 saal) ki validity'}
                        </p>

                        {/* Price */}
                        <div className="mt-3 flex items-end gap-1">
                          <span className="text-3xl font-black text-military-900">{formatINR(plan.price)}</span>
                          <span className="text-[10px] text-slate-500 font-bold mb-1.5">
                            / {plan.durationMonths} mahine
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500 font-semibold">
                            ≈ {formatINR(perMonthRate(plan))}/month
                          </span>
                          {save > 0 && (
                            <span className="text-[9px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <TrendingDown size={9} /> {save}% SAVE
                            </span>
                          )}
                        </div>

                        {/* Features */}
                        <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 min-h-[96px]">
                          {plan.features.map((f, i) => (
                            <li key={i} className="text-[11px] text-slate-600 font-semibold flex items-start gap-1.5">
                              <CheckCircle2 size={11} className="text-green-600 mt-0.5 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>

                        {/* Actions */}
                        <div className="mt-4 space-y-1.5">
                          <button
                            onClick={() => openActivate(plan)}
                            disabled={!isCommander || !plan.isActive}
                            className={`w-full py-2.5 text-[11px] font-black uppercase rounded flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                              isCurrent
                                ? 'bg-green-700 text-white hover:bg-green-800'
                                : highlighted
                                ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                                : 'bg-military-800 text-white hover:bg-military-700'
                            }`}
                          >
                            <Zap size={12} />
                            {isCurrent ? 'Renew This Plan'
                             : activeLikeStatus ? 'Switch / Renew'
                             : 'Activate Plan'}
                          </button>

                          {isCommander && (
                            <button
                              onClick={() => setEditPlan({ ...plan })}
                              className="w-full py-1.5 text-[10px] font-black uppercase text-slate-500 border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center gap-1"
                            >
                              <Edit3 size={10} /> Edit Price / Details
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compare footer */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
                <p className="text-[10px] text-slate-500 font-semibold">
                  💡 Yearly plan lene par monthly ke mukable{' '}
                  <strong className="text-green-700">
                    {formatINR(Math.max(0, monthlyPrice * 12 - (plans.find(p => p.durationMonths === 12)?.price ?? 0)))}
                  </strong>{' '}
                  saal bhar me bachte hain.
                </p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════ */}
          {/* TAB: HISTORY                        */}
          {/* ════════════════════════════════════ */}
          {activeTab === 'history' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={14} className="text-military-700" />
                  <h3 className="text-xs font-black text-slate-800 uppercase">Subscription History</h3>
                  <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border">
                    {history.length} records
                  </span>
                </div>
                <button
                  onClick={async () => setHistory(await fetchHistory(50))}
                  className="text-[10px] font-bold text-military-700 flex items-center gap-1 hover:text-military-900"
                >
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {history.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <History size={32} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-xs font-bold">Abhi koi history nahi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Date', 'Action', 'Plan', 'Amount', 'Valid Till', 'Remarks', 'By'].map(h => (
                          <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {history.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                            {formatDate(entry.at)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              entry.action === 'ACTIVATED' ? 'bg-green-100 text-green-700'
                              : entry.action === 'RENEWED' ? 'bg-blue-100 text-blue-700'
                              : entry.action === 'EXTENDED' ? 'bg-indigo-100 text-indigo-700'
                              : entry.action === 'PLAN_UPDATED' ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-700">{entry.planName || '—'}</td>
                          <td className="px-3 py-2.5 font-black text-military-900 whitespace-nowrap">
                            {entry.amount > 0 ? formatINR(entry.amount) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                            {entry.endDate ? formatDate(entry.endDate) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 truncate max-w-[160px]" title={entry.remarks}>
                            {entry.remarks || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{entry.by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════ */}
      {/* MODAL: PAYMENT / ACTIVATE             */}
      {/* ════════════════════════════════════ */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-military-900 px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase flex items-center gap-2">
                <CreditCard size={14} className="text-amber-400" />
                {payModal.isRenew ? 'Renew' : 'Activate'} — {payModal.plan.name}
              </h3>
              <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleActivate} className="p-5 space-y-4">

              {/* Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Plan</span><span>{payModal.plan.name}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Duration</span><span>{payModal.plan.durationMonths} month(s)</span>
                </div>
                {payModal.isRenew && current && new Date(current.endDate) > new Date() && (
                  <div className="flex justify-between text-[10px] font-bold text-green-700">
                    <span>Bache hue din</span>
                    <span>+{state.daysLeft} din add honge ✓</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-military-900 border-t border-slate-200 pt-1.5 mt-1.5">
                  <span>Total Pay</span><span>{formatINR(payModal.plan.price)}</span>
                </div>
              </div>

              <div>
                <label className={labelCls}>Payment Mode *</label>
                <select
                  value={payForm.paymentMode}
                  onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}
                  className={inputCls}
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Reference No. (Txn ID / PO No.)</label>
                <input
                  type="text"
                  value={payForm.paymentRef}
                  onChange={e => setPayForm({ ...payForm, paymentRef: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. TXN123456 ya PO/2026/1234"
                />
              </div>

              <div>
                <label className={labelCls}>Remarks</label>
                <input
                  type="text"
                  value={payForm.remarks}
                  onChange={e => setPayForm({ ...payForm, remarks: e.target.value })}
                  className={inputCls}
                  placeholder="Optional note"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={payLoading}
                  className="flex-1 bg-green-700 text-white py-2.5 text-xs font-black uppercase hover:bg-green-800 disabled:opacity-50 rounded flex items-center justify-center gap-2"
                >
                  {payLoading
                    ? <><Loader2 size={13} className="animate-spin" /> Processing...</>
                    : <><CheckCircle2 size={13} /> Confirm {payModal.isRenew ? 'Renew' : 'Activate'}</>}
                </button>
                <button
                  type="button"
                  onClick={() => setPayModal(null)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/* MODAL: EDIT PLAN (price manage)       */}
      {/* ════════════════════════════════════ */}
      {editPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-military-900 px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase flex items-center gap-2">
                <Edit3 size={13} className="text-amber-400" />
                Edit Plan — {editPlan.name}
              </h3>
              <button onClick={() => setEditPlan(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-5 space-y-4">

              <div>
                <label className={labelCls}>Plan Name</label>
                <input
                  type="text"
                  value={editPlan.name}
                  onChange={e => setEditPlan({ ...editPlan, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price (₹) *</label>
                  <input
                    type="number" min={1} required
                    value={editPlan.price || ''}
                    onChange={e => setEditPlan({ ...editPlan, price: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Duration</label>
                  <div className="w-full border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-500 rounded">
                    {editPlan.durationMonths} month(s) — fixed
                  </div>
                </div>
              </div>

              {editPlan.durationMonths > 1 && (
                <p className="text-[10px] text-green-700 font-bold bg-green-50 border border-green-200 rounded px-2.5 py-1.5">
                  ≈ {formatINR(perMonthRate(editPlan))}/month · Monthly se{' '}
                  {savingsPct(editPlan, monthlyPrice)}% sasta
                </p>
              )}

              <div>
                <label className={labelCls}>Badge (optional)</label>
                <select
                  value={editPlan.badge ?? ''}
                  onChange={e => setEditPlan({ ...editPlan, badge: e.target.value || undefined })}
                  className={inputCls}
                >
                  <option value="">No Badge</option>
                  <option value="POPULAR">POPULAR</option>
                  <option value="BEST VALUE">BEST VALUE</option>
                  <option value="NEW">NEW</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <span className="text-[10px] font-black text-slate-600 uppercase">Plan Visible Hai</span>
                <button
                  type="button"
                  onClick={() => setEditPlan({ ...editPlan, isActive: !editPlan.isActive })}
                  className={`text-[10px] font-black px-3 py-1 rounded-full ${
                    editPlan.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {editPlan.isActive ? '● SHOW' : '○ HIDDEN'}
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={planSaving}
                  className="flex-1 bg-military-800 text-white py-2.5 text-xs font-black uppercase hover:bg-military-700 disabled:opacity-50 rounded flex items-center justify-center gap-2"
                >
                  {planSaving
                    ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
                    : <><Save size={13} /> Save Plan</>}
                </button>
                <button
                  type="button"
                  onClick={() => setEditPlan(null)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔑 OWNER RENEWAL — payment ke baad plan extend (sirf owner key se chalta hai; lock hone pe gate screen pe bhi yehi panel aata hai) */}
      <div className="max-w-lg mx-auto">
        <OwnerRenewPanel defaultMonths={1} />
      </div>

    </div>
  );
};

export default SubscriptionScreen;
