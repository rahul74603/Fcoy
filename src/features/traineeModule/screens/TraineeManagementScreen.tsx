// ═══════════════════════════════════════════════════════════
// TRAINEE MANAGEMENT SCREEN (for CC/Clerk)
// Create accounts, submit updates, manage notices, approve
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, Loader2, X, Save, Trash2, CheckCircle2,
  AlertTriangle, Bell, UserPlus, ClipboardList, Eye, EyeOff,
  Search, Filter,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
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
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

export const TraineeManagementScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [tab, setTab] = useState<'accounts' | 'updates' | 'notices'>('accounts');
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
      setMessage('✅ Update submitted for approval');
      setShowSubmitUpdate(false);
      setUpdateForm({ traineeId: '', category: 'Medical Issue', title: '', description: '', priority: 'medium' });
      loadData();
    } catch (err: any) { setMessage(`❌ ${err.message}`); }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    const upd = updates.find(u => u.id === id);
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
    try {
      await createNotice({
        batchId: activeBatch.id, title: noticeForm.title, content: noticeForm.content,
        category: noticeForm.category, priority: noticeForm.priority,
        targetPlatoon: noticeForm.targetPlatoon, expiresAt: noticeForm.expiresAt || undefined,
      }, user.name);
      setMessage('✅ Notice published');
      setShowCreateNotice(false);
      setNoticeForm({ title: '', content: '', category: 'General Notice', priority: 'normal', targetPlatoon: 'all', expiresAt: '' });
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
      setMessage();
      setShowRelegationModal(false);
      setRelegationForm({ traineeId: '', toBatchId: '', toPlatoon: 'Platoon 1', reason: 'Medical - Injury', reasonDetail: '', medicalCertificate: false, authorityName: '', authorityRank: '', orderNumber: '', remainingSubjects: '', completedTraining: '' });
      loadData();
    } catch (err: any) { setMessage(); }
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
          <h1 className="text-lg font-black text-white uppercase tracking-wider">🎓 Trainee Management</h1>
          <p className="text-[10px] text-green-200">Accounts · Updates · Notices · Approvals</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSubmitUpdate(true)} className="bg-white text-green-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-50">
            <ClipboardList size={14} /> Submit Update
          </button>
          <button onClick={() => setShowCreateNotice(true)} className="bg-white text-green-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-50">
            <Bell size={14} /> Post Notice
          </button>
          <button onClick={() => setShowCreateAccount(true)} className="bg-white text-green-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-50">
            <UserPlus size={14} /> Create Account
          </button>
          <button onClick={() => setShowRelegationModal(true)} className="bg-white text-red-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-50">
            <AlertTriangle size={14} /> Relegate Trainee
          </button>
        </div>
      </div>

      {message && <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'accounts', label: 'Accounts', icon: <UserPlus size={14} /> },
          { key: 'updates', label: 'Updates', icon: <ClipboardList size={14} />, badge: pendingCount },
          { key: 'notices', label: 'Notices', icon: <Bell size={14} /> },
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

      {/* UPDATES TAB */}
      {tab === 'updates' && (
        <div className="space-y-3">
          {updates.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center"><ClipboardList size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi update nahi</p></div>
          ) : updates.map(u => {
            const cat = UPDATE_CATEGORIES.find(c => c.value === u.category) || { icon: '📝', label: u.category };
            return (
              <div key={u.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${
                u.status === 'pending' ? 'border-yellow-500' : u.status === 'approved' ? 'border-green-500' : 'border-red-500'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{cat.icon}</span>
                      <h4 className="text-sm font-bold">{u.title}</h4>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>{u.status}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[u.priority]}`}>{u.priority}</span>
                    </div>
                    <p className="text-xs text-slate-600">{u.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {u.chestNo} — {u.traineeName} · {u.submittedBy} ({u.submittedByRole}) · {new Date(u.submittedAt).toLocaleDateString('en-IN')}
                    </p>
                    {u.rejectionReason && <p className="text-[10px] text-red-600 mt-1">Rejection: {u.rejectionReason}</p>}
                  </div>
                  {u.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => handleApprove(u.id)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-green-700 flex items-center gap-1">
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
          })}
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
                  <p className="text-[10px] text-slate-400 mt-1">{n.publishedBy} · {new Date(n.publishedAt).toLocaleDateString('en-IN')} · {n.targetPlatoon === 'all' ? 'All Platoons' : `Platoon ${n.targetPlatoon}`}</p>
                </div>
                <button onClick={async () => { if (confirm('Delete notice?')) { await deleteNotice(n.id); loadData(); }}}
                  className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RELEGATION TAB */}
      {tab === 'relegation' && (
        <div className="space-y-3">
          {relegations.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <AlertTriangle size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-400">Koi relegation record nahi</p>
            </div>
          ) : relegations.map(r => (
            <div key={r.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${
              r.status === 'pending' ? 'border-yellow-500' : r.status === 'approved' ? 'border-blue-500' :
              r.status === 'completed' ? 'border-green-500' : 'border-slate-300'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold">{r.chestNo} — {r.traineeName}</h4>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${RELEGATION_STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-700'}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-slate-600">{r.reason} — {r.reasonDetail}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    From: {r.fromBatchName} ({r.fromPlatoon}) → To: {r.toBatchName} ({r.toPlatoon})
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Authority: {r.authorityRank} {r.authorityName} · Order: {r.orderNumber || '—'}
                    {r.medicalCertificate && ' · ✅ MC Attached'}
                  </p>
                  {r.remainingSubjects.length > 0 && (
                    <p className="text-[10px] text-blue-600 mt-1">Remaining: {r.remainingSubjects.join(', ')}</p>
                  )}
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={async () => { await approveRelegation(r.id, user!.name); setMessage('✅ Relegation approved'); loadData(); }}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-green-700">Approve</button>
                    <button onClick={async () => { await cancelRelegation(r.id); setMessage('❌ Relegation cancelled'); loadData(); }}
                      className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-200">Cancel</button>
                  </div>
                )}
                {r.status === 'approved' && (
                  <button onClick={async () => { await completeRelegation(r.id); setMessage('✅ Relegation completed'); loadData(); }}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-700">Mark Completed</button>
                )}
              </div>
            </div>
          ))}
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
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Target Platoon</label>
                <select value={noticeForm.targetPlatoon} onChange={e => setNoticeForm(p => ({ ...p, targetPlatoon: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="all">All Platoons</option>
                  <option value="Platoon 1">Platoon 1</option>
                  <option value="Platoon 2">Platoon 2</option>
                  <option value="Platoon 3">Platoon 3</option>
                  <option value="Platoon 4">Platoon 4</option>
                </select>
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
