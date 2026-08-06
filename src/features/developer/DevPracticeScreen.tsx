// src/features/developer/DevPracticeScreen.tsx
// ─────────────────────────────────────────────
// 👑 OWNER ADMIN PANEL (Developer Mode)
// Developer = sabse bada (Owner). Yahan se:
//   1. CUSTOMERS — Company Commander accounts banao,
//      auto Customer ID (FCOY-2026-001) milti hai
//   2. SUBSCRIPTIONS — har customer ka plan assign/renew/
//      extend + payment record + "Apply to Unit"
//   3. TEST BATCH — 100 trainees + 20 staff demo batch
//   4. PRACTICE SESSION — snapshot + 1-click cleanup
//
// CC (non-dev) ko ye panel NAHI dikhta.
// (Bootstrap: pehli baar koi dev account nahi hai to CC
//  yahan se ek dev account bana sakta hai — one-time.)
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Play, Trash2, ShieldCheck, AlertTriangle,
  Loader2, CheckCircle2, X, RefreshCw, UserPlus, Eye, EyeOff,
  Database, History, Ban, Info, Crown, Dumbbell,
  Building2, CreditCard, Zap, FlaskConical,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where, limit } from 'firebase/firestore';
import { auth as firebaseAuth, db } from '../../config/firebase';
import {
  loadSnapshot, startPracticeSession, previewCleanup, runCleanup,
  fetchSessionMeta, KNOWN_COLLECTIONS,
  CleanupPlan, CleanupReport, PracticeSnapshot,
} from './api/devPractice.api';
import {
  countDevSeedData, wipeTestBatch, generateTestBatch,
  DEV_BATCH_NUMBER, SEEDED_COLLECTIONS, SeedProgress,
} from './api/testBatchSeed.api';
import {
  listCustomersWithSub, createCcAccount, fetchCustomerHistory,
  assignPlanToCustomer, extendCustomerSub, cancelCustomerSub,
  CustomerWithSub, CreateCcForm, CustHistoryEntry,
} from './api/customers.api';
import { fetchPlans } from '../subscription/api/subscription.api';
import {
  SubscriptionPlan, PAYMENT_MODES, STATUS_META,
  computeSubscriptionState, formatDate, formatINR,
  perMonthRate, savingsPct,
} from '../subscription/types/subscription.types';

const inputCls = 'w-full border border-slate-500/40 bg-military-950/60 text-white px-3 py-2 text-xs focus:outline-none focus:border-orange-500 rounded placeholder:text-slate-500';
const labelCls = 'text-[10px] font-bold text-slate-300 uppercase block mb-1';
const by = (u: { name?: string; email?: string | null }) => u?.name || u?.email || 'Owner';

// ─────────────────────────────────────────────
// MAIN — GATES
// ─────────────────────────────────────────────
export const DevPracticeScreen = () => {
  const { user } = useAuth();
  const [bootstrapAllowed, setBootstrapAllowed] = useState<boolean | null>(null);

  const isCommander = user?.role === 'Company Commander';
  const isDevAccount = Boolean(user?.isDeveloper);

  // Bootstrap: koi dev account exist nahi karta → CC ko one-time create option
  useEffect(() => {
    const check = async () => {
      if (isDevAccount) { setBootstrapAllowed(false); return; }
      if (!isCommander) { setBootstrapAllowed(false); return; }
      try {
        const q = query(collection(db, 'users'), where('isDeveloper', '==', true), limit(1));
        const snap = await getDocs(q);
        setBootstrapAllowed(snap.empty);
      } catch {
        setBootstrapAllowed(false);
      }
    };
    check();
  }, [user, isCommander, isDevAccount]);

  if (!isCommander && !isDevAccount) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <Ban size={32} className="mx-auto mb-3 text-red-400" />
        <h2 className="text-sm font-black text-red-700 uppercase">Access Denied</h2>
        <p className="text-xs text-red-600 mt-1">Ye panel sirf App Owner (Developer) ke liye hai.</p>
      </div>
    );
  }

  if (isDevAccount) return <OwnerPanel />;

  if (bootstrapAllowed === null) {
    return (
      <div className="p-12 text-center">
        <Loader2 size={24} className="animate-spin text-orange-600 mx-auto mb-2" />
      </div>
    );
  }

  return bootstrapAllowed ? <CreateDevAccountCard /> : (
    <div className="max-w-lg mx-auto mt-16 bg-orange-50 border border-orange-300 rounded-xl p-6 text-center">
      <Flame size={32} className="mx-auto mb-3 text-orange-500" />
      <h2 className="text-sm font-black text-orange-800 uppercase">Owner / Developer Only</h2>
      <p className="text-xs text-orange-700 mt-1.5 leading-relaxed">
        Ye <strong>Owner Admin Panel</strong> hai — sirf Developer account se khulta hai.<br />
        CC accounts, subscriptions aur testing sab Developer manage karta hai.
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────
// BOOTSTRAP: First Dev Account (one-time, CC only)
// ─────────────────────────────────────────────
const CreateDevAccountCard = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: 'App Owner', email: 'owner@fcoy.com', password: '', cmdPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [showCmdPw, setShowCmdPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Dev password min 6 characters ka hona chahiye'); return; }
    if (!form.cmdPassword) { setError('Apna (Commander) password enter karo'); return; }
    setLoading(true); setError(''); setSuccess('');
    const ccEmail = user?.email ?? '';
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, form.email, form.password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: form.name, email: form.email, phone: '',
        designation: 'App Owner (Developer)',
        role: 'Company Commander',
        isDeveloper: true,
        isActive: true,
        customerId: 'OWNER',
        createdBy: user?.uid ?? '',
        createdAt: new Date().toISOString(),
      });
      await signInWithEmailAndPassword(firebaseAuth, ccEmail, form.cmdPassword);
      setSuccess(`✓ Owner account ban gaya! Ab LOGOUT karke "${form.email}" se login karo — Owner Admin Panel milega.`);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Ye email already registered hai');
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError('Aapka (CC) password galat hai');
      else setError(`Error: ${err.message}`);
      try { await signInWithEmailAndPassword(firebaseAuth, ccEmail, form.cmdPassword); } catch { /* ok */ }
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-8">
      <div className="border-b-2 border-orange-600 pb-3">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Flame size={22} className="text-orange-600" />
          Owner Setup (One-Time)
        </h1>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">
          Owner (Developer) account banao — iske baad CC accounts YEHI account banayega
        </p>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-[11px] text-orange-800 font-semibold leading-relaxed">
          <strong>Hierarchy:</strong> 👑 Owner (Developer) → CC accounts banata hai → har CC ko ek{' '}
          <strong>Customer ID</strong> milti hai → usi ID pe subscription manage hota hai.
          CC apni company chalayega, Owner sabke customers/subscriptions dekhega.
        </p>
      </div>

      {success && <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded text-xs font-semibold flex items-start gap-2"><CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" /> {success}</div>}
      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-xs font-semibold flex items-center gap-2"><AlertTriangle size={14} /> {error}<button onClick={() => setError('')} className="ml-auto"><X size={13} /></button></div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-orange-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <UserPlus size={14} className="text-orange-700" />
          <h3 className="text-xs font-black text-slate-800 uppercase">Create Owner Account</h3>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Owner Ka Naam</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-orange-600" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Owner Email *</label>
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-orange-600" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Owner Password *</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} required minLength={6} value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-orange-600" placeholder="Min 6 characters" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <label className="text-[10px] font-black text-amber-800 uppercase block mb-1.5">🔐 Aapka (CC) Password *</label>
            <div className="relative">
              <input type={showCmdPw ? 'text' : 'password'} required value={form.cmdPassword}
                onChange={e => setForm({ ...form, cmdPassword: e.target.value })}
                className="w-full border border-amber-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-amber-500 bg-white" />
              <button type="button" onClick={() => setShowCmdPw(!showCmdPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showCmdPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-orange-600 text-white py-2.5 text-xs font-black uppercase hover:bg-orange-700 disabled:opacity-50 rounded flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={13} className="animate-spin" /> Creating...</> : <><UserPlus size={13} /> Create Owner Account</>}
          </button>
        </form>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════
// 👑 OWNER PANEL (main)
// ═════════════════════════════════════════════
const OwnerPanel = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'customers' | 'subscriptions' | 'testbatch' | 'practice'>('customers');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithSub | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* ── HEADER ── */}
      <div className="flex justify-between items-end border-b-2 border-orange-600 pb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Flame size={22} className="text-orange-600" />
            Owner Admin Panel
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Customers (CC accounts) · Subscriptions · Testing — sab yahi se
          </p>
        </div>
        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-orange-600 text-white">
          👑 OWNER · {user?.name}
        </span>
      </div>

      {/* ── TABS ── */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {([
          { key: 'customers',     label: '🏢 Customers (CC)',  icon: <Building2 size={13} /> },
          { key: 'subscriptions', label: '👑 Subscriptions',   icon: <Crown size={13} />     },
          { key: 'testbatch',     label: '🏋️ Test Batch',      icon: <Dumbbell size={13} />  },
          { key: 'practice',      label: '🧪 Practice',        icon: <FlaskConical size={13} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'customers' && (
        <CustomersTab
          refreshKey={refreshKey}
          onManage={(c) => { setSelectedCustomer(c); setTab('subscriptions'); }}
        />
      )}
      {tab === 'subscriptions' && (
        <SubscriptionsTab
          customer={selectedCustomer}
          onSelect={setSelectedCustomer}
          onChanged={() => setRefreshKey(k => k + 1)}
          refreshKey={refreshKey}
        />
      )}
      {tab === 'testbatch' && <TestBatchCard />}
      {tab === 'practice' && <PracticeTab />}
    </div>
  );
};

// ═════════════════════════════════════════════
// TAB 1 — CUSTOMERS (CC Accounts)
// ═════════════════════════════════════════════
const CustomersTab = ({ onManage, refreshKey }: { onManage: (c: CustomerWithSub) => void; refreshKey: number }) => {
  const { user } = useAuth();
  const [list, setList] = useState<CustomerWithSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState<CreateCcForm>({
    unitName: '', commanderName: '', email: '', password: '',
    phone: '', location: '', notes: '', isLocalUnit: false,
  });
  const [devPassword, setDevPassword] = useState('');
  const [showDevPw, setShowDevPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await listCustomersWithSub()); }
    catch (e: any) { setError(`Load failed: ${e.message}`); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('CC password min 6 characters'); return; }
    if (!devPassword) { setError('Apna (Owner) password enter karo — account switch ke baad wapas login ke liye'); return; }
    setCreating(true); setError(''); setSuccess(''); setCreatedId('');
    try {
      const { customerId } = await createCcAccount(form, {
        uid: user?.uid ?? '', email: user?.email ?? '', name: user?.name ?? 'Owner',
      }, devPassword);
      setCreatedId(customerId);
      setSuccess(`✓ CC account ban gaya! Customer ID: ${customerId} — ab "Subscriptions" tab se plan assign karo.`);
      setForm({ unitName: '', commanderName: '', email: '', password: '', phone: '', location: '', notes: '', isLocalUnit: false });
      setDevPassword('');
      setShowForm(false);
      await load();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Ye email pehle se registered hai');
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError('Owner password galat hai');
      else setError(`Create failed: ${err.message}`);
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-4">
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
          <span>{success} {createdId && <strong className="text-base ml-1">[{createdId}]</strong>}</span>
          <button onClick={() => setSuccess('')} className="ml-auto flex-shrink-0"><X size={13} /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* ── CREATE BUTTON / FORM ── */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full bg-military-900 border-2 border-dashed border-orange-600/60 rounded-xl p-4 text-orange-400 text-xs font-black uppercase hover:bg-military-800 transition-colors flex items-center justify-center gap-2">
          <UserPlus size={15} /> + New Customer (CC Account Banao) — Auto Customer ID milegi
        </button>
      ) : (
        <div className="bg-military-950 border border-orange-600/50 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-orange-600 px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase flex items-center gap-2">
              <UserPlus size={14} /> New Company Commander Account
            </h3>
            <button onClick={() => setShowForm(false)} className="text-white/70 hover:text-white"><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Unit / Company Name *</label>
                <input required value={form.unitName} onChange={e => setForm({ ...form, unitName: e.target.value })}
                  className={inputCls} placeholder="e.g. F Coy / B Coy Tekanpur" />
              </div>
              <div>
                <label className={labelCls}>Commander Name & Rank *</label>
                <input required value={form.commanderName} onChange={e => setForm({ ...form, commanderName: e.target.value })}
                  className={inputCls} placeholder="e.g. Insp. R.K. Sharma" />
              </div>
              <div>
                <label className={labelCls}>Login Email *</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputCls} placeholder="cc.fcoy@gmail.com" />
              </div>
              <div>
                <label className={labelCls}>Login Password *</label>
                <input type="text" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className={inputCls} placeholder="Min 6 characters (customer ko dena)" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputCls} placeholder="10 digit" />
              </div>
              <div>
                <label className={labelCls}>Location / Station</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className={inputCls} placeholder="e.g. Tekanpur, MP" />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Notes (PO number / deal details)</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className={inputCls} placeholder="Optional" />
              </div>
            </div>

            <label className="flex items-center gap-2 bg-orange-950/40 border border-orange-700/50 rounded px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={form.isLocalUnit}
                onChange={e => setForm({ ...form, isLocalUnit: e.target.checked })}
                className="accent-orange-500 w-3.5 h-3.5" />
              <span className="text-[11px] font-bold text-orange-200">
                🏠 Ye IS app (is unit) ka CC hai — iska plan assign karte hi is app pe apply ho jayega
              </span>
            </label>

            <div className="bg-amber-950/50 border border-amber-700/50 rounded p-3">
              <label className="text-[10px] font-black text-amber-400 uppercase block mb-1.5">
                🔐 Tumhara (Owner) Password * — CC ke account banne ke baad system tumhe wapas login karega
              </label>
              <div className="relative max-w-sm">
                <input type={showDevPw ? 'text' : 'password'} required value={devPassword}
                  onChange={e => setDevPassword(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => setShowDevPw(!showDevPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showDevPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={creating}
                className="bg-orange-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-orange-700 disabled:opacity-50 rounded-lg flex items-center gap-2">
                {creating ? <><Loader2 size={13} className="animate-spin" /> Creating...</> : <><UserPlus size={13} /> Create CC + Customer ID</>}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-xs font-black text-slate-300 border border-slate-600 rounded-lg hover:bg-military-800">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CUSTOMERS TABLE ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-military-700" />
            <h3 className="text-xs font-black text-slate-800 uppercase">Customers (CC Accounts)</h3>
            <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border">{list.length}</span>
          </div>
          <button onClick={load} disabled={loading} className="text-[10px] font-bold text-military-700 flex items-center gap-1">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center"><Loader2 size={22} className="animate-spin text-military-700 mx-auto" /></div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Building2 size={30} className="mx-auto mb-2 text-slate-200" />
            <p className="text-xs font-bold">Abhi koi customer nahi — upar se pehla CC banao</p>
            <p className="text-[10px] mt-1">Jab bhi app kisi ko doge, uska CC account yahi se banega</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Customer ID', 'Unit / Commander', 'Contact', 'Subscription', 'Created', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {list.map(c => <CustomerRow key={c.id} customer={c} onManage={() => onManage(c)} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const CustomerRow = ({ customer: c, onManage }: { customer: CustomerWithSub; onManage: () => void }) => {
  const state = computeSubscriptionState(c.sub ?? null);
  const meta = STATUS_META[state.status];
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-3 py-2.5">
        <span className="font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
          {c.customerId}
        </span>
        {c.isLocalUnit && <div className="text-[8px] font-black text-green-600 mt-0.5">🏠 THIS UNIT</div>}
      </td>
      <td className="px-3 py-2.5">
        <p className="font-bold text-slate-800">{c.unitName}</p>
        <p className="text-[10px] text-slate-500">{c.commanderName}</p>
      </td>
      <td className="px-3 py-2.5 text-slate-500">
        <p className="truncate max-w-[150px]">{c.email}</p>
        <p className="text-[10px]">{c.phone || '—'}</p>
      </td>
      <td className="px-3 py-2.5">
        {c.sub ? (
          <>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} border`}>{meta.label}</span>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {c.sub.planName} · {state.status === 'active' || state.status === 'expiring' ? `${state.daysLeft} din` : formatDate(c.sub.endDate)}
            </p>
          </>
        ) : (
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">NO PLAN</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-slate-500">{formatDate(c.createdAt)}</td>
      <td className="px-3 py-2.5">
        <button onClick={onManage}
          className="bg-amber-500 text-amber-950 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg hover:bg-amber-400 flex items-center gap-1">
          <Crown size={11} /> Subscription
        </button>
      </td>
    </tr>
  );
};

// ═════════════════════════════════════════════
// TAB 2 — SUBSCRIPTIONS (per customer)
// ═════════════════════════════════════════════
const SubscriptionsTab = ({
  customer, onSelect, onChanged, refreshKey,
}: {
  customer: CustomerWithSub | null;
  onSelect: (c: CustomerWithSub | null) => void;
  onChanged: () => void;
  refreshKey: number;
}) => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithSub[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [history, setHistory] = useState<CustHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [payModal, setPayModal] = useState<SubscriptionPlan | null>(null);
  const [payForm, setPayForm] = useState({ paymentMode: 'UPI', paymentRef: '', remarks: '', applyToUnit: true });
  const [payLoading, setPayLoading] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, ps] = await Promise.all([listCustomersWithSub(), fetchPlans()]);
      setCustomers(cs);
      setPlans(ps);
      if (customer) {
        const fresh = cs.find(c => c.customerId === customer.customerId);
        if (fresh) onSelect(fresh);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const loadHistory = useCallback(async () => {
    if (!customer) { setHistory([]); return; }
    setHistory(await fetchCustomerHistory(customer.customerId));
  }, [customer]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const reload = async () => { await loadBase(); await loadHistory(); onChanged(); };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal || !customer) return;
    setPayLoading(true); setError(''); setSuccess('');
    try {
      const sub = await assignPlanToCustomer(customer, payModal, by(user ?? {}), {
        ...payForm,
        applyToUnit: payForm.applyToUnit && customer.isLocalUnit,
      });
      setSuccess(`✓ ${customer.customerId} ko ${payModal.name} ${customer.sub ? 'renew' : 'assign'} ho gaya! Valid till ${formatDate(sub.endDate)}${payForm.applyToUnit && customer.isLocalUnit ? ' — is app pe bhi apply ✓' : ''}`);
      setPayModal(null);
      await reload();
    } catch (err: any) { setError(`Assign failed: ${err.message}`); }
    finally { setPayLoading(false); }
  };

  const handleExtend = async (months: number) => {
    if (!customer?.sub) return;
    setExtendLoading(true); setError('');
    try {
      const sub = await extendCustomerSub(customer, months, by(user ?? {}), customer.isLocalUnit);
      setSuccess(`✓ ${customer.customerId} subscription +${months}M extend → ${formatDate(sub.endDate)}`);
      await reload();
    } catch (err: any) { setError(err.message); }
    finally { setExtendLoading(false); }
  };

  const handleCancel = async () => {
    if (!customer?.sub) return;
    if (!window.confirm(`${customer.customerId} ki subscription cancel karein?`)) return;
    setError('');
    try {
      await cancelCustomerSub(customer, by(user ?? {}), customer.isLocalUnit);
      setSuccess(`Subscription cancel ho gayi (${customer.customerId})`);
      await reload();
    } catch (err: any) { setError(err.message); }
  };

  const subState = computeSubscriptionState(customer?.sub ?? null);
  const subMeta = STATUS_META[subState.status];
  const monthlyPrice = plans.find(p => p.durationMonths === 1)?.price ?? 0;

  return (
    <div className="space-y-4">
      {/* Customer selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <Crown size={16} className="text-amber-500 flex-shrink-0" />
        <select
          value={customer?.customerId ?? ''}
          onChange={e => onSelect(customers.find(c => c.customerId === e.target.value) ?? null)}
          className="flex-1 min-w-[220px] border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-amber-500 font-bold"
        >
          <option value="">— Customer select karo (Customer ID) —</option>
          {customers.map(c => (
            <option key={c.customerId} value={c.customerId}>
              {c.customerId} · {c.unitName} ({c.commanderName}){c.isLocalUnit ? ' 🏠' : ''}
            </option>
          ))}
        </select>
        {customer && (
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${subMeta.bg} ${subMeta.color}`}>
            {customer.sub ? `${subMeta.label} · ${customer.sub.planName}` : 'NO PLAN'}
          </span>
        )}
        <button onClick={reload} disabled={loading} className="p-2 border border-slate-300 rounded text-slate-500 hover:bg-slate-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {success && <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2"><CheckCircle2 size={14} /> {success}<button onClick={() => setSuccess('')} className="ml-auto"><X size={13} /></button></div>}
      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2"><AlertTriangle size={14} /> {error}<button onClick={() => setError('')} className="ml-auto"><X size={13} /></button></div>}

      {!customer ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-10 text-center">
          <Crown size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-xs font-bold text-slate-500">Upar dropdown se customer chuno — ya Customers tab se "Subscription" dabao</p>
        </div>
      ) : (
        <>
          {/* Current status strip */}
          {customer.sub && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Current Plan</p>
                  <p className="text-sm font-black text-slate-800">{customer.sub.planName} · {formatINR(customer.sub.amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Validity</p>
                  <p className="text-xs font-bold text-slate-700">{formatDate(customer.sub.startDate)} → {formatDate(customer.sub.endDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Days Left</p>
                  <p className={`text-xl font-black ${subState.daysLeft <= 30 ? 'text-red-600' : 'text-green-700'}`}>
                    {subState.status === 'active' || subState.status === 'expiring' ? subState.daysLeft : 0}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[1, 3, 12].map(m => (
                    <button key={m} onClick={() => handleExtend(m)} disabled={extendLoading}
                      className="bg-blue-50 border border-blue-300 text-blue-700 px-3 py-1.5 text-[10px] font-black rounded hover:bg-blue-100 disabled:opacity-50">
                      {extendLoading ? '...' : `+${m}M`}
                    </button>
                  ))}
                  <button onClick={handleCancel}
                    className="bg-red-50 border border-red-300 text-red-600 px-3 py-1.5 text-[10px] font-black rounded hover:bg-red-100">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map(plan => {
              const save = savingsPct(plan, monthlyPrice);
              const isCurrent = customer.sub?.planId === plan.id && (subState.status === 'active' || subState.status === 'expiring');
              return (
                <div key={plan.id}
                  className={`bg-white rounded-xl border-2 p-4 shadow-sm ${isCurrent ? 'border-green-500' : plan.badge ? 'border-amber-400' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase">{plan.name}</h4>
                    {isCurrent && <span className="text-[8px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded-full">CURRENT</span>}
                    {!isCurrent && plan.badge && <span className="text-[8px] font-black bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded-full">★ {plan.badge}</span>}
                  </div>
                  <p className="text-[10px] text-slate-500">{plan.durationMonths} mahine</p>
                  <p className="text-xl font-black text-military-900 mt-1.5">{formatINR(plan.price)}</p>
                  <p className="text-[10px] text-slate-500">
                    ≈ {formatINR(perMonthRate(plan))}/mo
                    {save > 0 && <span className="text-green-700 font-black ml-1.5">{save}% SAVE</span>}
                  </p>
                  <button
                    onClick={() => { setPayForm({ paymentMode: 'UPI', paymentRef: '', remarks: '', applyToUnit: true }); setPayModal(plan); }}
                    className={`w-full mt-3 py-2 text-[10px] font-black uppercase rounded-lg flex items-center justify-center gap-1 ${
                      isCurrent ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-military-900 text-white hover:bg-military-800'
                    }`}>
                    <Zap size={11} /> {isCurrent ? 'Renew' : customer.sub ? 'Switch / Renew' : 'Assign Plan'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <History size={13} className="text-military-700" />
              <h3 className="text-xs font-black text-slate-800 uppercase">Payment / Subscription Record — {customer.customerId}</h3>
              <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border">{history.length}</span>
            </div>
            {history.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400 font-bold">Abhi koi record nahi</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>{['Date', 'Action', 'Plan', 'Amount', 'Valid Till', 'Remarks', 'By'].map(h => (
                      <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase text-left">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {history.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(h.at)}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            h.action === 'ASSIGNED' || h.action === 'ACTIVATED' ? 'bg-green-100 text-green-700'
                            : h.action === 'RENEWED' ? 'bg-blue-100 text-blue-700'
                            : h.action === 'EXTENDED' ? 'bg-indigo-100 text-indigo-700'
                            : h.action === 'ACCOUNT_CREATED' ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                          }`}>{h.action}</span>
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-700">{h.planName || '—'}</td>
                        <td className="px-3 py-2 font-black text-military-900">{h.amount > 0 ? formatINR(h.amount) : '—'}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{h.endDate ? formatDate(h.endDate) : '—'}</td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[150px]" title={h.remarks}>{h.remarks || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{h.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* PAYMENT MODAL */}
      {payModal && customer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-military-900 px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase flex items-center gap-2">
                <CreditCard size={14} className="text-amber-400" />
                {customer.sub ? 'Renew' : 'Assign'} — {payModal.name} → {customer.customerId}
              </h3>
              <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={handleAssign} className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-600"><span>Customer</span><span>{customer.unitName}</span></div>
                <div className="flex justify-between text-xs font-bold text-slate-600"><span>Plan</span><span>{payModal.name} ({payModal.durationMonths}M)</span></div>
                {customer.sub && new Date(customer.sub.endDate) > new Date() && (
                  <div className="flex justify-between text-[10px] font-bold text-green-700"><span>Bache hue din</span><span>+{subState.daysLeft} din add honge ✓</span></div>
                )}
                <div className="flex justify-between text-sm font-black text-military-900 border-t border-slate-200 pt-1.5 mt-1.5">
                  <span>Total</span><span>{formatINR(payModal.price)}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Mode *</label>
                <select value={payForm.paymentMode} onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-amber-500">
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Reference (Txn / PO No.)</label>
                <input value={payForm.paymentRef} onChange={e => setPayForm({ ...payForm, paymentRef: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-amber-500"
                  placeholder="e.g. TXN123 / PO/2026/1234" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
                <input value={payForm.remarks} onChange={e => setPayForm({ ...payForm, remarks: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-amber-500" placeholder="Optional" />
              </div>
              {customer.isLocalUnit && (
                <label className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={payForm.applyToUnit}
                    onChange={e => setPayForm({ ...payForm, applyToUnit: e.target.checked })}
                    className="accent-green-600 w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold text-green-800">🏠 Is app (unit) pe turant apply karo</span>
                </label>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={payLoading}
                  className="flex-1 bg-green-700 text-white py-2.5 text-xs font-black uppercase hover:bg-green-800 disabled:opacity-50 rounded-lg flex items-center justify-center gap-2">
                  {payLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Confirm {customer.sub ? 'Renew' : 'Assign'}
                </button>
                <button type="button" onClick={() => setPayModal(null)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════
// TAB 4 — PRACTICE SESSION (snapshot + cleanup)
// ═════════════════════════════════════════════
const PracticeTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<PracticeSnapshot | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setSnapshot(loadSnapshot());
    setMeta(await fetchSessionMeta());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sessionRunning = snapshot !== null;
  const wrongAccount = snapshot && snapshot.startedByUid !== user?.uid;
  const metaRunningButNoLocal = !snapshot && meta?.status === 'running';

  const handleStart = async () => {
    if (!user) return;
    setStarting(true); setError(''); setSuccess(''); setReport(null); setPlan(null);
    try {
      const snap = await startPracticeSession(user.uid, user.email ?? '', (done, total) => setProgress({ done, total }));
      setSnapshot(snap);
      setSuccess(`✓ Practice session shuru! ${KNOWN_COLLECTIONS.length} collections ka snapshot le liya. Test karo — wapas aake Clean dabana.`);
    } catch (err: any) { setError(`Snapshot failed: ${err.message}`); }
    finally { setStarting(false); setProgress(null); }
  };

  const handlePreview = async () => {
    setPreviewing(true); setError(''); setSuccess('');
    try { setPlan(await previewCleanup((done, total) => setProgress({ done, total }))); }
    catch (err: any) { setError(err.message); }
    finally { setPreviewing(false); setProgress(null); }
  };

  const handleClean = async () => {
    if (!plan || confirmText !== 'CLEAN') return;
    setCleaning(true); setError(''); setSuccess('');
    try {
      const rep = await runCleanup(plan, user?.email ?? 'dev');
      setReport(rep); setPlan(null); setConfirmText(''); setSnapshot(null);
      setSuccess(`✓ CLEAN! ${rep.totalDeleted} test docs delete, ${rep.restoredCount} restore. App pehle jaisa.`);
      await refresh();
    } catch (err: any) { setError(`Cleanup failed: ${err.message}`); }
    finally { setCleaning(false); }
  };

  const fmtTime = (iso?: unknown) =>
    iso ? new Date(String(iso)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-4">
      {success && <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-start gap-2"><CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> <span>{success}</span><button onClick={() => setSuccess('')} className="ml-auto"><X size={13} /></button></div>}
      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-start gap-2"><AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> <span>{error}</span><button onClick={() => setError('')} className="ml-auto"><X size={13} /></button></div>}

      {/* hint card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={() => navigate('/subscription')}
          className="bg-white border border-amber-300 rounded-xl p-3.5 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0"><Crown size={17} className="text-amber-600" /></div>
          <div>
            <p className="text-xs font-black text-slate-800 uppercase">Is Unit Ka Subscription</p>
            <p className="text-[10px] text-slate-500">Plans pricing edit / renew — classic view</p>
          </div>
        </button>
        <button onClick={() => navigate('/batches')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0"><Database size={17} className="text-green-700" /></div>
          <div>
            <p className="text-xs font-black text-slate-800 uppercase">App Explore Karo</p>
            <p className="text-[10px] text-slate-500">Batches / trainees sab dev-view me</p>
          </div>
        </button>
      </div>

      <div className={`bg-white border-2 rounded-xl overflow-hidden shadow-sm ${sessionRunning ? 'border-green-400' : 'border-slate-200'}`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${sessionRunning ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Database size={14} className={sessionRunning ? 'text-green-700' : 'text-slate-500'} />
            <h3 className="text-xs font-black text-slate-800 uppercase">Practice Session (1-click reset)</h3>
          </div>
          <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${sessionRunning ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
            {sessionRunning ? '● RUNNING' : '○ NOT STARTED'}
          </span>
        </div>

        <div className="p-5">
          {wrongAccount && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded p-3 text-[11px] text-red-700 font-semibold">
              ⚠ Ye session <strong>{snapshot?.startedByEmail}</strong> ne shuru kiya tha. Cleanup usi account se karo.
            </div>
          )}
          {metaRunningButNoLocal && (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded p-3 text-[11px] text-amber-800 font-semibold">
              ⚠ Ek session {String(meta?.startedByEmail ?? '')} ne {fmtTime(meta?.startedAt)} ko shuru kiya tha, lekin snapshot is browser me nahi hai — cleanup usi browser se hoga.
            </div>
          )}

          {!sessionRunning ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-4">
                "Start Practice" dabate hi poore DB ka snapshot banega. Uske baad jo kuch bhi karoge (batch/trainee/staff/kharcha) — 1 click pe clean.
                <br /><strong>Test Batch ka seed data isme shamil NAHI hota</strong> — wo permanent rahega.
              </p>
              <button onClick={handleStart} disabled={starting}
                className="bg-green-700 text-white px-8 py-3 text-sm font-black uppercase hover:bg-green-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-2">
                {starting ? <><Loader2 size={15} className="animate-spin" /> Snapshot... {progress ? `${progress.done}/${progress.total}` : ''}</> : <><Play size={15} /> Start Practice</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Started</p>
                  <p className="text-xs font-black text-slate-800">{fmtTime(snapshot.startedAt)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Collections Protected</p>
                  <p className="text-xs font-black text-slate-800">{KNOWN_COLLECTIONS.length}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Account</p>
                  <p className="text-xs font-black text-slate-800 truncate">{snapshot.startedByEmail}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                  ⚠ 2 rules: (1) Real records EDIT/DELETE mat karo — sirf naye banao.
                  (2) Practice akele karo + cleanup isi browser se.
                  Test Batch (isDevData tagged) <strong>cleanup se delete nahi hoga</strong> — wo permanent hai.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                <button onClick={handlePreview} disabled={previewing || cleaning}
                  className="bg-slate-700 text-white px-5 py-2.5 text-xs font-black uppercase hover:bg-slate-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-2">
                  {previewing ? <><Loader2 size={13} className="animate-spin" /> Scanning... {progress ? `${progress.done}/${progress.total}` : ''}</> : <><History size={13} /> Preview Cleanup</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PREVIEW */}
      {plan && (
        <div className="bg-white border-2 border-orange-400 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-orange-50 px-4 py-3 border-b border-orange-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 size={14} className="text-orange-700" />
              <h3 className="text-xs font-black text-slate-800 uppercase">Cleanup Preview</h3>
            </div>
            <span className="text-[10px] font-black text-orange-700 bg-white px-2.5 py-1 rounded-full border border-orange-300">
              {plan.totalDeletes} delete · {plan.restoreDocs.length} restore
            </span>
          </div>
          <div className="p-5 space-y-4">
            {plan.perCollection.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">Session ke baad koi change nahi mila.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>{['Collection', 'Test Docs (delete)', 'Real Affected'].map(h => (
                      <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase text-left">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {plan.perCollection.map(pc => (
                      <tr key={pc.name} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-700">{pc.name}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pc.toDelete.length ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                            {pc.toDelete.length} delete
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {pc.deletedDuring.length > 0 ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{pc.deletedDuring.length} restore/missing</span>
                          ) : <span className="text-[10px] text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {plan.lostDocs.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-[11px] text-red-700 font-bold flex items-start gap-1.5">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                ⚠ {plan.lostDocs.length} REAL documents practice me delete hue (restore nahi honge).
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-[10px] text-green-800 font-semibold flex items-start gap-1.5">
              <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
              Safe: Session se pehle ka data delete nahi hoga. isDevData seed bhi protected hai.
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <label className="text-[10px] font-black text-red-700 uppercase block">Confirm ke liye type karo: CLEAN</label>
              <div className="flex flex-wrap gap-3">
                <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                  placeholder="CLEAN"
                  className="border border-red-300 px-3 py-2 text-xs rounded w-40 focus:outline-none focus:border-red-500" />
                <button onClick={handleClean} disabled={confirmText !== 'CLEAN' || cleaning}
                  className="bg-red-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-red-700 disabled:opacity-40 rounded-lg inline-flex items-center gap-2">
                  {cleaning ? <><Loader2 size={13} className="animate-spin" /> Cleaning...</> : <><Trash2 size={13} /> Clean All Test Data</>}
                </button>
                <button onClick={() => { setPlan(null); setConfirmText(''); }}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {report && (
        <div className="bg-white border border-green-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-green-50 px-4 py-3 border-b border-green-200 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-700" />
            <h3 className="text-xs font-black text-slate-800 uppercase">Cleanup Report — {fmtTime(report.finishedAt)}</h3>
          </div>
          <div className="p-4">
            {report.deletedPerCollection.length === 0 ? (
              <p className="text-xs text-slate-500">Kuch delete karne ko tha hi nahi.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {report.deletedPerCollection.map(d => (
                  <span key={d.name} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-full border">
                    {d.name}: <strong className="text-red-600">−{d.count}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 🏋️ TEST BATCH CARD (Tab 3) — permanent demo data
// ─────────────────────────────────────────────
const TestBatchCard = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<{ collection: string; count: number }[]>([]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<'none' | 'generate' | 'wipe' | 'check'>('check');
  const [progress, setProgress] = useState<SeedProgress | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const totalDocs = counts.reduce((s, c) => s + c.count, 0);
  const exists = totalDocs > 0;

  const refreshCounts = useCallback(async () => {
    setCounts(await countDevSeedData());
    setChecked(true);
  }, []);

  useEffect(() => { setBusy('check'); refreshCounts().finally(() => setBusy('none')); }, [refreshCounts]);

  const handleGenerate = async () => {
    if (exists && !window.confirm(`Purana test data (${totalDocs} docs) WIPE hokar fresh batch banega. Pakka?`)) return;
    setBusy('generate'); setErr(''); setMsg('');
    try {
      if (exists) await wipeTestBatch(setProgress);
      const res = await generateTestBatch(setProgress);
      setMsg(`✓ TEST BATCH TAIYAAR! "TEST-77" (completed) — ${res.totalDocs} documents: 100 trainees + 20 staff + subjects + tests. /batches ya /profile kholo — sab SIRF TUMHE dikhega. Ye data permanent rahega jab tak Wipe na karo.`);
      await refreshCounts();
    } catch (e: any) { setErr(`Generate failed: ${e.message}`); }
    finally { setBusy('none'); setProgress(null); }
  };

  const handleWipe = async () => {
    if (!exists) return;
    if (!window.confirm(`${totalDocs} test documents PERMANENT delete ho jayenge. Pakka?`)) return;
    setBusy('wipe'); setErr(''); setMsg('');
    try {
      const n = await wipeTestBatch(setProgress);
      setMsg(`✓ ${n} test documents delete — test batch saaf.`);
      await refreshCounts();
    } catch (e: any) { setErr(`Wipe failed: ${e.message}`); }
    finally { setBusy('none'); setProgress(null); }
  };

  return (
    <div className="bg-white border-2 border-purple-300 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-purple-50 px-4 py-3 border-b border-purple-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={15} className="text-purple-700" />
          <h3 className="text-xs font-black text-slate-800 uppercase">
            Full Test Batch — 100 Trainees + 20 Staff (Permanent Demo)
          </h3>
        </div>
        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
          !checked ? 'bg-slate-200 text-slate-500' : exists ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
        }`}>
          {!checked ? 'CHECKING...' : exists ? `● SEEDED (${totalDocs} docs)` : '○ NOT SEEDED'}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Completed batch <strong>"{DEV_BATCH_NUMBER}"</strong> — purane batch jaisa poora data:
          <strong> 100 trainees</strong> (religion, state, mobile, medical, kit — full detail),
          <strong> 20 staff</strong>, <strong>8 subjects</strong> + assignments,
          <strong> FPT + weekly tests</strong> (pass/fail), absent/medical, attendance/leave/duty, schedule, programs.
          <br />
          <span className="text-purple-700 font-black">
            🔒 Sirf dev account ko dikhega — baaki kisi ko kabhi nahi.
          </span>
          <span className="text-green-700 font-black"> ♾️ Ye data PERMANENT rahega — jab tak tum khud Wipe/Practice-clean na karo (Practice cleanup isse touch nahi karta).</span>
        </p>

        {msg && <div className="bg-green-50 border border-green-300 text-green-800 px-3 py-2 rounded text-[11px] font-semibold flex items-start gap-1.5"><CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" /> {msg}</div>}
        {err && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-[11px] font-semibold flex items-start gap-1.5"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {err}</div>}

        {busy !== 'none' && progress && (
          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 transition-all"
                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 font-bold mt-1">{progress.step} — {progress.done}/{progress.total}</p>
          </div>
        )}

        {exists && busy === 'none' && (
          <div className="flex flex-wrap gap-1.5">
            {counts.map(c => (
              <span key={c.collection} className="text-[9px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                {c.collection}: {c.count}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-100">
          <button onClick={handleGenerate} disabled={busy !== 'none'}
            className="bg-purple-700 text-white px-5 py-2.5 text-xs font-black uppercase hover:bg-purple-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-2">
            {busy === 'generate' ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Dumbbell size={13} /> {exists ? 'Re-Generate (Wipe + Fresh)' : 'Generate Test Batch'}</>}
          </button>
          {exists && (
            <>
              <button onClick={handleWipe} disabled={busy !== 'none'}
                className="bg-red-50 border border-red-300 text-red-700 px-5 py-2.5 text-xs font-black uppercase hover:bg-red-100 disabled:opacity-50 rounded-lg inline-flex items-center gap-2">
                {busy === 'wipe' ? <><Loader2 size={13} className="animate-spin" /> Wiping...</> : <><Trash2 size={13} /> Wipe Test Data</>}
              </button>
              <button onClick={() => navigate('/batches')}
                className="bg-slate-700 text-white px-4 py-2.5 text-xs font-black uppercase hover:bg-slate-800 rounded-lg">
                View in App →
              </button>
            </>
          )}
        </div>

        <p className="text-[9px] text-slate-400 font-semibold flex items-start gap-1">
          <Info size={11} className="flex-shrink-0 mt-0.5" />
          Batch completed hai — asli active batch touch nahi hota. Collections: {SEEDED_COLLECTIONS.length}. Demo dene ke liye perfect (kal kisi ko app dikhaoge to ready-made company milegi).
        </p>
      </div>
    </div>
  );
};

export default DevPracticeScreen;
