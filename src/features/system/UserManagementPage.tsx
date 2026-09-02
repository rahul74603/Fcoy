// src/features/system/UserManagementPage.tsx
// ─────────────────────────────────────────────
// 👥 USER MANAGEMENT (CC Only)
// Unit ke staff (QM / Clerk / Ustad) ke LOGIN accounts yahan bante hain.
//
// ✅ FIX: Pehle ye page sirf Firestore profile banata tha (doc id = USR-xxxx)
//    aur Firebase Auth account NAHI — isliye aise account se login KABHI
//    nahi hota tha. Ab: Auth account + users/<authUid> doc dono bante hain,
//    isliye naye staff ka login turant chalta hai.
//
// ℹ️ CC (Company Commander) accounts yahan NAHI bante — wo App Owner
//    banata hai (Owner Panel → Customers). Ye hierarchy fix hai.
// ─────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Shield, Search, Trash2, AlertTriangle, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { db, firebaseConfig } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';
import { createStaffAccount } from './api/staffProvisioning.client';
import { Layers } from 'lucide-react';

interface UserModel {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  isDeveloper?: boolean;
  assignedBatchIds?: string[];
}

// Firebase UID 28-char alphanumeric hota hai — purane USR-xxx broken profiles 24+ nahi
const isLoginCapable = (docId: string) => /^[A-Za-z0-9]{20,36}$/.test(docId);

// 🔑 Staff auth accounts SECONDARY Firebase app se bante hain —
// Commander ka session kabhi switch nahi hota (koi re-login nahi chahiye).
const provisionAuth = () => {
  const secondary = getApps().find(a => a.name === 'staff-provisioner') || initializeApp(firebaseConfig, 'staff-provisioner');
  return getAuth(secondary);
};

export const UserManagementPage = () => {
  const { user } = useAuth();
  const { allBatches } = useBatch();

  const [users, setUsers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    designation: '',
    role: 'Clerk',
  });
  const [soBatchIds, setSoBatchIds] = useState<string[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [resetting, setResetting] = useState('');
  const [assignFor, setAssignFor] = useState<UserModel | null>(null);
  const [assignDraft, setAssignDraft] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const openAssign = (u: UserModel) => { setAssignFor(u); setAssignDraft(u.assignedBatchIds ?? []); };

  const saveAssignedBatches = async () => {
    if (!assignFor) return;
    setAssigning(true);
    try {
      await updateDoc(doc(db, 'users', assignFor.id), { assignedBatchIds: assignDraft });
      setMessage(`SUCCESS: ${assignFor.name} ko ${assignDraft.length} batch(es) assigned.`);
      setAssignFor(null);
      fetchUsers();
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const userList: UserModel[] = [];
      snap.forEach(docSnap => userList.push({ id: docSnap.id, ...docSnap.data() } as UserModel));
      // Newest first
      userList.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
      setUsers(userList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      [u.name, u.email, u.phone, u.designation, u.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  // ── CREATE: staff account via SERVER-SIDE callable (Admin SDK, CC-only) ──
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (formData.password.length < 6) {
      setMessage('ERROR: Password min 6 characters ka hona chahiye.');
      return;
    }
    setCreating(true);
    const email = formData.email.trim().toLowerCase();
    try {
      // Auth account + Firestore profile dono Cloud Function (Admin SDK) se
      // bante hain. Server CC hi hone ka check karta hai aur
      // isDeveloper/customerId ko client se trust nahi karta.
      await createStaffAccount({
        name: formData.name,
        email,
        password: formData.password,
        phone: formData.phone,
        designation: formData.designation,
        role: formData.role,
        assignedBatchIds: formData.role === 'Senior Officer / Inspector' ? soBatchIds : [],
      });

      setMessage(`SUCCESS: ${email} ka LOGIN account ban gaya ✓ — password staff ko de do.`);
      setFormData({ name: '', email: '', password: '', phone: '', designation: '', role: 'Clerk' });
      setSoBatchIds([]);
      fetchUsers();
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // ── PASSWORD RESET: staff ko reset email bhejo ──
  const handleResetPassword = async (u: UserModel) => {
    if (!window.confirm(`${u.email} pe password-reset email bheje? (Link wali mail jayegi)`)) return;
    setResetting(u.id);
    try {
      const staffAuth = provisionAuth();
      await sendPasswordResetEmail(staffAuth, u.email);
      setMessage(`Reset email bhijwaya: ${u.email} ✓ (inbox/spam check karne bolo)`);
    } catch (err: any) {
      setMessage(err.code === 'auth/user-not-found'
        ? `ERROR: ${u.email} ka Auth account nahi mila — naya account banao (ye purani/broken profile ho sakti hai).`
        : `ERROR: ${err.message}`);
    } finally {
      setResetting('');
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', id), { isActive: !currentStatus });
      fetchUsers();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleDeleteProfile = async (u: UserModel) => {
    const broken = !isLoginCapable(u.id);
    const warn = broken
      ? `${u.name} (${u.email}) — ye BROKEN profile hai (Auth account kabhi bana hi nahi tha, isse login possible nahi). DELETE karein?`
      : `${u.name} (${u.email}) ka Firestore profile DELETE karein?\n\n` +
        '⚠ Sirf Firestore profile delete hota hai.\n' +
        '• Firebase AUTHENTICATION account DELETE NAHI hota — wo Admin SDK / backend / Firebase Console se alag se delete karna hota hai.\n' +
        '• Recommendation: pehle "Active" ko Disabled karo (Deactivate) — turant access band. Delete sirf broken/duplicate profile ke liye.\n\n' +
        'Profile ko pehle Deactivate bhi kar diya jayega taaki koi access na rahe. DELETE karein?';
    if (!window.confirm(warn)) return;
    try {
      // Safety: deactivate FIRST so the account can never authenticate with
      // a stale session even before the profile doc is removed.
      if (!broken) {
        try { await updateDoc(doc(db, 'users', u.id), { isActive: false }); } catch { /* best effort */ }
      }
      await deleteDoc(doc(db, 'users', u.id));
      setMessage(
        `Deleted Firestore profile: ${u.email}. ` +
        (broken
          ? ''
          : 'NOTE: Firebase Authentication account abhi bhi maujood hai — use Firebase Console / Admin SDK se alag delete karna zaroori hai.'),
      );
      fetchUsers();
    } catch (error) {
      alert('Delete failed');
    }
  };

  if (user?.role !== 'Company Commander') {
    return <div className="p-4 text-red-600 font-bold uppercase">Restricted Area: Commander Clearance Required</div>;
  }

  const inputClass = 'w-full border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-military-700 bg-white';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider">User Management</h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">Command Control: Staff Login Accounts & Roles</p>
        </div>
        <div className="flex space-x-2">
          <span className="bg-military-800 text-white px-3 py-1 text-[10px] font-bold uppercase rounded-sm flex items-center">
            <Shield size={14} className="mr-1" /> Commander Clearance
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD USER FORM */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreateUser} className="bg-white border-t-4 border-t-military-800 border border-slate-300 shadow-flat p-4 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-military-900 flex items-center border-b border-slate-200 pb-2">
              <UserPlus size={16} className="mr-2" /> Register New Staff (Login Ready)
            </h2>

            {message && (
              <div className={`p-2 text-[10px] font-bold ${message.startsWith('ERROR') ? 'bg-red-50 text-red-700 border border-red-200' : message.startsWith('Deleted') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {message}
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Email (Login ID)</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Staff Password (Login ke liye) *</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required minLength={6} value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className={inputClass} placeholder="Min 6 characters" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Designation</label>
                <input type="text" placeholder="e.g. Sub Inspector" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">System Role</label>
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className={inputClass}>
                <option value="Quarter Master">Quarter Master</option>
                <option value="Clerk">Clerk</option>
                <option value="Ustad">Ustad</option>
                <option value="Senior Officer / Inspector">Senior Officer / Inspector</option>
                <option value="Trainee">🎓 Trainee</option>
              </select>
              <p className="text-[9px] text-slate-400 mt-1 leading-snug">
                Company Commander accounts yahan nahi bante — wo sirf <strong>App Owner</strong> banata hai (Owner Panel → Customers).
              </p>
            </div>

            {/* Assigned batches — only for Senior Officer / Inspector */}
            {formData.role === 'Senior Officer / Inspector' && (
              <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                <label className="text-[10px] font-bold text-indigo-900 uppercase flex items-center gap-1">
                  <Layers size={12} /> Assigned Batches (inspection scope)
                </label>
                <p className="text-[9px] text-indigo-700 mt-0.5">
                  SO sirf inhi batches ka inspection/finding likh sakta hai. Blank = koi access nahi.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {allBatches.map(b => (
                    <label key={b.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={soBatchIds.includes(b.id)}
                        onChange={e => setSoBatchIds(prev =>
                          e.target.checked ? [...prev, b.id] : prev.filter(id => id !== b.id))}
                      />
                      {b.batchNumber}
                    </label>
                  ))}
                  {allBatches.length === 0 && <span className="text-[10px] text-slate-400">No batches found.</span>}
                </div>
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded p-2.5">
              <p className="text-[10px] font-bold text-green-800 leading-snug">
                🔑 Account <strong>secondary session</strong> se banta hai — tumhara CC login hilta nahi, koi re-login nahi chahiye.
              </p>
            </div>

            <button type="submit" disabled={creating} className="w-full bg-military-800 text-white font-bold uppercase text-xs py-2 hover:bg-military-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {creating ? <><Loader2 size={13} className="animate-spin" /> Creating Login...</> : 'Create Staff Login Account'}
            </button>
          </form>
        </div>

        {/* USER LIST */}
        <div className="lg:col-span-2 bg-white border border-slate-300 shadow-flat self-start">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase text-military-900">
              System Personnel ({filteredUsers.length}{search ? ` / ${users.length}` : ''})
            </span>
            {/* 🔍 SEARCH BAR */}
            <div className="relative w-64 max-w-full">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name / email / role..."
                className="w-full border border-slate-300 bg-white pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-military-700"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Name & Desig</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Contact</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Role</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Status</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-4 text-xs font-bold">Loading Personnel Data...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-xs font-bold text-slate-400">
                    {search ? `"${search}" se koi match nahi mila` : 'Abhi koi staff profile nahi'}
                  </td></tr>
                ) : (
                  filteredUsers.map(u => {
                    const broken = !isLoginCapable(u.id);
                    return (
                      <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 ${broken ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-2">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            {u.name}
                            {u.isDeveloper && (
                              <span className="text-[8px] font-black bg-orange-600 text-white px-1.5 py-0.5 rounded-full">👑 OWNER</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase">{u.designation}</div>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">
                          <div className="text-slate-800">{u.email}</div>
                          <div className="text-slate-500">{u.phone}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="bg-military-100 text-military-800 border border-military-200 px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm">
                            {u.role}
                          </span>
                          {u.role === 'Senior Officer / Inspector' && (
                            <div className="mt-1 text-[9px] font-bold text-indigo-700 flex items-center gap-1">
                              <Layers size={9} /> {u.assignedBatchIds?.length ? `${u.assignedBatchIds.length} batch(es) assigned` : 'NO BATCH ASSIGNED'}
                            </div>
                          )}
                          {broken && (
                            <div className="mt-1 flex items-center gap-1 text-[9px] font-black text-red-600" title="Firestore doc ID Auth UID se match nahi karta — is profile se login possible nahi. Delete karke naya account banao.">
                              <AlertTriangle size={10} /> NO LOGIN (broken)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => toggleUserStatus(u.id, u.isActive)}
                            className={`text-[10px] font-bold uppercase px-3 py-1 rounded-sm border ${u.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                          >
                            {u.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                          {u.role === 'Senior Officer / Inspector' && (
                            <button
                              onClick={() => openAssign(u)}
                              title="Assigned batches set karo"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-sm border border-transparent hover:border-indigo-200 transition-colors"
                            >
                              <Layers size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleResetPassword(u)}
                            disabled={resetting === u.id}
                            title="Password reset email bhejo"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-sm border border-transparent hover:border-amber-200 transition-colors disabled:opacity-40"
                          >
                            {resetting === u.id ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(u)}
                            title="Profile delete karo"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm border border-transparent hover:border-red-200 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assign batches modal (Senior Officer / Inspector) */}
      {assignFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers size={16} className="text-indigo-700" /> Assigned Batches — {assignFor.name}
            </h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Senior Officer / Inspector sirf selected batches ki inspections aur findings likh/verify kar sakta hai.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 max-h-64 overflow-auto">
              {allBatches.map(b => (
                <label key={b.id} className="flex items-center gap-2 text-sm text-slate-700 border border-slate-200 rounded p-2">
                  <input
                    type="checkbox"
                    checked={assignDraft.includes(b.id)}
                    onChange={e => setAssignDraft(prev =>
                      e.target.checked ? [...prev, b.id] : prev.filter(id => id !== b.id))}
                  />
                  <span>
                    <b>{b.batchNumber}</b>
                    <span className="block text-[10px] text-slate-400">{b.batchName}</span>
                  </span>
                </label>
              ))}
              {allBatches.length === 0 && <p className="text-xs text-slate-400 col-span-2">No batches.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAssignFor(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={saveAssignedBatches} disabled={assigning}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50 flex items-center gap-2">
                {assigning && <Loader2 size={14} className="animate-spin" />} Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
