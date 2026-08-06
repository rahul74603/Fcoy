// src/features/developer/DevPracticeScreen.tsx
// ─────────────────────────────────────────────
// 🧪 DEVELOPER PRACTICE CONSOLE
// Dev account se login karke yahan:
//   1. "Start Practice" → DB snapshot
//   2. Poore app me kuch bhi test karo (batch/trainee/staff...)
//   3. "Clean" → session ka poora naya data DELETE,
//      real data bilkul safe (snapshot guarantee)
// CC (non-dev) ko yahan sirf "Dev Account Create" card dikhta hai.
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Play, Trash2, ShieldCheck, AlertTriangle,
  Loader2, CheckCircle2, X, RefreshCw, UserPlus, Eye, EyeOff,
  Database, History, Ban, Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db } from '../../config/firebase';
import {
  loadSnapshot, startPracticeSession, previewCleanup, runCleanup,
  fetchSessionMeta, KNOWN_COLLECTIONS,
  CleanupPlan, CleanupReport, PracticeSnapshot,
} from './api/devPractice.api';

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const DevPracticeScreen = () => {
  const { user } = useAuth();

  // ⚠️ Hooks hamesha unconditional — isliye gates se PEHLE
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const isCommander = user?.role === 'Company Commander';
  const isDevAccount = Boolean(user?.isDeveloper);

  const inputCls = 'w-full border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-orange-600 bg-white rounded';
  const labelCls = 'text-[10px] font-bold text-slate-500 uppercase block mb-1';

  // ═════════════════════════════════════════
  // GATE 1 — Sirf CC ya Dev account
  // ═════════════════════════════════════════
  if (!isCommander && !isDevAccount) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <Ban size={32} className="mx-auto mb-3 text-red-400" />
        <h2 className="text-sm font-black text-red-700 uppercase">Access Denied</h2>
        <p className="text-xs text-red-600 mt-1">
          Ye page sirf Company Commander aur Developer account ke liye hai.
        </p>
      </div>
    );
  }

  // ═════════════════════════════════════════
  // GATE 2 — CC (non-dev): Dev Account Create karo
  // ═════════════════════════════════════════
  if (!isDevAccount) {
    return <CreateDevAccountCard inputCls={inputCls} labelCls={labelCls} />;
  }

  // ─── DEV CONSOLE (dev account logged in) ───
  return <DevConsole success={success} setSuccess={setSuccess} error={error} setError={setError} />;
};

// ─────────────────────────────────────────────
// CARD: Create Developer Account (CC only)
// ─────────────────────────────────────────────
const CreateDevAccountCard = ({ inputCls, labelCls }: { inputCls: string; labelCls: string }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: 'Dev Tester',
    email: 'developer@fcoy.com',
    password: '',
    cmdPassword: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showCmdPw, setShowCmdPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Dev password min 6 characters ka hona chahiye'); return; }
    if (!form.cmdPassword) { setError('Apna (Commander) password enter karo'); return; }

    setLoading(true);
    setError(''); setSuccess('');
    const ccEmail = user?.email ?? '';

    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, form.email, form.password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: form.name,
        email: form.email,
        phone: '',
        designation: 'Developer (Practice Account)',
        role: 'Company Commander', // full access — practice ke liye
        isDeveloper: true,         // 🧪 dev flag — console + banner isi se chalte hain
        isActive: true,
        createdBy: user?.uid ?? '',
        createdAt: new Date().toISOString(),
      });
      // Wapas CC login (create ne auto-switch kar diya tha)
      await signInWithEmailAndPassword(firebaseAuth, ccEmail, form.cmdPassword);
      setSuccess(`✓ Developer account ban gaya! Ab LOGOUT karke "${form.email}" se login karo — 🧪 Practice Console wahan milega.`);
      setForm({ ...form, password: '', cmdPassword: '' });
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Ye email already registered hai. Settings se isDeveloper flag check karo ya dusra email use karo.');
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError('Aapka (Commander) password galat hai');
      else setError(`Error: ${err.message}`);
      try { await signInWithEmailAndPassword(firebaseAuth, ccEmail, form.cmdPassword); } catch { /* already in */ }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-8">
      <div className="border-b-2 border-orange-600 pb-3">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <FlaskConical size={22} className="text-orange-600" />
          Developer Practice Zone
        </h1>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">
          Testing / practice ke liye alag developer account banao
        </p>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-[11px] text-orange-800 font-semibold leading-relaxed">
          <strong>Kyun?</strong> Dev account se login karke jo bhi karoge — batch banana, trainees
          add/delete, staff, kharcha — sab <strong>Practice Console</strong> se ek click me clean ho jayega.
          Aapke real account ka data bilkul alag aur safe rahega.
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-orange-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <UserPlus size={14} className="text-orange-700" />
          <h3 className="text-xs font-black text-slate-800 uppercase">Create Developer Account</h3>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Dev Account Ka Naam</label>
            <input type="text" required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dev Email *</label>
            <input type="email" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dev Password *</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} required minLength={6}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className={inputCls} placeholder="Min 6 characters" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <label className="text-[10px] font-black text-amber-800 uppercase block mb-1.5">
              🔐 Aapka (Commander) Password * — account banne ke baad system aapko wapas login karega
            </label>
            <div className="relative">
              <input type={showCmdPw ? 'text' : 'password'} required
                value={form.cmdPassword}
                onChange={e => setForm({ ...form, cmdPassword: e.target.value })}
                className="w-full border border-amber-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-amber-500 bg-white" />
              <button type="button" onClick={() => setShowCmdPw(!showCmdPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showCmdPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-orange-600 text-white py-2.5 text-xs font-black uppercase hover:bg-orange-700 disabled:opacity-50 rounded flex items-center justify-center gap-2">
            {loading
              ? <><Loader2 size={13} className="animate-spin" /> Creating...</>
              : <><UserPlus size={13} /> Create Dev Account</>}
          </button>
        </form>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-[10px] text-slate-500 font-semibold flex items-start gap-1.5">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          Account banne ke baad: <strong>Logout → dev email se Login</strong> → sidebar me
          <strong> "🧪 Dev Practice"</strong> section dikhega aur upar orange PRACTICE MODE banner aayega.
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// DEV CONSOLE — Start / Preview / Clean
// ─────────────────────────────────────────────
const DevConsole = ({
  success, setSuccess, error, setError,
}: {
  success: string; setSuccess: (s: string) => void;
  error: string; setError: (s: string) => void;
}) => {
  const { user } = useAuth();

  const [snapshot, setSnapshot] = useState<PracticeSnapshot | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [report, setReport] = useState<CleanupReport | null>(null);

  const refresh = useCallback(async () => {
    setSnapshot(loadSnapshot());
    setMeta(await fetchSessionMeta());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sessionRunning = snapshot !== null;
  const wrongAccount = snapshot && snapshot.startedByUid !== user?.uid;
  const metaRunningButNoLocal = !snapshot && meta?.status === 'running';

  // ── START ──
  const handleStart = async () => {
    if (!user) return;
    setStarting(true);
    setError(''); setSuccess(''); setReport(null); setPlan(null);
    try {
      const snap = await startPracticeSession(
        user.uid, user.email ?? '',
        (done, total) => setProgress({ done, total }),
      );
      setSnapshot(snap);
      setSuccess(`✓ Practice session shuru! ${KNOWN_COLLECTIONS.length} collections ka snapshot le liya. Ab poore app me kuch bhi test karo — wapas aake "Clean" dabana, sab gayab ho jayega.`);
    } catch (err: any) {
      setError(`Snapshot failed: ${err.message}`);
    } finally {
      setStarting(false);
      setProgress(null);
    }
  };

  // ── PREVIEW ──
  const handlePreview = async () => {
    setPreviewing(true);
    setError(''); setSuccess('');
    try {
      const p = await previewCleanup((done, total) => setProgress({ done, total }));
      setPlan(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewing(false);
      setProgress(null);
    }
  };

  // ── CLEAN ──
  const handleClean = async () => {
    if (!plan || confirmText !== 'CLEAN') return;
    setCleaning(true);
    setError(''); setSuccess('');
    try {
      const rep = await runCleanup(plan, user?.email ?? 'dev');
      setReport(rep);
      setPlan(null);
      setConfirmText('');
      setSnapshot(null);
      setSuccess(`✓ CLEAN HO GAYA! ${rep.totalDeleted} test documents delete, ${rep.restoredCount} real documents restore. App bilkul pehle jaisa.`);
      await refresh();
    } catch (err: any) {
      setError(`Cleanup failed: ${err.message}`);
    } finally {
      setCleaning(false);
    }
  };

  const fmtTime = (iso?: string | unknown) =>
    iso ? new Date(String(iso)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-8">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-end border-b-2 border-orange-600 pb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FlaskConical size={22} className="text-orange-600" />
            🧪 Practice Console
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Test karo bindaas — Clean dabate hi sab kuch pehle jaisa
          </p>
        </div>
        <button onClick={refresh}
          className="p-2 text-orange-700 hover:bg-orange-50 border border-orange-300 rounded">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── ALERTS ── */}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* ── SESSION STATUS CARD ── */}
      <div className={`bg-white border-2 rounded-xl overflow-hidden shadow-sm ${
        sessionRunning ? 'border-green-400' : 'border-slate-200'
      }`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          sessionRunning ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Database size={14} className={sessionRunning ? 'text-green-700' : 'text-slate-500'} />
            <h3 className="text-xs font-black text-slate-800 uppercase">Practice Session</h3>
          </div>
          <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
            sessionRunning ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
          }`}>
            {sessionRunning ? '● RUNNING' : '○ NOT STARTED'}
          </span>
        </div>

        <div className="p-5">
          {wrongAccount && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded p-3 text-[11px] text-red-700 font-semibold">
              ⚠ Ye session <strong>{snapshot?.startedByEmail}</strong> ne shuru kiya tha.
              Cleanup sirf usi account se karo.
            </div>
          )}
          {metaRunningButNoLocal && (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded p-3 text-[11px] text-amber-800 font-semibold">
              ⚠ Ek session <strong>{String(meta?.startedByEmail ?? '')}</strong> ne{' '}
              {fmtTime(meta?.startedAt)} ko shuru kiya tha, lekin uska snapshot is browser me nahi hai.
              Cleanup <strong>usi browser/device</strong> se karna hoga jahan session start hua tha.
            </div>
          )}

          {!sessionRunning ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-4">
                "Start Practice" dabate hi poore database ka snapshot ban jayega.
                Uske baad jo bhi add/delete karoge wo baad me 1 click se clean hoga.
              </p>
              <button
                onClick={handleStart}
                disabled={starting}
                className="bg-green-700 text-white px-8 py-3 text-sm font-black uppercase hover:bg-green-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-2"
              >
                {starting
                  ? <><Loader2 size={15} className="animate-spin" /> Snapshot ban raha... {progress ? `${progress.done}/${progress.total}` : ''}</>
                  : <><Play size={15} /> Start Practice</>}
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-[11px] text-blue-800 font-semibold leading-relaxed">
                  ✅ <strong>Ab practice karo:</strong> naye batch banao, trainees add/delete karo,
                  staff, kharcha, issue — kuch bhi. Jab free ho, wapas aao →{' '}
                  <strong>Preview</strong> → <strong>Clean</strong>. Sab pehle jaisa ho jayega.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                  ⚠ <strong>2 rules:</strong> (1) Real records ko EDIT/DELETE mat karo — naye hi banao.
                  (2) Practice akele karo — is window me dusre user ka naya data bhi clean me aa jayega.
                  Cleanup isi browser se karna (snapshot yahi saved hai).
                </p>
              </div>

              {/* ── PREVIEW + CLEAN ACTIONS ── */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={handlePreview}
                  disabled={previewing || cleaning}
                  className="bg-slate-700 text-white px-5 py-2.5 text-xs font-black uppercase hover:bg-slate-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-2"
                >
                  {previewing
                    ? <><Loader2 size={13} className="animate-spin" /> Scanning... {progress ? `${progress.done}/${progress.total}` : ''}</>
                    : <><History size={13} /> Preview Cleanup</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PREVIEW RESULT ── */}
      {plan && (
        <div className="bg-white border-2 border-orange-400 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-orange-50 px-4 py-3 border-b border-orange-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 size={14} className="text-orange-700" />
              <h3 className="text-xs font-black text-slate-800 uppercase">Cleanup Preview</h3>
            </div>
            <span className="text-[10px] font-black text-orange-700 bg-white px-2.5 py-1 rounded-full border border-orange-300">
              {plan.totalDeletes} test docs delete honge · {plan.restoreDocs.length} real docs restore
            </span>
          </div>

          <div className="p-5 space-y-4">
            {plan.totalDeletes === 0 && plan.restoreDocs.length === 0 && plan.lostDocs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">
                Session start ke baad koi change nahi mila. Clean karne ki zaroorat nahi —
                lekin dabana ho to daba sakte ho (session band ho jayega).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Collection', 'Test Docs (delete)', 'Real Docs Affected'].map(h => (
                        <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {plan.perCollection.map(pc => (
                      <tr key={pc.name} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-700">{pc.name}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            pc.toDelete.length ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {pc.toDelete.length} delete
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {pc.deletedDuring.length > 0 ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              {pc.deletedDuring.length} restore/missing
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Real-data loss warning */}
            {plan.lostDocs.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                <p className="text-[11px] text-red-700 font-bold flex items-start gap-1.5">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  ⚠ {plan.lostDocs.length} REAL documents practice ke dauraan delete hue hain
                  (inka data restore nahi hoga — batches/users/config wagairah automatically restore ho jayenge).
                </p>
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-[10px] text-green-800 font-semibold flex items-start gap-1.5">
                <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
                Safe guarantee: Session se PEHLE ka koi bhi data delete nahi hoga.
                Active batch, unit config, subscription, users — sab wapas restore.
              </p>
            </div>

            {/* Confirm */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <label className="text-[10px] font-black text-red-700 uppercase block">
                Confirm ke liye type karo: CLEAN
              </label>
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="CLEAN"
                  className="border border-red-300 px-3 py-2 text-xs rounded w-40 focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={handleClean}
                  disabled={confirmText !== 'CLEAN' || cleaning}
                  className="bg-red-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-red-700 disabled:opacity-40 rounded-lg inline-flex items-center gap-2"
                >
                  {cleaning
                    ? <><Loader2 size={13} className="animate-spin" /> Cleaning...</>
                    : <><Trash2 size={13} /> Clean All Test Data</>}
                </button>
                <button
                  onClick={() => { setPlan(null); setConfirmText(''); }}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LAST CLEAN REPORT ── */}
      {report && (
        <div className="bg-white border border-green-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-green-50 px-4 py-3 border-b border-green-200 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-700" />
            <h3 className="text-xs font-black text-slate-800 uppercase">
              Cleanup Report — {fmtTime(report.finishedAt)}
            </h3>
          </div>
          <div className="p-4">
            {report.deletedPerCollection.length === 0 ? (
              <p className="text-xs text-slate-500">Kuch delete karne ko tha hi nahi — app pehle se clean tha.</p>
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

export default DevPracticeScreen;
