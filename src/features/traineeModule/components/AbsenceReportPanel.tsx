import React, { useState, useMemo } from 'react';
import { Loader2, Send, CheckCircle2, Search, User, Users, X } from 'lucide-react';
import { submitReportForTrainee } from '../api/trainee.api';
import {
  ABSENCE_REPORT_KINDS, STATUS_COLORS,
  type AbsenceReportKind, type TraineeUpdate,
} from '../types/trainee.types';

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
}

const todayISO = () => new Date().toISOString().split('T')[0];

export const AbsenceReportPanel: React.FC<Props> = ({
  myTrainee, trainees, batchId, userName, userUid, userRole, reports, onSubmitted,
}) => {
  const [selected, setSelected] = useState<Record<string, any> | null>(myTrainee);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(!myTrainee);
  const [kind, setKind] = useState<AbsenceReportKind>('sick');
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  const meta = ABSENCE_REPORT_KINDS.find(k => k.value === kind) || ABSENCE_REPORT_KINDS[0];

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setMessage('Pehle trainee select karo.'); setOk(false); return; }
    if (!title.trim() || !description.trim()) {
      setMessage('Wajah aur detail dono likhna zaroori hai.'); setOk(false); return;
    }
    setSaving(true); setMessage('');
    try {
      const onBehalf = !myTrainee || selected.id !== myTrainee.id;
      await submitReportForTrainee({
        trainee: selected,
        batchId,
        reportKind: kind,
        fromDate,
        toDate: toDate || fromDate,
        activity: meta.activity,
        title: title.trim(),
        description: description.trim(),
      }, userName, userRole || 'Trainee', userUid, onBehalf);
      setTitle(''); setDescription('');
      setOk(true);
      setMessage(
        `Report bhej di gayi — Chest ${selected.chestNo || '—'} ${selected.name || ''}. ` +
        `Clerk approve karte hi absent list, MI register, company nominal roll aur notice board — sab update ho jayega.`
      );
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
      {/* ── Trainee selector ── */}
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
            </div>
            <button type="button" onClick={() => { setPickerOpen(true); setSearch(''); }}
              className="text-[10px] font-bold text-green-800 underline whitespace-nowrap">Change</button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
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
                  <span className="text-xs font-bold text-slate-800">
                    {t.chestNo || '—'} · {t.name || '—'}
                  </span>
                  <span className="text-[10px] text-slate-500">{t.platoon || ''}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">{filtered.length} trainees</p>
          </>
        )}
      </div>

      {/* ── Report form ── */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow border border-slate-200 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">Kya dikkat hai?</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Clerk ke notice par chest number ke saath jayega — approval ke baad hi record banega.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ABSENCE_REPORT_KINDS.map(k => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`text-left rounded-lg border px-3 py-2 ${
                kind === k.value ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <p className="text-sm font-black">{k.icon} {k.label}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{k.hint}</p>
            </button>
          ))}
        </div>

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

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Short wajah *</label>
          <input
            required value={title} onChange={e => setTitle(e.target.value)}
            placeholder={kind === 'pt_miss' ? 'e.g. Pair me dard — PT nahi kar paya' : 'e.g. Bukhar / viral'}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detail *</label>
          <textarea
            required rows={3} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Clerk ko clear likho — kya hua, kab se, hospital gaya ya rest hai, PT/class miss ki wajah."
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
          />
        </div>

        {message && (
          <p className={`text-xs font-bold ${ok ? 'text-green-700' : 'text-red-600'}`}>{message}</p>
        )}

        <button type="submit" disabled={saving || !selected}
          className="w-full sm:w-auto px-5 py-2.5 bg-green-800 text-white text-xs font-black rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Clerk ko bhejo
        </button>
      </form>

      {/* ── Sent reports ── */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-sm font-black text-slate-700 mb-3">Meri bheji hui reports</h3>
        {reports.length === 0 ? (
          <p className="text-xs text-slate-400">Abhi koi report nahi.</p>
        ) : reports.map(u => (
          <div key={u.id} className="border-b last:border-0 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>{u.status}</span>
              <span className="text-xs font-bold">{u.chestNo} {u.traineeName} — {u.title}</span>
              {u.onBehalf && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">on behalf</span>}
            </div>
            <p className="text-[10px] text-slate-500">{u.description}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {u.fromDate || ''}{u.toDate && u.toDate !== u.fromDate ? ` → ${u.toDate}` : ''}
              {u.activity ? ` · ${u.activity}` : ''}
              {u.status === 'approved' && u.approvedBy ? ` · Clerk: ${u.approvedBy}` : ''}
              {u.status === 'rejected' && u.rejectionReason ? ` · Reject: ${u.rejectionReason}` : ''}
            </p>
            {u.status === 'approved' && (
              <p className="text-[10px] text-green-700 font-bold flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={10} /> Absent list + {['S','H','R','M'].includes(u.absentType || '') ? 'MI register' : 'attendance'} + notice board update ho gaya
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
