// ═══════════════════════════════════════════════════════════
// TRAINEE MANAGEMENT SCREEN (for CC/Clerk)
// Create accounts, submit updates, manage notices, approve
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, Loader2, X, Save, Trash2, CheckCircle2,
  AlertTriangle, Bell, UserPlus, ClipboardList, Eye, EyeOff,
  Search, Filter, FileText,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import { displayActor } from '../../../utils/actorName';
import {
  createTraineeAccount, getAllTraineeAccounts, deleteTraineeAccount,
  submitTraineeUpdate, getAllUpdatesForBatch,
  approveTraineeUpdate, rejectTraineeUpdate, approveAbsenceReport,
  createNotice, getNotices, deleteNotice,
  createRelegation, getRelegations, approveRelegation, completeRelegation, cancelRelegation,
} from '../api/trainee.api';
import type {
  TraineeAccount, TraineeUpdate, TraineeNotice, RelegationRecord,
  TraineeUpdateCategory, NoticeCategory, RelegationReason,
} from '../types/trainee.types';
import { UPDATE_CATEGORIES, NOTICE_CATEGORIES, RELEGATION_REASONS, RELEGATION_STATUS_COLORS, PRIORITY_COLORS, STATUS_COLORS } from '../types/trainee.types';
import { FilesPanel } from '../components/FilesPanel';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

/**
 * Subjects field do alag screens se aata hai:
 *   • RelegationRegisterScreen → comma-separated STRING
 *   • purana trainee-module    → ARRAY
 * Dono (aur undefined) ko safely list bana do.
 */
const asList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String).map(x => x.trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(x => x.trim()).filter(Boolean);
  return [];
};

export const TraineeManagementScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [tab, setTab] = useState<'accounts' | 'updates' | 'notices' | 'files' | 'relegation'>('accounts');
  const [trainees, setTrainees] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<TraineeAccount[]>([]);
  const [updates, setUpdates] = useState<TraineeUpdate[]>([]);
  const [notices, setNotices] = useState<TraineeNotice[]>([]);
  const [relegations, setRelegations] = useState<RelegationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Create account modal
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccTraineeId, setNewAccTraineeId] = useState('');
  const [newAccPassword, setNewAccPassword] = useState('');
  const [newAccUsername, setNewAccUsername] = useState('');

  // Submit update modal
  const [showSubmitUpdate, setShowSubmitUpdate] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    traineeId: '', category: 'Medical Issue' as TraineeUpdateCategory,
    title: '', description: '', priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  // Create notice modal
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [showRelegationModal, setShowRelegationModal] = useState(false);
  const [relegationForm, setRelegationForm] = useState({
    traineeId: '', toBatchId: '', toPlatoon: 'Platoon 1',
    reason: 'Medical - Injury' as RelegationReason, reasonDetail: '',
    medicalCertificate: false, authorityName: '', authorityRank: '',
    orderNumber: '', remainingSubjects: '', completedTraining: '',
  });
  const [allBatches, setAllBatches] = useState<any[]>([]);

  const [noticeForm, setNoticeForm] = useState({
    title: '', content: '', category: 'General Notice' as NoticeCategory,
    priority: 'normal' as 'normal' | 'important' | 'urgent',
    targetPlatoon: 'all', expiresAt: '',
  });
  // Notice kis-kis ko jaye: 'group' = platoon/all, 'picked' = chune hue trainees
  const [noticeAudience, setNoticeAudience] = useState<'group' | 'picked'>('group');
  const [noticeTraineeIds, setNoticeTraineeIds] = useState<string[]>([]);
  const [noticeSearch, setNoticeSearch] = useState('');

  // Updates inbox filter
  const [updFilter, setUpdFilter] = useState<'pending' | 'urgent' | 'general' | 'staff' | 'approved' | 'rejected' | 'all'>('pending');
  const [updSearch, setUpdSearch] = useState('');

  // Reject modal
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!activeBatch) return;
    loadData();
  }, [activeBatch]);

  const loadData = async () => {
    if (!activeBatch) return;
    setLoading(true);
    try {
      // Load trainees
      const snap = await getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id)));
      const tList: any[] = [];
      snap.forEach(d => tList.push({ id: d.id, ...d.data() }));
      tList.sort((a, b) => (a.chestNo || '').localeCompare(b.chestNo || ''));
      setTrainees(tList);

      // Load accounts
      const acc = await getAllTraineeAccounts();
      setAccounts(acc);

      // Load updates
      const upd = await getAllUpdatesForBatch(activeBatch.id);
      setUpdates(upd);

      // Load notices
      const ntc = await getNotices(activeBatch.id);
      setNotices(ntc);

      // Load relegations
      const rel = await getRelegations(activeBatch.id);
      setRelegations(rel);

      // Load all batches for relegation dropdown
      const batchSnap = await getDocs(collection(db, 'batches'));
      const bList: any[] = [];
      batchSnap.forEach(d => bList.push({ id: d.id, ...d.data() }));
      setAllBatches(bList);
    } catch {}
    setLoading(false);
  };

  const handleCreateAccount = async () => {
    if (!newAccTraineeId || !newAccPassword || !newAccUsername || !user) return;
    const t = trainees.find(t => t.id === newAccTraineeId);
    if (!t) return;
    try {
      await createTraineeAccount(newAccTraineeId, newAccUsername, newAccPassword, user.name);
      setMessage(`✅ Account created for ${t.chestNo} — ${t.name}`);
      setShowCreateAccount(false);
      setNewAccTraineeId(''); setNewAccPassword(''); setNewAccUsername('');
      loadData();
    } catch (err: any) { setMessage(`❌ ${err.message}`); }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSubmitUpdate = async () => {
    if (!updateForm.traineeId || !updateForm.title || !updateForm.description || !activeBatch || !user) return;
    const t = trainees.find(t => t.id === updateForm.traineeId);
    if (!t) return;
    try {
      await submitTraineeUpdate({
        traineeId: updateForm.traineeId, traineeName: t.name, chestNo: t.chestNo,
        batchId: activeBatch.id, platoon: t.platoon,
        category: updateForm.category, title: updateForm.title,
        description: updateForm.description, priority: updateForm.priority,
      }, user.name, user.role);
      setMessage('✅ Record save ho gaya (clerk entry — approval ki zaroorat nahi)');
      setShowSubmitUpdate(false);
      setUpdateForm({ traineeId: '', category: 'Medical Issue', title: '', description: '', priority: 'medium' });
      loadData();
    } catch (err: any) { setMessage(`❌ ${err.message}`); }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    const upd = updates.find(u => u.id === id);
    // Apni hi bheji hui report approve karna = self-approval. Allowed nahi.
    if (upd && upd.submittedByUid && upd.submittedByUid === user.uid) {
      setMessage('❌ Apni hi bheji hui report khud approve nahi kar sakte');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      if (upd) await approveAbsenceReport(upd, user.name);
      else await approveTraineeUpdate(id, user.name);
      setMessage('Approved — attendance / absent / MI register update ho gaya');
    } catch (err: any) {
      setMessage(err?.message || 'Approve fail');
    }
    loadData();
    setTimeout(() => setMessage(''), 3000);
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason || !user) return;
    await rejectTraineeUpdate(rejectId, user.name, rejectReason);
    setMessage('❌ Update rejected');
    setRejectId(null); setRejectReason('');
    loadData();
    setTimeout(() => setMessage(''), 3000);
  };

  const handleCreateNotice = async () => {
    if (!noticeForm.title || !noticeForm.content || !activeBatch || !user) return;
    const picked = noticeAudience === 'picked' ? noticeTraineeIds : [];
    if (noticeAudience === 'picked' && picked.length === 0) {
      setMessage('❌ Kam se kam ek trainee chuno, ya "Poore group ko" select karo');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    const label = picked
      .map(id => { const t = trainees.find(x => x.id === id); return t ? `${t.chestNo} ${t.name}` : ''; })
      .filter(Boolean).join(', ');
    try {
      await createNotice({
        batchId: activeBatch.id, title: noticeForm.title, content: noticeForm.content,
        category: noticeForm.category, priority: noticeForm.priority,
        targetPlatoon: noticeAudience === 'picked' ? 'all' : noticeForm.targetPlatoon,
        expiresAt: noticeForm.expiresAt || undefined,
        targetTraineeIds: picked,
        targetTraineeLabel: label,
      }, user.name);
      setMessage(picked.length
        ? `✅ Notice ${picked.length} trainee ko bheja gaya`
        : '✅ Notice published');
      setShowCreateNotice(false);
      setNoticeForm({ title: '', content: '', category: 'General Notice', priority: 'normal', targetPlatoon: 'all', expiresAt: '' });
      setNoticeAudience('group'); setNoticeTraineeIds([]); setNoticeSearch('');
      loadData();
    } catch (err: any) { setMessage(`❌ ${err.message}`); }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRelegate = async () => {
    if (!relegationForm.traineeId || !relegationForm.toBatchId || !relegationForm.reasonDetail || !user) return;
    const t = trainees.find(t => t.id === relegationForm.traineeId);
    const toBatch = allBatches.find(b => b.id === relegationForm.toBatchId);
    if (!t || !toBatch) return;
    try {
      await createRelegation({
        traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, regNo: t.regNo || '',
        fromBatchId: activeBatch!.id, fromBatchName: activeBatch!.batchNumber || '', fromPlatoon: t.platoon || '',
        toBatchId: relegationForm.toBatchId, toBatchName: toBatch.batchNumber || '', toPlatoon: relegationForm.toPlatoon,
        reason: relegationForm.reason, reasonDetail: relegationForm.reasonDetail,
        medicalCertificate: relegationForm.medicalCertificate,
        authorityName: relegationForm.authorityName, authorityRank: relegationForm.authorityRank,
        orderNumber: relegationForm.orderNumber,
        remainingSubjects: relegationForm.remainingSubjects.split(',').map(s => s.trim()).filter(Boolean),
        completedTraining: relegationForm.completedTraining.split(',').map(s => s.trim()).filter(Boolean),
      }, user.name);
      setMessage('');
      setShowRelegationModal(false);
      setRelegationForm({ traineeId: '', toBatchId: '', toPlatoon: 'Platoon 1', reason: 'Medical - Injury', reasonDetail: '', medicalCertificate: false, authorityName: '', authorityRank: '', orderNumber: '', remainingSubjects: '', completedTraining: '' });
      loadData();
    } catch (err: any) { setMessage(''); }
    setTimeout(() => setMessage(''), 3000);
  };

  if (!activeBatch) {
    return <div className="p-8 text-center"><Shield size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>;
  }

  const pendingCount = updates.filter(u => u.status === 'pending').length;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900 to-green-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">🎓 Trainee Reports & Accounts</h1>
          <p className="text-[10px] text-green-200">
            Trainees ki bheji hui reports approve karo · login accounts · notice board
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSubmitUpdate(true)} className="bg-white text-green-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-50">
            <ClipboardList size={14} /> Add Record
          </button>
          <button onClick={() => setShowCreateNotice(true)} className="bg-white text-green-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-50">
            <Bell size={14} /> Post Notice
          </button>
          <button onClick={() => setShowCreateAccount(true)} className="bg-white text-green-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-50">
            <UserPlus size={14} /> Create Account
          </button>
          <a href="/relegation" className="bg-white text-red-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-50">
            <AlertTriangle size={14} /> Relegate Trainee
          </a>
        </div>
      </div>

      {message && <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'accounts', label: 'Accounts', icon: <UserPlus size={14} /> },
          { key: 'updates', label: 'Updates', icon: <ClipboardList size={14} />, badge: pendingCount },
          { key: 'notices', label: 'Notices', icon: <Bell size={14} /> },
          { key: 'files', label: 'Files', icon: <FileText size={14} /> },
          { key: 'relegation', label: 'Relegation', icon: <AlertTriangle size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold ${
              tab === t.key ? 'bg-green-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {t.icon} {t.label}
            {t.badge ? <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ACCOUNTS TAB */}
      {tab === 'accounts' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50"><tr>
              <th className="px-3 py-2 text-left font-bold text-slate-500">Chest No</th>
              <th className="px-3 py-2 text-left font-bold text-slate-500">Username</th>
              <th className="px-3 py-2 text-left font-bold text-slate-500">Name</th>
              <th className="px-3 py-2 text-left font-bold text-slate-500">Platoon</th>
              <th className="px-3 py-2 text-left font-bold text-slate-500">Status</th>
              <th className="px-3 py-2 text-right font-bold text-slate-500">Action</th>
            </tr></thead>
            <tbody>
              {trainees.map(t => {
                const acc = accounts.find(a => a.traineeId === t.id);
                return (
                  <tr key={t.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold">{t.chestNo}</td>
                    <td className="px-3 py-2">{acc ? acc.username : '—'}</td>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2">{t.platoon}</td>
                    <td className="px-3 py-2">
                      {acc ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[9px] font-bold">Active</span>
                        : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[9px] font-bold">No Account</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {acc ? (
                        <button onClick={async () => { if (confirm('Delete account?')) { await deleteTraineeAccount(acc.id); loadData(); }}}
                          className="text-red-500 hover:text-red-700"><Trash2 size={12} /></button>
                      ) : (
                        <button onClick={() => { setNewAccTraineeId(t.id); setShowCreateAccount(true); }}
                          className="text-green-600 hover:text-green-800 text-[10px] font-bold">+ Create</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* UPDATES TAB — CLERK INBOX */}
      {tab === 'updates' && (
        <div className="space-y-3">
          {/* Inbox toolbar */}
          <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-2">
            {([
              { k: 'pending', label: 'Pending', n: updates.filter(u => u.status === 'pending').length },
              { k: 'staff', label: '🖊 Clerk entries', n: updates.filter(u => u.staffEntry).length },
              { k: 'urgent', label: '🚨 Urgent', n: updates.filter(u => u.priority === 'urgent' && u.status === 'pending').length },
              { k: 'general', label: '📢 General', n: updates.filter(u => u.isGeneral).length },
              { k: 'approved', label: 'Approved', n: updates.filter(u => u.status === 'approved').length },
              { k: 'rejected', label: 'Rejected', n: updates.filter(u => u.status === 'rejected').length },
              { k: 'all', label: 'All', n: updates.length },
            ] as const).map(f => (
              <button key={f.k} onClick={() => setUpdFilter(f.k)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                  updFilter === f.k ? 'bg-green-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {f.label} ({f.n})
              </button>
            ))}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={updSearch} onChange={e => setUpdSearch(e.target.value)}
                placeholder="Chest no / naam se dhundo…"
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
            </div>
          </div>

          {(() => {
            const q = updSearch.trim().toLowerCase();
            const visible = updates
              .filter(u => {
                if (updFilter === 'all') return true;
                if (updFilter === 'urgent') return u.priority === 'urgent' && u.status === 'pending';
                if (updFilter === 'general') return !!u.isGeneral;
                if (updFilter === 'staff') return !!u.staffEntry;
                return u.status === updFilter;
              })
              .filter(u => !q
                || String(u.chestNo || '').toLowerCase().includes(q)
                || String(u.traineeName || '').toLowerCase().includes(q)
                || String(u.title || '').toLowerCase().includes(q)
                || String(u.category || '').toLowerCase().includes(q)
                || String(u.submittedBy || '').toLowerCase().includes(q));
            if (visible.length === 0) {
              return (
                <div className="bg-white rounded-xl p-8 text-center">
                  <ClipboardList size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-400">
                    {updFilter === 'pending' ? 'Koi pending report nahi — sab clear' : 'Koi update nahi'}
                  </p>
                </div>
              );
            }
            return visible.map(u => {
            const cat = UPDATE_CATEGORIES.find(c => c.value === u.category) || { icon: '📝', label: u.category };
            return (
              <div key={u.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${
                u.status === 'pending' && u.priority === 'urgent' ? 'border-red-600 ring-2 ring-red-200'
                  : u.status === 'pending' ? 'border-yellow-500'
                  : u.status === 'approved' ? 'border-green-500' : 'border-red-500'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{cat.icon}</span>
                      <h4 className="text-sm font-bold">{u.title}</h4>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>{u.status}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[u.priority]}`}>{u.priority}</span>
                      {u.staffEntry && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          clerk entry
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{u.description}</p>
                    {u.isGeneral ? (
                      <p className="text-[11px] font-bold text-blue-700 mt-1">
                        📢 General report — poore group ke liye (kisi ek trainee par nahi)
                      </p>
                    ) : (
                      <p className="text-[11px] font-bold text-slate-700 mt-1">
                        Chest {u.chestNo} — {u.traineeName}{u.platoon ? ` · ${u.platoon}` : ''}
                      </p>
                    )}
                    {!u.isGeneral && (u.fromDate || u.activity) && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {u.fromDate || ''}{u.toDate && u.toDate !== u.fromDate ? ` → ${u.toDate}` : ''}
                        {u.activity ? ` · ${u.activity}` : ''}
                        {u.absentType ? ` · Type ${u.absentType}` : ''}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Bheja: {displayActor(u.submittedBy)} ({u.submittedByRole}) · {new Date(u.submittedAt).toLocaleDateString('en-IN')}
                      {u.onBehalf ? ' · on behalf' : ''}
                    </p>
                    {u.status === 'approved' && (
                      <p className="text-[10px] text-green-700 font-bold mt-1">
                        {u.isGeneral
                          ? '✅ Notice board par publish ho gaya'
                          : `✅ Absent list + ${['S','H','R','M'].includes(u.absentType || '') ? 'MI register' : 'attendance'} + company roll + notice board — sab update ho gaya`}
                      </p>
                    )}
                    {u.rejectionReason && <p className="text-[10px] text-red-600 mt-1">Rejection: {u.rejectionReason}</p>}
                  </div>
                  {u.status === 'pending' && !u.staffEntry && u.submittedByUid !== user?.uid && (
                    <div className="flex flex-col gap-2 ml-4">
                      <button onClick={() => handleApprove(u.id)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-green-700 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button onClick={() => setRejectId(u.id)} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-200">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
            });
          })()}
        </div>
      )}

      {/* NOTICES TAB */}
      {tab === 'notices' && (
        <div className="space-y-3">
          {notices.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center"><Bell size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi notice nahi</p></div>
          ) : notices.map(n => (
            <div key={n.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${
              n.priority === 'urgent' ? 'border-red-500' : n.priority === 'important' ? 'border-orange-500' : 'border-green-500'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold">{n.title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{n.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {displayActor(n.publishedBy)} · {new Date(n.publishedAt).toLocaleDateString('en-IN')} ·{' '}
                    {(n.targetTraineeIds && n.targetTraineeIds.length > 0)
                      ? `🎯 ${n.targetTraineeIds.length} trainee${n.targetTraineeLabel ? ` — ${n.targetTraineeLabel}` : ''}`
                      : (n.targetPlatoon === 'all' ? 'All Platoons' : n.targetPlatoon)}
                  </p>
                </div>
                <button onClick={async () => { if (confirm('Delete notice?')) { await deleteNotice(n.id); loadData(); }}}
                  className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILES TAB — clerk uploads, trainees ko turant dikhta hai */}
      {tab === 'files' && activeBatch && (
        <FilesPanel
          batchId={activeBatch.id}
          canUpload
          userName={user?.name || 'Clerk'}
          trainees={trainees}
        />
      )}

      {/* RELEGATION TAB — read-only view. Asli lifecycle RelID register me. */}
      {tab === 'relegation' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-amber-900">Relegation yahan se manage nahi hoti</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                RelID banana, destination batch, rejoin — sab kuch <b>Relegation / RelID</b> register me hota hai.
                Yahan sirf is batch ka status dikh raha hai.
              </p>
            </div>
            <a href="/relegation"
              className="whitespace-nowrap rounded-lg bg-amber-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-amber-700">
              RelID Register kholo →
            </a>
          </div>

          {relegations.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <AlertTriangle size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-400">Is batch me koi relegation record nahi</p>
            </div>
          ) : relegations.map(r => {
            const st = String(r.status || '');
            const stLabel = st === 'awaiting_rejoin' ? 'Awaiting rejoin'
              : st === 'rejoined' ? 'Rejoined'
              : st === 'cancelled' ? 'Cancelled'
              : st || 'unknown';
            const stColor = st === 'awaiting_rejoin' ? 'bg-amber-100 text-amber-800'
              : st === 'rejoined' ? 'bg-green-100 text-green-700'
              : st === 'cancelled' ? 'bg-slate-100 text-slate-600'
              : 'bg-slate-100 text-slate-700';
            const border = st === 'awaiting_rejoin' ? 'border-amber-500'
              : st === 'rejoined' ? 'border-green-500' : 'border-slate-300';
            const relId = (r as any).relegateId || (r as any).relId || '';
            const chest = r.chestNo || (r as any).fromChestNo || '—';
            const detail = r.reasonDetail || (r as any).details || '';
            const authority = [r.authorityRank, r.authorityName].filter(Boolean).join(' ')
              || (r as any).authority || '';
            const orderNo = r.orderNumber || (r as any).orderNo || '';
            const remaining = asList(r.remainingSubjects);

            return (
              <div key={r.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${border}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {relId && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-black text-amber-800">
                      {relId}
                    </span>
                  )}
                  <h4 className="text-sm font-bold">{chest} — {r.traineeName || '—'}</h4>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${stColor}`}>{stLabel}</span>
                </div>
                <p className="text-xs text-slate-600">{r.reason}{detail ? ` — ${detail}` : ''}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  From: {r.fromBatchName || (r as any).fromBatchNumber || '—'}
                  {r.fromPlatoon ? ` (${r.fromPlatoon})` : ''}
                  {' → '}To: {r.toBatchName || (r as any).toBatchNumber || 'not yet known'}
                </p>
                {(authority || orderNo) && (
                  <p className="text-[10px] text-slate-400">
                    {authority ? `Authority: ${authority}` : ''}
                    {authority && orderNo ? ' · ' : ''}
                    {orderNo ? `Order: ${orderNo}` : ''}
                  </p>
                )}
                {remaining.length > 0 && (
                  <p className="text-[10px] text-blue-600 mt-1">Remaining: {remaining.join(', ')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE ACCOUNT MODAL */}
      {showCreateAccount && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="bg-green-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">🎓 Create Trainee Account</h3>
              <button onClick={() => setShowCreateAccount(false)} className="text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Trainee *</label>
                <select value={newAccTraineeId} onChange={e => setNewAccTraineeId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- Select Trainee --</option>
                  {trainees.filter(t => !accounts.find(a => a.traineeId === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.chestNo} — {t.name} ({t.platoon})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Username *</label>
                <input type="text" value={newAccUsername} onChange={e => setNewAccUsername(e.target.value)}
                  placeholder="Login username (e.g. trainee01)" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Password *</label>
                <input type="text" value={newAccPassword} onChange={e => setNewAccPassword(e.target.value)}
                  placeholder="Set password" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowCreateAccount(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleCreateAccount} className="px-6 py-2 bg-green-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-green-800">
                  <Save size={14} /> Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT UPDATE MODAL */}
      {showSubmitUpdate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="bg-green-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">📋 Submit Trainee Update</h3>
              <button onClick={() => setShowSubmitUpdate(false)} className="text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Trainee *</label>
                <select value={updateForm.traineeId} onChange={e => setUpdateForm(p => ({ ...p, traineeId: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- Select Trainee --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.chestNo} — {t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Category *</label>
                  <select value={updateForm.category} onChange={e => setUpdateForm(p => ({ ...p, category: e.target.value as any }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {UPDATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Priority *</label>
                  <select value={updateForm.priority} onChange={e => setUpdateForm(p => ({ ...p, priority: e.target.value as any }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Title *</label>
                <input type="text" value={updateForm.title} onChange={e => setUpdateForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Short title" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Description *</label>
                <textarea value={updateForm.description} onChange={e => setUpdateForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Detail me likho..." className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowSubmitUpdate(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleSubmitUpdate} className="px-6 py-2 bg-green-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-green-800">
                  <Save size={14} /> Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NOTICE MODAL */}
      {showCreateNotice && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="bg-green-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">🔔 Post Notice</h3>
              <button onClick={() => setShowCreateNotice(false)} className="text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Category *</label>
                  <select value={noticeForm.category} onChange={e => setNoticeForm(p => ({ ...p, category: e.target.value as any }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {NOTICE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Priority *</label>
                  <select value={noticeForm.priority} onChange={e => setNoticeForm(p => ({ ...p, priority: e.target.value as any }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              {/* ── Kisko bhejna hai ── */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Notice kisko jayega? *</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button type="button" onClick={() => setNoticeAudience('group')}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      noticeAudience === 'group' ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-slate-50'
                    }`}>
                    <p className="text-xs font-black">👥 Poore group ko</p>
                    <p className="text-[9px] text-slate-500">All / ek platoon</p>
                  </button>
                  <button type="button" onClick={() => setNoticeAudience('picked')}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      noticeAudience === 'picked' ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-slate-50'
                    }`}>
                    <p className="text-xs font-black">🎯 Chune hue trainee</p>
                    <p className="text-[9px] text-slate-500">
                      {noticeTraineeIds.length ? `${noticeTraineeIds.length} selected` : 'Search karke chuno'}
                    </p>
                  </button>
                </div>

                {noticeAudience === 'group' ? (
                  <select value={noticeForm.targetPlatoon} onChange={e => setNoticeForm(p => ({ ...p, targetPlatoon: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="all">All Platoons</option>
                    <option value="Platoon 1">Platoon 1</option>
                    <option value="Platoon 2">Platoon 2</option>
                    <option value="Platoon 3">Platoon 3</option>
                    <option value="Platoon 4">Platoon 4</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={noticeSearch} onChange={e => setNoticeSearch(e.target.value)}
                        placeholder="Chest no / naam se dhundo…"
                        className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm" />
                    </div>
                    {noticeTraineeIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {noticeTraineeIds.map(id => {
                          const t = trainees.find(x => x.id === id);
                          if (!t) return null;
                          return (
                            <span key={id} className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                              {t.chestNo} {t.name}
                              <button type="button" onClick={() => setNoticeTraineeIds(v => v.filter(x => x !== id))}>
                                <X size={10} />
                              </button>
                            </span>
                          );
                        })}
                        <button type="button" onClick={() => setNoticeTraineeIds([])}
                          className="text-[10px] font-bold text-red-600 underline">clear all</button>
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y">
                      {trainees
                        .filter(t => {
                          const q = noticeSearch.trim().toLowerCase();
                          if (!q) return true;
                          return String(t.chestNo || '').toLowerCase().includes(q)
                            || String(t.name || '').toLowerCase().includes(q)
                            || String(t.platoon || '').toLowerCase().includes(q);
                        })
                        .slice(0, 100)
                        .map(t => {
                          const on = noticeTraineeIds.includes(t.id);
                          return (
                            <button key={t.id} type="button"
                              onClick={() => setNoticeTraineeIds(v => on ? v.filter(x => x !== t.id) : [...v, t.id])}
                              className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-green-50 ${on ? 'bg-green-50' : ''}`}>
                              <span className="text-xs font-bold text-slate-800">{t.chestNo} · {t.name}</span>
                              <span className="text-[10px] text-slate-500">
                                {on ? '✓ selected' : t.platoon || ''}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Title *</label>
                <input type="text" value={noticeForm.title} onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Notice title" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Content *</label>
                <textarea value={noticeForm.content} onChange={e => setNoticeForm(p => ({ ...p, content: e.target.value }))}
                  rows={3} placeholder="Notice content..." className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Expires At (optional)</label>
                <input type="date" value={noticeForm.expiresAt} onChange={e => setNoticeForm(p => ({ ...p, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowCreateNotice(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleCreateNotice} className="px-6 py-2 bg-green-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-green-800">
                  <Save size={14} /> Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-4">
            <h3 className="text-sm font-black mb-3">❌ Reject Update</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="Rejection reason..." className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
              <button onClick={handleReject} className="px-6 py-2 bg-red-600 text-white text-xs font-black rounded-lg">Reject</button>
            </div>
          </div>
        </div>
      )}
    
      {/* RELEGATE MODAL */}
      {showRelegationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-red-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">⚠️ Relegate Trainee</h3>
              <button onClick={() => setShowRelegationModal(false)} className="text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[10px] text-amber-800">
                ⚠️ Relegation = trainee ko serious injury/illness/other reason se next batch mein bhejna.
                Baaki training wo naye batch mein complete karega.
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Trainee *</label>
                <select value={relegationForm.traineeId} onChange={e => setRelegationForm(p => ({ ...p, traineeId: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">-- Select Trainee --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.chestNo} — {t.name} ({t.platoon})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">To Batch *</label>
                  <select value={relegationForm.toBatchId} onChange={e => setRelegationForm(p => ({ ...p, toBatchId: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">-- Select Batch --</option>
                    {allBatches.filter(b => b.id !== activeBatch?.id).map(b => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">To Platoon</label>
                  <select value={relegationForm.toPlatoon} onChange={e => setRelegationForm(p => ({ ...p, toPlatoon: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {['Platoon 1', 'Platoon 2', 'Platoon 3', 'Platoon 4'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Reason *</label>
                <select value={relegationForm.reason} onChange={e => setRelegationForm(p => ({ ...p, reason: e.target.value as any }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {RELEGATION_REASONS.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Reason Detail *</label>
                <textarea value={relegationForm.reasonDetail} onChange={e => setRelegationForm(p => ({ ...p, reasonDetail: e.target.value }))}
                  rows={2} placeholder="Detail me likho kya hua..." className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Authority Name *</label>
                  <input type="text" value={relegationForm.authorityName} onChange={e => setRelegationForm(p => ({ ...p, authorityName: e.target.value }))}
                    placeholder="Officer name" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Authority Rank</label>
                  <input type="text" value={relegationForm.authorityRank} onChange={e => setRelegationForm(p => ({ ...p, authorityRank: e.target.value }))}
                    placeholder="e.g. DC, AC" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Order Number</label>
                  <input type="text" value={relegationForm.orderNumber} onChange={e => setRelegationForm(p => ({ ...p, orderNumber: e.target.value }))}
                    placeholder="Order/Letter ref" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" checked={relegationForm.medicalCertificate} onChange={e => setRelegationForm(p => ({ ...p, medicalCertificate: e.target.checked }))} />
                  <label className="text-xs font-bold text-slate-600">Medical Certificate Attached</label>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Completed Training (comma separated)</label>
                <input type="text" value={relegationForm.completedTraining} onChange={e => setRelegationForm(p => ({ ...p, completedTraining: e.target.value }))}
                  placeholder="e.g. PT, Drill, Law" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Remaining Subjects (comma separated)</label>
                <input type="text" value={relegationForm.remainingSubjects} onChange={e => setRelegationForm(p => ({ ...p, remainingSubjects: e.target.value }))}
                  placeholder="e.g. Firing, Tactics, FPT" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowRelegationModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleRelegate} className="px-6 py-2 bg-red-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-red-800">
                  <Save size={14} /> Relegate Trainee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
