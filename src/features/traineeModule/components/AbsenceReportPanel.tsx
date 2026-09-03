import React, { useState } from 'react';
import { Loader2, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { submitAbsenceReport } from '../api/trainee.api';
import {
  ABSENCE_REPORT_KINDS, STATUS_COLORS,
  type AbsenceReportKind, type TraineeUpdate,
} from '../types/trainee.types';

interface Props {
  myTrainee: Record<string, any> | null;
  batchId: string;
  userName: string;
  userUid: string;
  reports: TraineeUpdate[];
  onSubmitted: () => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];

export const AbsenceReportPanel: React.FC<Props> = ({
  myTrainee, batchId, userName, userUid, reports, onSubmitted,
}) => {
  const [kind, setKind] = useState<AbsenceReportKind>('sick');
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const meta = ABSENCE_REPORT_KINDS.find(k => k.value === kind) || ABSENCE_REPORT_KINDS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTrainee) return;
    if (!title.trim() || !description.trim()) {
      setMessage('Wajah aur detail dono likhna zaroori hai.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await submitAbsenceReport({
        traineeId: myTrainee.id,
        traineeName: myTrainee.name || userName,
        chestNo: myTrainee.chestNo || '',
        regNo: myTrainee.regNo || '',
        batchId,
        platoon: myTrainee.platoon || '',
        reportKind: kind,
        fromDate,
        toDate: toDate || fromDate,
        activity: meta.activity,
        title: title.trim(),
        description: description.trim(),
      }, userName, 'Trainee', userUid);
      setTitle('');
      setDescription('');
      setMessage('Report clerk ke paas chali gayi. Approval ke baad attendance / MI / absent har jagah update hoga.');
      onSubmitted();
    } catch (err: any) {
      setMessage(err?.message || 'Report save nahi hui. Clerk se permission check karo.');
    } finally {
      setSaving(false);
    }
  };

  if (!myTrainee) {
    return (
      <div className="bg-white rounded-xl border border-amber-200 p-6 text-center">
        <AlertTriangle size={32} className="mx-auto text-amber-500 mb-2" />
        <p className="text-sm font-black text-slate-800">Trainee profile nahi mila</p>
        <p className="text-xs text-slate-500 mt-2">
          Login naam trainee register ke naam se match hona chahiye. Clerk se kaho profile naam theek kare.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow border border-slate-200 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">Bimari / PT miss report</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Chest {myTrainee.chestNo || '—'} · {myTrainee.name} · Clerk check karke approve karega
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
            <input type="date" required value={fromDate} onChange={e => setFromDate(e.target.value)}
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
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={kind === 'pt_miss' ? 'e.g. Pair me dard — PT nahi kar paya' : 'e.g. Bukhar / viral'}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detail *</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Clerk ko clear likho — kya hua, kab se, PT/class miss ki wajah."
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
          />
        </div>

        {message && (
          <p className={`text-xs font-bold ${message.includes('nahi') || message.includes('zaroori') ? 'text-red-600' : 'text-green-700'}`}>
            {message}
          </p>
        )}

        <button type="submit" disabled={saving}
          className="w-full sm:w-auto px-5 py-2.5 bg-green-800 text-white text-xs font-black rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Clerk ko bhejo
        </button>
      </form>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-sm font-black text-slate-700 mb-3">MerI reports</h3>
        {reports.length === 0 ? (
          <p className="text-xs text-slate-400">Abhi koi report nahi.</p>
        ) : reports.map(u => (
          <div key={u.id} className="border-b last:border-0 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>{u.status}</span>
              <span className="text-xs font-bold">{u.title}</span>
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
                <CheckCircle2 size={10} /> Absent + {['S','H','R','M'].includes(u.absentType || '') ? 'MI register' : 'attendance'} update ho gaya
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
