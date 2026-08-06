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
import { useNavigate } from 'react-router-dom';
import { UserPlus, Shield, Search, Trash2, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

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
}

// Firebase UID 28-char alphanumeric hota hai — purane USR-xxx broken profiles 24+ nahi
const isLoginCapable = (docId: string) => /^[A-Za-z0-9]{20,36}$/.test(docId);

export const UserManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [cmdPassword, setCmdPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCmdPw, setShowCmdPw] = useState(false);

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

  // ── CREATE: REAL login-enabled staff account ──
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (formData.password.length < 6) {
      setMessage('ERROR: Password min 6 characters ka hona chahiye.');
      return;
    }
    if (!cmdPassword) {
      setMessage('ERROR: Neeche apna (CC) password bhi enter karo — naya account bante hi session switch hota hai, wapas login ke liye chahiye.');
      return;
    }
    setCreating(true);
    const ccEmail = user?.email ?? '';
    try {
      // 1) Firebase Auth account (is step ke baad session naye staff pe chala jata hai)
      const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

      // 2) Firestore profile — Document ID = AUTH UID (yehi rule hai, tabhi login chalega)
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        designation: formData.designation,
        role: formData.role,
        isActive: true,
        isDeveloper: false, // dev flag kabhi yahan se nahi
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'System',
      });

      // 3) Wapas CC login (session restore)
      await signInWithEmailAndPassword(auth, ccEmail, cmdPassword);

      setMessage(`SUCCESS: ${formData.email} ka LOGIN account ban gaya ✓ — password staff ko de do.`);
      setFormData({ name: '', email: '', password: '', phone: '', designation: '', role: 'Clerk' });
      setCmdPassword('');
      navigate('/users'); // role-switch ke dauran page se bahar ho gaye to wapas
      fetchUsers();
    } catch (err: any) {
      let msg = `ERROR: ${err.message}`;
      if (err.code === 'auth/email-already-in-use') msg = 'ERROR: Ye email pehle se registered hai.';
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'ERROR: Tumhara (CC) password galat hai.';
      else if (err.code === 'auth/weak-password') msg = 'ERROR: Password kamzor hai (min 6 characters).';
      else if (err.code === 'auth/invalid-email') msg = 'ERROR: Email format galat hai.';
      // Session restore attempt (agar switch ho gaya tha)
      try { await signInWithEmailAndPassword(auth, ccEmail, cmdPassword); } catch { /* ok */ }
      setMessage(msg);
    } finally {
      setCreating(false);
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
      : `${u.name} (${u.email}) ka Firestore profile DELETE karein?\n\n⚠ Dhyan dein: Auth account Firebase Console se alag se delete karna hoga — warna wo email dobara use nahi hoga.`;
    if (!window.confirm(warn)) return;
    try {
      await deleteDoc(doc(db, 'users', u.id));
      setMessage(`Deleted: ${u.email}`);
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
              </select>
              <p className="text-[9px] text-slate-400 mt-1 leading-snug">
                Company Commander accounts yahan nahi bante — wo sirf <strong>App Owner</strong> banata hai (Owner Panel → Customers).
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-2.5">
              <label className="text-[10px] font-black text-amber-800 uppercase block mb-1">🔐 Tumhara (CC) Password *</label>
              <div className="relative">
                <input type={showCmdPw ? 'text' : 'password'} required value={cmdPassword}
                  onChange={e => setCmdPassword(e.target.value)}
                  className={inputClass} />
                <button type="button" onClick={() => setShowCmdPw(!showCmdPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  {showCmdPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <p className="text-[9px] text-amber-700 mt-1 leading-snug">
                Staff ka account bante hi system tumhe wapas CC login karega — naya account banate hi session switch hota hai.
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
                          <button
                            onClick={() => handleDeleteProfile(u)}
                            title="Profile delete karo"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm border border-transparent hover:border-red-200 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
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
    </div>
  );
};
