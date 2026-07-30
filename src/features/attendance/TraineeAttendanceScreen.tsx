// ═══════════════════════════════════════════════════════════
// TRAINEE DAILY ATTENDANCE REGISTER (Parade / PT / Roll Call)
// ───────────────────────────────────────────────────────────
// Audit Module 10 ka core missing piece tha — pehle sirf
// `trainee.attn` (current status) + period-based absentRecords
// the, DAILY hazri register nahi thi.
//
// Design (additive, kuch break nahi hota):
//   • Ek doc per (batch + date + session) → `trainee_attendance`
//   • Status codes WHI hain jo attn field use karta hai (P/A/L/S/H/R/M)
//   • AAJ ki date pe save karne se trainee.attn bhi sync hota hai
//     (purani date pe sirf register likhta hai, attn nahi chhedta)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList, Calendar, Loader2, Save, CheckCircle2,
  AlertTriangle, Users, UserCheck, UserX, RefreshCw,
  Shield, Layers, Clock,
} from 'lucide-react';
import {
  collection, doc, getDoc, getDocs, query, setDoc,
  where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';

// ─── Types ───
type AttnCode = 'P' | 'A' | 'L' | 'S' | 'H' | 'R' | 'M';

const STATUS_OPTIONS: { code: AttnCode; label: string; color: string; activeColor: string }[] = [
  { code: 'P', label: 'Present',   color: 'bg-white text-slate-500 border-slate-300',      activeColor: 'bg-green-600 text-white border-green-600' },
  { code: 'A', label: 'Absent',    color: 'bg-white text-slate-500 border-slate-300',      activeColor: 'bg-red-600 text-white border-red-600' },
  { code: 'L', label: 'Leave',     color: 'bg-white text-slate-500 border-slate-300',      activeColor: 'bg-amber-500 text-white border-amber-500' },
  { code: 'S', label: 'Sick/MI',   color: 'bg-white text-slate-500 border-slate-300',      activeColor: 'bg-orange-500 text-white border-orange-500' },
  { code: 'H', label: 'Hospital',  color: 'bg-white text-slate-500 border-slate-300',      activeColor: 'bg-red-800 text-white border-red-800' },
  { code: 'R', label: 'Rest/BC',   color: 'bg-white text-slate-500 border-slate-300',      activeColor: 'bg-blue-500 text-white border-blue-500' },
  { code: 'M', label: 'Med Appt',  color: 'bg-white text-slate-500 border-slate-300',      activeColor: 'bg-purple-500 text-white border-purple-500' },
];

const SESSIONS = [
  { key: 'PT',      label: 'Morning PT',        emoji: '🏃' },
  { key: 'PARADE',  label: 'Parade / Fall-in',  emoji: '🫡' },
  { key: 'EVENING', label: 'Evening Roll Call', emoji: '🌆' },
];

interface TraineeRow {
  id: string;
  name: string;
  chestNo: string;
  platoon: string;
  attn?: string;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const TraineeAttendanceScreen = () => {
  const { user } = useAuth();
  const { activeBatch, loading: batchLoading } = useBatch();

  const [date, setDate] = useState(todayISO());
  const [session, setSession] = useState('PARADE');
  const [trainees, setTrainees] = useState<TraineeRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttnCode>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [markedBy, setMarkedBy] = useState('');

  const docId = activeBatch
    ? `${activeBatch.id}_${date}_${session}`
    : '';

  // ── Load trainees + existing register ──
  const loadData = useCallback(async () => {
    if (!activeBatch) return;
    setLoading(true);
    setMessage('');
    try {
      // 1) Active batch trainees
      const tq = query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id));
      const tSnap = await getDocs(tq);
      const list: TraineeRow[] = tSnap.docs
        .map(d => {
          const x = d.data() as any;
          return {
            id: d.id,
            name: x.name ?? '(Naam nahi)',
            chestNo: x.chestNo ?? '',
            platoon: x.platoon ?? '',
            attn: x.attn ?? 'P',
          };
        })
        .sort((a, b) =>
          (parseInt(a.chestNo) || 9999) - (parseInt(b.chestNo) || 9999) ||
          a.name.localeCompare(b.name)
        );
      setTrainees(list);

      // 2) Existing register for this date+session?
      const existingSnap = await getDoc(doc(db, 'trainee_attendance', docId));
      if (existingSnap.exists()) {
        const reg = existingSnap.data() as any;
        const sm: Record<string, AttnCode> = {};
        const rm: Record<string, string> = {};
        (reg.records ?? []).forEach((r: any) => {
          if (r.traineeId) {
            sm[r.traineeId] = (r.status ?? 'P') as AttnCode;
            if (r.remarks) rm[r.traineeId] = r.remarks;
          }
        });
        // Naye trainees (register ke baad add hue) ko default 'P' do
        list.forEach(t => { if (!sm[t.id]) sm[t.id] = 'P'; });
        setStatusMap(sm);
        setRemarksMap(rm);
        setAlreadyMarked(true);
        setMarkedBy(reg.markedBy ?? '');
      } else {
        // Fresh register — sab default Present
        const sm: Record<string, AttnCode> = {};
        list.forEach(t => { sm[t.id] = 'P'; });
        setStatusMap(sm);
        setRemarksMap({});
        setAlreadyMarked(false);
        setMarkedBy('');
      }
    } catch (err: any) {
      setMessage(`ERROR: Data load nahi hua. ${err.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, [activeBatch, docId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Counts ──
  const counts = useMemo(() => {
    const c: Record<string, number> = { P: 0, A: 0, L: 0, S: 0, H: 0, R: 0, M: 0 };
    trainees.forEach(t => { c[statusMap[t.id] ?? 'P'] += 1; });
    return c;
  }, [trainees, statusMap]);

  const markAll = (code: AttnCode) => {
    const sm: Record<string, AttnCode> = {};
    trainees.forEach(t => { sm[t.id] = code; });
    setStatusMap(sm);
  };

  // ── Save Register ──
  const handleSave = async () => {
    if (!activeBatch || trainees.length === 0) return;
    setSaving(true);
    setMessage('');
    try {
      const records = trainees.map(t => ({
        traineeId: t.id,
        name: t.name,
        chestNo: t.chestNo,
        platoon: t.platoon,
        status: statusMap[t.id] ?? 'P',
        remarks: (remarksMap[t.id] ?? '').trim(),
      }));

      await setDoc(doc(db, 'trainee_attendance', docId), {
        batchId: activeBatch.id,
        batchNumber: activeBatch.batchNumber,
        date,
        session,
        sessionLabel: SESSIONS.find(s => s.key === session)?.label ?? session,
        records,
        totalTrainees: records.length,
        presentCount: counts.P,
        absentCount: counts.A,
        leaveCount: counts.L,
        sickCount: counts.S + counts.H + counts.M,
        restCount: counts.R,
        markedBy: user?.name ?? user?.email ?? 'Unknown',
        markedByRole: user?.role ?? '',
        markedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // ★ AAJ ki hazri hai to trainee.attn bhi sync karo
      // (purane date pe sirf register likhta hai, current status nahi chhedta)
      if (date === todayISO()) {
        const batch = writeBatch(db);
        records.forEach(r => {
          batch.update(doc(db, 'trainees', r.traineeId), { attn: r.status });
        });
        await batch.commit();
      }

      setMessage(
        `✓ ${SESSIONS.find(s => s.key === session)?.label} hazri save ho gayi — ` +
        `${counts.P}/${records.length} present (${date}${date === todayISO() ? ', attn sync done' : ' — past date, attn unchanged'})`
      );
      setMessageType('success');
      setAlreadyMarked(true);
      setMarkedBy(user?.name ?? user?.email ?? '');
    } catch (err: any) {
      setMessage(`ERROR: Save fail. ${err.message}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  // ── No active batch ──
  if (batchLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-xs font-bold uppercase">Batch loading...</span>
      </div>
    );
  }
  if (!activeBatch) {
    return (
      <div className="max-w-3xl mx-auto mt-10 bg-amber-50 border-2 border-amber-400 rounded-lg p-6 text-center">
        <AlertTriangle size={28} className="text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-black text-amber-800 uppercase">Koi Active Batch Nahi</p>
        <p className="text-xs text-amber-700 font-bold mt-1">
          Hazri mark karne ke liye pehle Batch Management se batch activate karo.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-military-900 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList size={22} /> Trainee Daily Hazri
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-2">
            <Layers size={11} /> {activeBatch.batchNumber} — {activeBatch.batchName}
            <span className="text-slate-300">|</span>
            <Shield size={11} /> {user?.role}
          </p>
        </div>
        <button
          onClick={loadData} disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* DATE + SESSION PICKER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-300 rounded p-3">
          <label className="text-[10px] font-black text-slate-500 uppercase block mb-1 flex items-center gap-1">
            <Calendar size={10} /> Date
          </label>
          <input
            type="date" value={date} max={todayISO()}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-slate-300 px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-military-700 rounded"
          />
          {date !== todayISO() && (
            <p className="text-[9px] text-amber-600 font-bold mt-1">⚠ Past date — attn (current status) change nahi hoga</p>
          )}
        </div>
        <div className="bg-white border border-slate-300 rounded p-3 md:col-span-2">
          <label className="text-[10px] font-black text-slate-500 uppercase block mb-1 flex items-center gap-1">
            <Clock size={10} /> Session
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SESSIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSession(s.key)}
                className={`px-2 py-1.5 text-[11px] font-black uppercase rounded border-2 transition-colors ${
                  session === s.key
                    ? 'border-military-700 bg-military-50 text-military-900'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY CHIPS + BULK ACTIONS */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white border border-slate-300 rounded px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
            <Users size={11} /> {trainees.length}:
          </span>
          {STATUS_OPTIONS.map(o => counts[o.code] > 0 && (
            <span key={o.code} className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${o.activeColor}`}>
              {o.code}: {counts[o.code]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => markAll('P')}
            className="text-[10px] font-black uppercase bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center gap-1"
          >
            <UserCheck size={11} /> Sab Present
          </button>
          {alreadyMarked && (
            <span className="text-[9px] font-bold text-slate-400">
              ✓ Marked{markedBy ? ` by ${markedBy}` : ''} — edit karke dobara save kar sakte ho
            </span>
          )}
        </div>
      </div>

      {/* MESSAGE */}
      {message && (
        <div className={`border px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2 ${
          messageType === 'success'
            ? 'bg-green-50 border-green-300 text-green-800'
            : 'bg-red-50 border-red-300 text-red-700'
        }`}>
          {messageType === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {message}
          <button onClick={() => setMessage('')} className="ml-auto text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* REGISTER GRID */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 size={26} className="animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold uppercase">Trainees loading...</p>
        </div>
      ) : trainees.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded text-slate-400">
          <UserX size={26} className="mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-bold uppercase">Is batch mein koi trainee nahi</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-300 rounded overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-military-900 text-white text-[9px] font-black uppercase">
            <div className="col-span-1 text-center">Chest</div>
            <div className="col-span-3">Name</div>
            <div className="col-span-1">Plt</div>
            <div className="col-span-4 text-center">Status</div>
            <div className="col-span-3">Remarks</div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[55vh] overflow-y-auto custom-scrollbar">
            {trainees.map(t => {
              const st = statusMap[t.id] ?? 'P';
              return (
                <div key={t.id} className={`grid grid-cols-12 gap-1 px-3 py-1.5 items-center ${st !== 'P' ? 'bg-red-50/40' : ''}`}>
                  <div className="col-span-1 text-center">
                    <span className="text-[11px] font-mono font-black text-amber-700">{t.chestNo || '—'}</span>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-[11px] font-black text-military-900 truncate">{t.name}</p>
                  </div>
                  <div className="col-span-1">
                    <span className="text-[9px] font-bold text-slate-500 truncate block">{t.platoon || '—'}</span>
                  </div>
                  <div className="col-span-4">
                    <div className="flex gap-1 flex-wrap justify-center">
                      {STATUS_OPTIONS.map(o => (
                        <button
                          key={o.code}
                          onClick={() => setStatusMap(prev => ({ ...prev, [t.id]: o.code }))}
                          className={`px-1.5 py-1 text-[9px] font-black rounded border transition-colors ${
                            st === o.code ? o.activeColor : o.color
                          }`}
                          title={o.label}
                        >
                          {o.code}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-3">
                    {st !== 'P' ? (
                      <input
                        type="text"
                        value={remarksMap[t.id] ?? ''}
                        onChange={e => setRemarksMap(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Reason (optional)..."
                        className="w-full border border-slate-200 px-2 py-1 text-[10px] focus:outline-none focus:border-military-600 rounded"
                      />
                    ) : (
                      <span className="text-[9px] text-slate-300 font-bold pl-1">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SAVE BAR */}
      {trainees.length > 0 && (
        <div className="sticky bottom-3 bg-white border-2 border-military-800 rounded-lg shadow-lg px-4 py-3 flex items-center justify-between">
          <div className="text-[11px] font-black text-slate-600">
            <span className="text-green-700">{counts.P} present</span>
            {counts.A > 0 && <span className="text-red-600 ml-2">{counts.A} absent</span>}
            {counts.L + counts.S + counts.H + counts.R + counts.M > 0 && (
              <span className="text-slate-500 ml-2">
                {counts.L + counts.S + counts.H + counts.R + counts.M} others
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-military-800 text-white px-6 py-2.5 text-xs font-black uppercase rounded flex items-center gap-2 hover:bg-military-900 disabled:opacity-60"
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
              : <><Save size={13} /> Save Hazri ({SESSIONS.find(s => s.key === session)?.label})</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default TraineeAttendanceScreen;
