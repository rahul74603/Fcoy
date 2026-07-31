// ═══════════════════════════════════════════════════════════════════════════
// DEV TEST LAB — developer-only hidden test batch (150 trainees + 20 staff)
// ★ New feature (owner request 31-Jul-2026): testing ke liye fake data,
//   normal users se hidden, ek click me poori tarah deletable, handover clean.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Trash2, Eye, EyeOff, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  DEV_TEST_BATCH_ID, isDevMode, setDevMode,
  seedDevTestData, deleteDevTestData, getDevTestCounts,
  type DevTestCounts,
} from './devSeed';

const DevTestLabSection: React.FC = () => {
  const { user } = useAuth();
  const [devOn, setDevOn] = useState<boolean>(false);
  const [counts, setCounts] = useState<DevTestCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  const push = (msg: string) =>
    setProgress((p) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...p].slice(0, 30));

  const loadCounts = useCallback(async () => {
    try { setCounts(await getDevTestCounts()); }
    catch (e) { push(`❌ counts error: ${e instanceof Error ? e.message : 'unknown'}`); }
  }, []);

  useEffect(() => { setDevOn(isDevMode()); loadCounts(); }, [loadCounts]);

  const toggleDevMode = () => {
    const next = !devOn;
    setDevMode(next);
    setDevOn(next);
    push(next
      ? '👁 Dev Mode ON — test batch ab tumhe dikhega (refresh ho raha hai…)'
      : '🙈 Dev Mode OFF — test batch hidden (refresh ho raha hai…)');
    setTimeout(() => window.location.reload(), 500);
  };

  const handleCreate = async () => {
    if (counts && counts.trainees > 0) {
      if (!window.confirm(`Test data pehle se maujood hai (${counts.trainees} trainees, ${counts.staff} staff).\nDobara create duplicate karega. Continue?`)) return;
    } else if (!window.confirm('DEV TEST BATCH + 150 fake trainees + 20 fake staff banayein?\n(Sab hidden honge, marker ke saath — baad me 1 click me delete honge)')) return;
    setBusy(true);
    try {
      const r = await seedDevTestData(user?.uid ?? 'dev', push);
      push(`✅ Created: batch=${r.batchId}, trainees=${r.created.trainees}, staff=${r.created.staff}`);
      if (!devOn) push('💡 Dev Mode ON karo taaki test batch tumhe app me dikhe');
      await loadCounts();
    } catch (e) {
      push(`❌ create error: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('🗑 Saara TEST data permanently delete? (sirf marked fake docs — real data touch nahi hoga)')) return;
    if (!window.confirm('Final confirm: delete chalaya jaaye?')) return;
    setBusy(true);
    try {
      const r = await deleteDevTestData(push);
      push(`🧹 Deleted total ${r.total} docs → ${JSON.stringify(r.deleted)}`);
      await loadCounts();
    } catch (e) {
      push(`❌ delete error: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border-2 border-indigo-300 rounded-xl overflow-hidden">
      <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-200">
        <h2 className="text-sm font-black text-indigo-900 uppercase flex items-center gap-2">
          <FlaskConical size={16} /> 🧪 Dev Test Lab — Hidden Fake Batch
        </h2>
        <p className="text-[10px] text-indigo-700 mt-0.5">
          150 fake trainees + 20 fake staff · normal users se hidden · handover se pehle 1-click clean
        </p>
      </div>

      <div className="p-5 space-y-3">
        {/* Dev mode toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <p className="text-xs font-bold text-slate-800">👁 Dev Mode (test batch dikhana)</p>
            <p className="text-[10px] text-slate-500">
              Sirf tumhare browser me. Naye aadmi ke computer me ye OFF hi rahega — use kabhi nahi dikhega.
            </p>
          </div>
          <button
            onClick={toggleDevMode}
            className={`px-4 py-2 text-xs font-black rounded-lg uppercase flex items-center gap-2 ${
              devOn ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}
          >
            {devOn ? <><Eye size={14} /> ON</> : <><EyeOff size={14} /> OFF</>}
          </button>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <p className="text-xl font-black text-indigo-700">{counts === null ? '…' : counts.batch ? '✓' : '—'}</p>
            <p className="text-[10px] font-bold text-indigo-600">Hidden Batch</p>
          </div>
          <div className="p-2 bg-indigo-50 rounded-lg">
            <p className="text-xl font-black text-indigo-700">{counts?.trainees ?? '…'}</p>
            <p className="text-[10px] font-bold text-indigo-600">Fake Trainees</p>
          </div>
          <div className="p-2 bg-indigo-50 rounded-lg">
            <p className="text-xl font-black text-indigo-700">{counts?.staff ?? '…'}</p>
            <p className="text-[10px] font-bold text-indigo-600">Fake Staff</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCreate} disabled={busy}
            className="py-3 bg-indigo-600 text-white text-xs font-black uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            Create Test Data
          </button>
          <button
            onClick={handleDelete} disabled={busy}
            className="py-3 bg-red-600 text-white text-xs font-black uppercase rounded-lg hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete Test Data
          </button>
        </div>
        <button
          onClick={loadCounts} disabled={busy}
          className="w-full py-2 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2"
        >
          <RefreshCw size={12} /> Refresh Counts
        </button>

        {/* Notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
          <ShieldCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[10px] text-amber-800 space-y-1">
            <p>• Batch id <strong>{DEV_TEST_BATCH_ID}</strong> hai, status <strong>test</strong> — batch lists me aam users ko NAHI dikhega. Dev Mode ON par tumhe <strong>active batch ke roop me</strong> dikhega taaki saari flows test ho sakein.</p>
            <p>• Har fake doc par <strong>isTestData</strong> marker hai — Delete sirf wahi udayega, asli data 100% safe.</p>
            <p>• <strong>Handover se pehle:</strong> Delete Test Data → counts 0 → naye aadmi ko bilkul clean system milega. Seed page bhi uske paas dikhega hi nahi (CC + seed-flag ke peeche hai).</p>
          </div>
        </div>

        {/* Progress log */}
        {progress.length > 0 && (
          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
            {progress.map((l, i) => (
              <div key={i} className="px-3 py-1 text-[11px] border-b border-slate-100 font-mono text-slate-700">{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevTestLabSection;
