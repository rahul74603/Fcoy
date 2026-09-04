// ═══════════════════════════════════════════════════════════
// TRAINEE REPORTING PANEL
// ───────────────────────────────────────────────────────────
// Do tarah ki report bhej sakte hain:
//
//  1. TRAINEE REPORT — kisi ek trainee par lagti hai.
//     Sick / Hospital / PT miss / Rest / Leave.
//     Trainee select karna zaroori hai. Approve hone par
//     absent + MI register + company roll sab update hota hai.
//
//  2. GENERAL REPORT — kisi trainee ko select karne ki zaroorat NAHI.
//     Mess, kit, maintenance, complaint, suggestion, urgent help,
//     ya bas clerk ko koi jaankari deni ho.
//     Approve hone par notice board par chala jata hai.
// ═══════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import {
  Loader2, Send, CheckCircle2, Search, User, Users, X, Info, AlertTriangle,
} from 'lucide-react';
import { submitReportForTrainee } from '../api/trainee.api';
import {
  TRAINEE_REPORT_KINDS, GENERAL_REPORT_KINDS, ABSENCE_REPORT_KINDS, STATUS_COLORS,
  type AbsenceReportKind, type TraineeUpdate,
} from '../types/trainee.types';
import type { AvailabilityEntry } from '../../shared/availability';

interface Props {
  myTrainee: Record<string, any> | null;
  /** Poori batch ki trainee list — senior kisi ko bhi select kar sakta hai */
  trainees: Record<string, any>[];
  batchId: string;
  userName: string;
  userUid: string;
  userRole?: string;
  reports: TraineeUpdate[];
  onSubmitted: () => void;
  /**
   * Har trainee ka aaj ka asli duty status (absent + MI register se).
   * Isse picker me pata chalta hai kaun pehle se sick/chutti par hai —
   * warna usi trainee ki dobara report chali jati thi.
   */
  availability?: Record<string, AvailabilityEntry>;
}

type Mode = 'trainee' | 'general';

const todayISO = () => new Date().toISOString().split('T')[0];

export const AbsenceReportPanel: React.FC<Props> = ({
  myTrainee, trainees, batchId, userName, userUid, userRole, reports, onSubmitted,
  availability = {},
}) => {
  const [mode, setMode] = useState<Mode>('trainee');
  const [selected, setSelected] = useState<Record<string, any> | null>(myTrainee);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(!myTrainee);
  const [kind, setKind] = useState<AbsenceReportKind>('sick');
  const [genKind, setGenKind] = useState<AbsenceReportKind>('general_info');
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  const activeKind = mode === 'general' ? genKind : kind;
  const meta = ABSENCE_REPORT_KINDS.find(k => k.value === activeKind) || ABSENCE_REPORT_KINDS[0];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...trainees].sort((a, b) =>
      String(a.chestNo || '').localeCompare(String(b.chestNo || ''), undefined, { numeric: true })
    );
    if (!q) return list;
    return list.filter(t =>
      String(t.chestNo || '').toLowerCase().includes(q) ||
      String(t.name || '').toLowerCase().includes(q) ||
      String(t.regNo || '').toLowerCase().includes(q) ||
      String(t.platoon || '').toLowerCase().includes(q)
    );
  }, [trainees, search]);

  const statusOf = (t: Record<string, any> | null) => (t ? availability[t.id] : undefined);

  /** Is trainee ki koi report abhi clerk ke paas pending to nahi? */
  const pendingFor = (tid?: string) =>
    !!tid && reports.some(r => r.traineeId === tid && r.status === 'pending');

  const selectedStatus = statusOf(selected);
  const selectedPending = pendingFor(selected?.id);

  const resetForm = () => { setTitle(''); setDescription(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'trainee' && !selected) {
      setMessage('Pehle trainee select karo — ya "General report" par switch karo.');
      setOk(false); return;
    }
    if (!title.trim() || !description.trim()) {
      setMessage('Wajah aur detail dono likhna zaroori hai.'); setOk(false); return;
    }
    setSaving(true); setMessage('');
    try {
      const onBehalf = mode === 'trainee' && (!myTrainee || selected?.id !== myTrainee.id);
      await submitReportForTrainee({
        trainee: mode === 'general' ? null : selected,
        batchId,
        reportKind: activeKind,
        fromDate,
        toDate: toDate || fromDate,
        activity: meta.activity,
        title: title.trim(),
        description: description.trim(),
      }, userName, userRole || 'Trainee', userUid, onBehalf);
      resetForm();
      setOk(true);
      setMessage(mode === 'general'
        ? `${meta.label} report clerk ko bhej di gayi. Approve hone par notice board par aa jayegi.`
        : `Report bhej di gayi — Chest ${selected?.chestNo || '—'} ${selected?.name || ''}. ` +
          `Clerk approve karte hi absent list, MI register, company roll aur notice board sab update ho jayega.`);
      onSubmitted();
    } catch (err: any) {
      setOk(false);
      setMessage(err?.message || 'Report save nahi hui. Clerk se permission check karo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ══ MODE SWITCH ══ */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setMode('trainee'); setMessage(''); }}
          className={`rounded-xl border-2 px-4 py-3 text-left transition ${
            mode === 'trainee' ? 'border-green-700 bg-green-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}>
          <p className="text-sm font-black text-slate-800">👤 Kisi trainee ki report</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Bimari · hospital · PT miss · rest · chutti</p>
        </button>
        <button type="button" onClick={() => { setMode('general'); setMessage(''); }}
          className={`rounded-xl border-2 px-4 py-3 text-left transition ${
            mode === 'general' ? 'border-blue-700 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}>
          <p className="text-sm font-black text-slate-800">📢 General report</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Mess · kit · repair · shikayat · sujhav</p>
        </button>
      </div>

      {/* ══ TRAINEE PICKER — sirf trainee mode me ══ */}
      {mode === 'trainee' && (
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <Users size={15} /> Kis trainee ki report hai?
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                List se chuno ya chest number / naam search karo.
              </p>
            </div>
            {myTrainee && (
              <button type="button"
                onClick={() => { setSelected(myTrainee); setPickerOpen(false); }}
                className="text-[10px] font-bold text-green-700 border border-green-300 bg-green-50 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                <User size={11} className="inline mr-1" />Meri report
              </button>
            )}
          </div>

          {selected && !pickerOpen ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-black text-slate-800">
                  Chest {selected.chestNo || '—'} · {selected.name || '—'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {selected.platoon || 'Platoon —'}{selected.regNo ? ` · Reg ${selected.regNo}` : ''}
                  {myTrainee && selected.id === myTrainee.id ? ' · (aap khud)' : ' · doosre trainee ke liye'}
                </p>
                {selectedStatus && !selectedStatus.available && (
                  <p className={`text-[10px] font-black mt-1 ${selectedStatus.meta.color}`}>
                    {selectedStatus.meta.icon} Pehle se {selectedStatus.meta.shortLabel}
                    {selectedStatus.toDate ? ` — ${selectedStatus.toDate} tak` : ''}
                    {selectedStatus.reason ? ` · ${selectedStatus.reason}` : ''}
                  </p>
                )}
                {selectedPending && (
                  <p className="text-[10px] font-black text-amber-700 mt-0.5">
                    ⏳ Iski ek report clerk ke paas pending hai
                  </p>
                )}
              </div>
              <button type="button" onClick={() => { setPickerOpen(true); setSearch(''); }}
                className="text-[10px] font-bold text-green-800 underline whitespace-nowrap">Change</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Chest no / naam / platoon search karo…"
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={14} /></button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y">
                {filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 text-center">Koi trainee nahi mila</p>
                ) : filtered.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelected(t); setPickerOpen(false); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 hover:bg-green-50 flex items-center justify-between ${
                      selected?.id === t.id ? 'bg-green-50' : ''
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 min-w-0 truncate">
                      {t.chestNo || '—'} · {t.name || '—'}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {pendingFor(t.id) && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">⏳ pending</span>
                      )}
                      {(() => {
                        const st = availability[t.id];
                        if (!st || st.available) return null;
                        return (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${st.meta.bgColor} ${st.meta.color}`}>
                            {st.meta.icon} {st.meta.shortLabel}
                          </span>
                        );
                      })()}
                      <span className="text-[10px] text-slate-500">{t.platoon || ''}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                {filtered.length} trainees
                {(() => {
                  const away = filtered.filter(t => availability[t.id] && !availability[t.id].available).length;
                  return away > 0 ? ` · ${away} pehle se away (sick / chutti / hospital)` : '';
                })()}
              </p>
            </>
          )}
        </div>
      )}

      {/* ══ GENERAL MODE NOTE ══ */}
      {mode === 'general' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
          <Info size={15} className="text-blue-700 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-900">
            <b>Trainee select karne ki zaroorat nahi.</b> Ye report poore group / company ke liye hai —
            clerk ke paas seedha pahunch jayegi. Approve hone par notice board par sabko dikh jayegi.
          </p>
        </div>
      )}

      {/* ══ DUPLICATE WARNING — pehle se away ya pending report ══ */}
      {mode === 'trainee' && selected && ((selectedStatus && !selectedStatus.available) || selectedPending) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900">
            <b>Dhyan do —</b>{' '}
            {selectedStatus && !selectedStatus.available && (
              <>
                Chest {selected.chestNo} pehle se <b>{selectedStatus.meta.label}</b> par hai
                {selectedStatus.toDate ? ` (${selectedStatus.toDate} tak)` : ''}
                {selectedStatus.source === 'medical' ? ' — MI room register me darj hai.' : ' — absent register me darj hai.'}{' '}
              </>
            )}
            {selectedPending && <>Iski ek report clerk ke paas <b>abhi pending</b> hai. </>}
            Nayi report tabhi bhejo jab wajah alag ho ya duration badhani ho.
          </div>
        </div>
      )}

      {/* ══ REPORT FORM ══ */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow border border-slate-200 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">
            {mode === 'general' ? 'Kya baat hai?' : 'Kya dikkat hai?'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {mode === 'general'
              ? 'Clerk ke inbox me jayega — approval ke baad notice board par.'
              : 'Clerk ke notice par chest number ke saath jayega — approval ke baad hi record banega.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(mode === 'general' ? GENERAL_REPORT_KINDS : TRAINEE_REPORT_KINDS).map(k => {
            const on = activeKind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => (mode === 'general' ? setGenKind(k.value) : setKind(k.value))}
                className={`text-left rounded-lg border px-3 py-2 ${
                  on
                    ? (mode === 'general' ? 'border-blue-700 bg-blue-50' : 'border-green-700 bg-green-50')
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className="text-sm font-black flex items-center gap-1">
                  {k.icon} {k.label}
                  {k.priority === 'urgent' && (
                    <AlertTriangle size={11} className="text-red-600" />
                  )}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">{k.hint}</p>
              </button>
            );
          })}
        </div>

        {/* Dates sirf absence-type reports me */}
        {meta.needsDates && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From date</label>
              <input type="date" required value={fromDate}
                onChange={e => { setFromDate(e.target.value); if (toDate < e.target.value) setToDate(e.target.value); }}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To date</label>
              <input type="date" required value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            {mode === 'general' ? 'Subject *' : 'Short wajah *'}
          </label>
          <input
            required value={title} onChange={e => setTitle(e.target.value)}
            placeholder={
              mode === 'general'
                ? (genKind === 'mess' ? 'e.g. Raat ke khane me dal kam thi'
                  : genKind === 'maintenance' ? 'e.g. Barrack 3 me paani nahi aa raha'
                  : genKind === 'urgent_help' ? 'e.g. Turant clerk se milna hai'
                  : 'e.g. Kal ke program ki jaankari')
                : (kind === 'pt_miss' ? 'e.g. Pair me dard — PT nahi kar paya' : 'e.g. Bukhar / viral')
            }
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detail *</label>
          <textarea
            required rows={3} value={description} onChange={e => setDescription(e.target.value)}
            placeholder={mode === 'general'
              ? 'Clerk ko poori baat clear likho — kya hua, kahan, kab se.'
              : 'Clerk ko clear likho — kya hua, kab se, hospital gaya ya rest hai, PT/class miss ki wajah.'}
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
          />
        </div>

        {message && (
          <p className={`text-xs font-bold ${ok ? 'text-green-700' : 'text-red-600'}`}>{message}</p>
        )}

        <button type="submit" disabled={saving || (mode === 'trainee' && !selected)}
          className={`w-full sm:w-auto px-5 py-2.5 text-white text-xs font-black rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
            mode === 'general' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-green-800 hover:bg-green-900'
          }`}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Clerk ko bhejo
        </button>
      </form>

      {/* ══ SENT REPORTS ══ */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-sm font-black text-slate-700 mb-3">Meri bheji hui reports</h3>
        {reports.length === 0 ? (
          <p className="text-xs text-slate-400">Abhi koi report nahi.</p>
        ) : reports.map(u => (
          <div key={u.id} className="border-b last:border-0 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>{u.status}</span>
              <span className="text-xs font-bold">
                {u.isGeneral
                  ? `📢 ${u.title}`
                  : `${u.chestNo} ${u.traineeName} — ${u.title}`}
              </span>
              {u.isGeneral && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">general</span>}
              {u.onBehalf && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">on behalf</span>}
            </div>
            <p className="text-[10px] text-slate-500">{u.description}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {!u.isGeneral && u.fromDate ? u.fromDate : ''}
              {!u.isGeneral && u.toDate && u.toDate !== u.fromDate ? ` → ${u.toDate}` : ''}
              {!u.isGeneral && u.activity ? ` · ${u.activity}` : ''}
              {u.status === 'approved' && u.approvedBy ? ` · Clerk: ${u.approvedBy}` : ''}
              {u.status === 'rejected' && u.rejectionReason ? ` · Reject: ${u.rejectionReason}` : ''}
            </p>
            {u.status === 'approved' && (
              <p className="text-[10px] text-green-700 font-bold flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={10} />
                {u.isGeneral
                  ? 'Notice board par publish ho gaya'
                  : `Absent list + ${['S','H','R','M'].includes(u.absentType || '') ? 'MI register' : 'attendance'} + notice board update ho gaya`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
