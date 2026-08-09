// src/features/auth/FirstRunSetupScreen.tsx
// ═════════════════════════════════════════════════════════════
// 🚀 FIRST-RUN COMPANY SETUP WIZARD
//
// Nayi company ka FRESH deployment: URL/<projectId>.web.app/first-run
// kholo → ye wizard chalao → company ready:
//   ① Pehla (aur akela setup-time) CC account  ② Company letterhead
//   ③ Subscription plan activate (subscription/current)
//   ④ config/firstRun marker (doobara nahi chalega)
//
// SAFETY:
//  - Agar users collection pehle se bhari hai → wizard ROK deta hai,
//    abhi-abhi bana auth user DELETE kar deta hai.
//  - Login ho rakha ho to wizard nahi chalega (pehle logout).
//  - Ye page sirf CUSTOMER deployments ke liye hai —
//    master app pe users pehle se hain, isliye wahan auto-bounce.
// ═════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword, signOut, User,
} from 'firebase/auth';
import {
  collection, doc, getDocs, setDoc, addDoc, limit, query,
} from 'firebase/firestore';
import { auth, db , firebaseConfig } from '../../config/firebase';
import {
  AlertTriangle, CheckCircle2, Loader2, Building2, Rocket,
} from 'lucide-react';
import { fetchPlans } from '../subscription/api/subscription.api';
import {
  SubscriptionPlan, addMonths, PAYMENT_MODES,
} from '../subscription/types/subscription.types';

interface WizardForm {
  parentUnit: string;      // e.g. STC Tekanpur
  companyShort: string;    // e.g. B-COY
  companyName: string;     // e.g. Bravo Company
  location: string;        // e.g. Gwalior, MP
  commanderName: string;   // e.g. Insp. R.K. Verma
  email: string;
  password: string;
  phone: string;
}

const EMPTY: WizardForm = {
  parentUnit: '', companyShort: '', companyName: '', location: '',
  commanderName: '', email: '', password: '', phone: '',
};

export const FirstRunSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<WizardForm>(EMPTY);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ email: string; unit: string; ownerKey: string } | null>(null);
  const [blockedLoggedIn, setBlockedLoggedIn] = useState(false);

  // 🔒 Guard 1: koi logged-in hai to wizard nahi chalega
  useEffect(() => {
    setBlockedLoggedIn(Boolean(auth.currentUser));
  }, []);

  // Plans load (wizard ke liye) — fresh app pe auth nahi hai, isliye
  // yahan load nahi hota; submit ke time (auth banne ke BAAD) load hoga.
  // Seed default ids pehle se rakhte hain taaki dropdown render ho:
  useEffect(() => { if (!planId) setPlanId('monthly'); }, [planId]);

  const inputCls = 'w-full border border-slate-300 bg-white px-3 py-2 text-sm rounded focus:outline-none focus:border-military-700';
  const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1';

  // ── MAIN FLOW ──
  const runSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password min 6 characters'); return; }
    const email = form.email.trim().toLowerCase();
    const unitName = form.companyShort.trim() || form.companyName.trim();
    if (!unitName || !form.commanderName.trim() || !email) {
      setError('Company short name, Commander name aur Email zaroori hain.'); return;
    }

    setBusy(true);
    let createdUser: User | null = null;
    try {
      // ── Step 1: Auth account banao (fresh app pe pehla account) ──
      setStep('1/6 · Login account ban raha hai...');
      const cred = await createUserWithEmailAndPassword(auth, email, form.password);
      createdUser = cred.user;

      // ── Step 2: SAFETY — kya app already setup hai? ──
      setStep('2/6 · Setup status verify...');
      const existing = await getDocs(query(collection(db, 'users'), limit(2)));
      if (!existing.empty) {
        // Koi aur pehle se hai → ye app already ki hui hai.
        // Abhi-Abhi bana hua account nuksan na de — vapas delete:
        try { await createdUser.delete(); } catch { /* best-effort */ }
        try { await signOut(auth); } catch { /* noop */ }
        setError(
          '⚠️ Ye app PEHLE SE setup ho chuki hai (users maujood hain). ' +
          'Wizard dobara nahi chalaya ja sakta. /login se login karo. ' +
          '(Safety: abhi bana hua account auto-delete kar diya gaya.)'
        );
        setBusy(false); setStep('');
        return;
      }

      // ── Step 3: CC ka users doc ──
      setStep('3/6 · Company Commander profile...');
      const now = new Date().toISOString();
      await setDoc(doc(db, 'users', createdUser.uid), {
        name: form.commanderName.trim(),
        email,
        phone: form.phone.trim(),
        designation: `Company Commander — ${unitName}`,
        role: 'Company Commander',
        isActive: true,
        isDeveloper: false,   // customer app me dev sandbox kaam nahi aata
        customerId: null,     // master app ka billing alag hai
        unitName,
        createdAt: now,
        createdBy: 'FIRST-RUN-WIZARD',
      });

      // ── Step 4: Company letterhead ──
      setStep('4/6 · Unit letterhead set...');
      await setDoc(doc(db, 'unitConfig', 'main'), {
        parentUnit: form.parentUnit.trim(),
        companyName: form.companyName.trim() || unitName,
        companyShort: form.companyShort.trim(),
        location: form.location.trim(),
        commanderName: form.commanderName.trim(),
        updatedAt: now,
        updatedBy: 'FIRST-RUN-WIZARD',
      }, { merge: true });

      // ── Step 5: Subscription plan activate ──
      setStep('5/6 · Subscription plan activate...');
      const allPlans = await fetchPlans(); // pehli baar me defaults seed ho jaate hain
      setPlans(allPlans);
      const plan = allPlans.find(p => p.id === planId) ?? allPlans[0];
      // Owner ka secret renew key — company ko kabhi mat dena (master notes me save karo)
      const ownerKey = 'OWN-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      if (plan) {
        const start = new Date();
        const end = addMonths(start, plan.durationMonths);
        await setDoc(doc(db, 'subscription', 'current'), {
          planId: plan.id,
          planName: plan.name,
          durationMonths: plan.durationMonths,
          amount: plan.price,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          paymentMode: payMode,
          paymentRef: payRef.trim() || 'FIRST-RUN',
          remarks: `First-run activation — ${unitName}`,
          updatedAt: now,
          updatedBy: email,
          ownerKey,
        });
        await addDoc(collection(db, 'subscriptionHistory'), {
          action: 'ACTIVATED',
          planId: plan.id, planName: plan.name, amount: plan.price,
          startDate: start.toISOString(), endDate: end.toISOString(),
          remarks: `First-run activation — ${unitName}`, by: email, at: now,
        });
      }

      // ── Step 6: Setup marker (doobara mat chalne de) ──
      setStep('6/6 · Locking setup...');
      await setDoc(doc(db, 'config', 'firstRun'), {
        completed: true,
        company: unitName,
        at: now,
        by: email,
      });

      await signOut(auth);
      setDone({ email, unit: unitName, ownerKey });
    } catch (err: unknown) {
      const fe = err as { code?: string; message?: string };
      if (fe.code === 'auth/email-already-in-use') {
        setError('Ye email already registered hai — shayad ye app pehle se setup hai. /login try karo.');
      } else if (fe.code === 'auth/weak-password') {
        setError('Password bahut weak hai (min 6 characters).');
      } else {
        setError(`Setup fail hua: ${fe.message ?? String(err)}`);
      }
      // Partially created auth ko chhodo mat — best effort cleanup
      if (createdUser) {
        try { await createdUser.delete(); } catch { /* noop */ }
        try { await signOut(auth); } catch { /* noop */ }
      }
    } finally {
      setBusy(false); setStep('');
    }
  };

  // ── DONE SCREEN ──
  if (done) {
    return (
      <div className="min-h-screen bg-military-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border-t-8 border-green-600 shadow-2xl rounded-sm p-8 text-center space-y-4">
          <CheckCircle2 size={48} className="text-green-600 mx-auto" />
          <h1 className="text-xl font-black text-military-900 uppercase">{done.unit} — Setup Complete 🎉</h1>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">
            Company Commander account, letterhead aur subscription plan — sab set ho gaya.
            Ab company ko ye login de do:
          </p>
          <div className="bg-amber-50 border-2 border-amber-400 rounded p-3 text-left space-y-1">
            <div className="text-[10px] font-black text-amber-700 uppercase">🔑 Owner Key (renewal ke liye) — SAVE KAR LO ABHI</div>
            <div className="text-base font-black text-amber-800 tracking-widest">{done.ownerKey}</div>
            <div className="text-[9px] font-bold text-amber-700 leading-snug">
              Ye key MASTER app ke customer record ke Notes me save karo. Expire hone pe app LOCK ho jayegi —
              renewal sirf ISI key se hoga. Company ko ye key KABHI mat dena.
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-left space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase">CC Login Email</div>
            <div className="text-sm font-black text-military-900">{done.email}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Password</div>
            <div className="text-xs font-bold text-slate-600">(jo wizard me dala tha — company ko bata do)</div>
          </div>
          <button onClick={() => navigate('/login')}
            className="w-full bg-military-800 text-white font-black uppercase text-xs py-3 hover:bg-military-900 transition-colors">
            Login Page pe Jao →
          </button>
        </div>
      </div>
    );
  }

  // ── PERMANENT GUARD 0: MASTER app pe wizard KABHI nahi (confusion-ka-jad band) ──
  // Master (training-command-erp) = sirf Owner Console + MASTER COY testing.
  // Company setup SIRF uski ALAG app pe hota hai (deploy script se banti hai).
  if (firebaseConfig.projectId === 'training-command-erp') {
    return (
      <div className="min-h-screen bg-military-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border-t-8 border-red-600 shadow-2xl rounded-sm p-8 text-center space-y-4">
          <AlertTriangle size={40} className="text-red-600 mx-auto" />
          <h1 className="text-lg font-black text-military-900 uppercase">Ye MASTER App Hai — Wizard Yahan Nahi</h1>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">
            Ye app sirf <strong>Owner Console + MASTER COY (testing company)</strong> hai.
            Yahan KOI real company setup nahi hoti (na A Coy, na koi).
          </p>
          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
            Nayi company chahiye to VS Code me <strong>New-CompanyApp.ps1 -Code &lt;code&gt;</strong> chalao —
            uski ALAG app banegi, aur wizard WAHAN chalega (fcoy-erp-&lt;code&gt;.web.app/first-run).
          </p>
          <button onClick={() => navigate('/login')}
            className="w-full bg-military-800 text-white font-black uppercase text-xs py-2.5 hover:bg-military-700">
            Login pe wapas
          </button>
        </div>
      </div>
    );
  }

  // ── BLOCKED (logged-in) SCREEN ──
  if (blockedLoggedIn) {
    return (
      <div className="min-h-screen bg-military-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border-t-8 border-amber-500 shadow-2xl rounded-sm p-8 text-center space-y-4">
          <AlertTriangle size={40} className="text-amber-500 mx-auto" />
          <h1 className="text-lg font-black text-military-900 uppercase">Wizard Locked</h1>
          <p className="text-xs text-slate-600 font-semibold">
            Tum already logged-in ho. First-Run wizard sirf FRESH company app pe chalta hai.
            (Agar ye nayi app hai to pehle logout karo, phir /first-run kholo.)
          </p>
          <button onClick={async () => { await signOut(auth); setBlockedLoggedIn(false); }}
            className="w-full bg-amber-600 text-white font-black uppercase text-xs py-2.5 hover:bg-amber-700">
            Logout & Continue Setup
          </button>
          <button onClick={() => navigate('/login')}
            className="w-full text-[11px] font-bold text-military-700 underline">
            Login pe wapas
          </button>
        </div>
      </div>
    );
  }

  // ── WIZARD FORM ──
  return (
    <div className="min-h-screen bg-military-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border-t-8 border-military-700 shadow-2xl rounded-sm overflow-hidden">
        <div className="bg-military-900 px-6 py-5">
          <div className="flex items-center gap-2 text-green-400">
            <Rocket size={18} />
            <span className="text-[10px] font-black uppercase tracking-[.25em]">First-Run Setup · New Company</span>
          </div>
          <h1 className="text-xl font-black text-white uppercase mt-1">Company App Setup Wizard</h1>
          <p className="text-[11px] text-slate-300 mt-1">
            Ye sirf EK baar chalta hai — is company ka pehla CC account + letterhead + subscription turant ready.
          </p>
        </div>

        <form onSubmit={runSetup} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-xs font-bold flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Parent Unit (e.g. STC Tekanpur) *</label>
              <input required value={form.parentUnit} onChange={e => setForm({ ...form, parentUnit: e.target.value })}
                className={inputCls} placeholder="STC Tekanpur" />
            </div>
            <div>
              <label className={labelCls}>Company Short (e.g. B-COY) *</label>
              <input required value={form.companyShort} onChange={e => setForm({ ...form, companyShort: e.target.value })}
                className={inputCls} placeholder="B-COY" />
            </div>
            <div>
              <label className={labelCls}>Company Full Name *</label>
              <input required value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })}
                className={inputCls} placeholder="Bravo Company" />
            </div>
            <div>
              <label className={labelCls}>Location / Station</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className={inputCls} placeholder="Gwalior, MP" />
            </div>
            <div>
              <label className={labelCls}>Commander Name & Rank *</label>
              <input required value={form.commanderName} onChange={e => setForm({ ...form, commanderName: e.target.value })}
                className={inputCls} placeholder="Insp. R.K. Verma" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className={inputCls} placeholder="10 digit" />
            </div>
            <div>
              <label className={labelCls}>CC Login Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className={inputCls} placeholder="cc.bcoy@gmail.com" />
            </div>
            <div>
              <label className={labelCls}>CC Login Password *</label>
              <input type="text" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className={inputCls} placeholder="Min 6 chars (company ko dena)" />
            </div>
          </div>

          <div className="border border-green-200 bg-green-50 rounded p-3 space-y-2">
            <div className="text-[10px] font-black text-green-800 uppercase">Subscription Plan (pehli activation)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={planId} onChange={e => setPlanId(e.target.value)}
                className="border border-slate-300 px-2 py-2 text-xs rounded bg-white">
                <option value="monthly">Monthly (1 month)</option>
                <option value="quarterly">Quarterly (3 months)</option>
                <option value="yearly">Yearly (12 months)</option>
              </select>
              <select value={payMode} onChange={e => setPayMode(e.target.value)}
                className="border border-slate-300 px-2 py-2 text-xs rounded bg-white">
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={payRef} onChange={e => setPayRef(e.target.value)}
                className="border border-slate-300 px-2 py-2 text-xs rounded bg-white"
                placeholder="Txn / PO ref (optional)" />
            </div>
            <p className="text-[9px] font-semibold text-green-700">
              Plan `subscription/current` pe turant activate hoga — app unlock. Amount plan master se aayega{plans.length > 0 ? '' : ' (save pe load hoga)'}.
            </p>
          </div>

          <button type="submit" disabled={busy}
            className="w-full bg-military-800 text-white font-black uppercase text-xs py-3 hover:bg-military-900 disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <><Loader2 size={14} className="animate-spin" /> {step}</> : <><Building2 size={14} /> Setup Complete Karo</>}
          </button>
          <button type="button" onClick={() => navigate('/login')}
            className="w-full text-[11px] font-bold text-military-700 underline">
            ← Login pe wapas
          </button>
        </form>
      </div>
    </div>
  );
};
