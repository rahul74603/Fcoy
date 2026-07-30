import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Search, Pencil, X, KeyRound, Activity, AlertTriangle } from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createStaffAuthUser, requestPasswordReset } from './authSecurity';

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
}

// ★ Login history audit record
interface LoginEvent {
  id: string;
  email: string;
  status: 'SUCCESS' | 'FAILED';
  role: string;
  reason: string;
  userAgent: string;
  timestamp: Date | null;
}

const ROLE_OPTIONS = ['Company Commander', 'Quarter Master', 'Clerk', 'Ustad'];

const emptyForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  designation: '',
  role: 'Clerk',
};

export const UserManagementPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // ★ Search & Filters
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Disabled'>('All');

  // ★ Edit modal
  const [editUser, setEditUser] = useState<UserModel | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', designation: '', role: 'Clerk' });
  const [editMessage, setEditMessage] = useState('');

  // ★ Login history viewer
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formData, setFormData] = useState(emptyForm);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const userList: UserModel[] = [];
      snap.forEach(docSnap => userList.push({ id: docSnap.id, ...docSnap.data() } as UserModel));
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

  // ★ LOGIN HISTORY — last 50 events (CC audit visibility)
  const fetchLoginHistory = async () => {
    setHistoryLoading(true);
    try {
      const q = query(collection(db, 'login_history'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      const list: LoginEvent[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email ?? '',
          status: data.status ?? 'FAILED',
          role: data.role ?? '',
          reason: data.reason ?? '',
          userAgent: data.userAgent ?? '',
          timestamp: data.timestamp?.toDate?.() ?? null,
        };
      });
      setLoginEvents(list);
    } catch (error) {
      console.error('Login history fetch error:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ★★ FIXED USER CREATION
  // Pehle sirf Firestore profile banta tha (USR-[timestamp] doc id) —
  // password use hi nahi hota tha aur Auth account kabhi banta hi
  // nahi tha, isliye naya staff LOGIN KAR HI NAHI SAKTA THA.
  // Ab: secondary Firebase app se real Auth user banta hai (CC ka
  // session disturb nahi hota) + profile doc Auth UID se save hota hai.
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (formData.password.trim().length < 6) {
      setMessage('ERROR: Password kam se kam 6 characters ka hona chahiye.');
      return;
    }

    try {
      // 1. Real Firebase Auth account (session-safe secondary app)
      const authUid = await createStaffAuthUser(formData.email.trim(), formData.password);

      // 2. Firestore profile — doc id MUST be Auth UID (AuthContext lookup)
      await setDoc(doc(db, 'users', authUid), {
        name: formData.name,
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone,
        designation: formData.designation,
        role: formData.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'System'
      });

      setMessage(`SUCCESS: ${formData.role} account ready — ${formData.email} ab login kar sakta hai. Password staff ko verbally dein.`);
      setFormData(emptyForm);
      fetchUsers();
    } catch (error: any) {
      setMessage(`ERROR: ${error.message || 'Failed to create user.'}`);
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    // ★ Guard: CC khud ko disable na kar le (lockout risk)
    if (id === user?.uid) {
      alert('Aap apna khud ka account disable nahi kar sakte.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', id), {
        isActive: !currentStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'System',
      });
      fetchUsers();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  // ★ USER EDIT — name / phone / designation / role update
  const openEdit = (u: UserModel) => {
    setEditUser(u);
    setEditForm({ name: u.name, phone: u.phone, designation: u.designation, role: u.role });
    setEditMessage('');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditMessage('');

    // ★ Guard: khud ka role change karke access kho na dein
    if (editUser.id === user?.uid && editForm.role !== editUser.role) {
      setEditMessage('ERROR: Apna khud ka role change nahi kar sakte.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', editUser.id), {
        name: editForm.name,
        phone: editForm.phone,
        designation: editForm.designation,
        role: editForm.role,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'System',
      });
      setEditMessage('SUCCESS: Profile updated.');
      fetchUsers();
      setTimeout(() => setEditUser(null), 800);
    } catch (error) {
      setEditMessage('ERROR: Update failed.');
    }
  };

  // ★ PASSWORD RESET — staff ke email par reset link
  const handleSendReset = async (u: UserModel) => {
    try {
      await requestPasswordReset(u.email);
      alert(`Password reset link ${u.email} par bhej diya gaya.`);
    } catch (error: any) {
      alert(`Reset email error: ${error.message}`);
    }
  };

  if (user?.role !== 'Company Commander') {
    return <div className="p-4 text-red-600 font-bold uppercase">Restricted Area: Commander Clearance Required</div>;
  }

  // ★ FILTERED LIST
  const filteredUsers = users.filter(u => {
    if (filterRole !== 'All' && u.role !== filterRole) return false;
    if (filterStatus === 'Active' && !u.isActive) return false;
    if (filterStatus === 'Disabled' && u.isActive) return false;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const hay = `${u.name} ${u.email} ${u.designation} ${u.phone}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // ★ Legacy profiles (USR-* doc ids) — Auth account hi nahi bana tha
  const isLegacyProfile = (u: UserModel) => u.id.startsWith('USR-');

  const inputClass = 'w-full border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-military-700 bg-white';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider">User Management</h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">Command Control: Staff Access & Roles</p>
        </div>
        <div className="flex space-x-2">
          {/* ★ LOGIN HISTORY TOGGLE */}
          <button
            onClick={() => {
              const next = !showLoginHistory;
              setShowLoginHistory(next);
              if (next) fetchLoginHistory();
            }}
            className={`border px-3 py-1 text-[10px] font-bold uppercase rounded-sm flex items-center ${showLoginHistory ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}
          >
            <Activity size={14} className="mr-1" /> Login History
          </button>
          <span className="bg-military-800 text-white px-3 py-1 text-[10px] font-bold uppercase rounded-sm flex items-center">
            <Shield size={14} className="mr-1" /> Commander Clearance
          </span>
        </div>
      </div>

      {/* ★ QUICK STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Total Users', value: users.length, bg: 'bg-slate-50', color: 'text-slate-800' },
          { label: 'Active', value: users.filter(u => u.isActive).length, bg: 'bg-green-50', color: 'text-green-700' },
          { label: 'Disabled', value: users.filter(u => !u.isActive).length, bg: 'bg-red-50', color: 'text-red-700' },
          { label: 'Unique Roles', value: new Set(users.map(u => u.role)).size, bg: 'bg-purple-50', color: 'text-purple-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-slate-200 rounded p-2.5 text-center`}>
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ★ LOGIN HISTORY PANEL (AUDIT) */}
      {showLoginHistory && (
        <div className="bg-white border border-purple-300 shadow-flat">
          <div className="bg-purple-50 border-b border-purple-200 px-4 py-2 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-purple-900 flex items-center">
              <Activity size={14} className="mr-1" /> Recent Login Activity (Last 50)
            </span>
            <button onClick={fetchLoginHistory} className="text-[10px] font-bold uppercase text-purple-700 hover:text-purple-900">
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Time</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Email</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Role</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Status</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Reason</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={5} className="text-center py-4 text-xs font-bold">Loading login history...</td></tr>
                ) : loginEvents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-xs font-bold text-slate-400">Abhi tak koi login event record nahi hua. Naye logins se yahan dikhega.</td></tr>
                ) : (
                  loginEvents.map(ev => (
                    <tr key={ev.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-[11px]">
                        {ev.timestamp ? ev.timestamp.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-2 font-mono text-[11px]">{ev.email}</td>
                      <td className="px-4 py-2 text-[11px] font-semibold">{ev.role || '—'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-sm ${ev.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-slate-500">{ev.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD USER FORM */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreateUser} className="bg-white border-t-4 border-t-military-800 border border-slate-300 shadow-flat p-4 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-military-900 flex items-center border-b border-slate-200 pb-2">
              <UserPlus size={16} className="mr-2" /> Register New Staff
            </h2>

            {message && (
              <div className={`p-2 text-[10px] font-bold uppercase ${message.includes('ERROR') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message}
              </div>
            )}

            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} /></div>

            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Email (Login ID)</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputClass} /></div>

            {/* ★ PASSWORD — ab actually Auth account banta hai */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Initial Password (min 6 chars)</label>
              <input
                type="text"
                required
                minLength={6}
                placeholder="e.g. Staff@2026"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className={inputClass}
              />
              <p className="text-[9px] text-amber-700 font-semibold mt-1 flex items-start">
                <AlertTriangle size={10} className="mr-1 mt-0.5 flex-shrink-0" />
                Ye password staff ko verbally dein. Login ke baad wo Settings se change kar sakta hai.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={inputClass} /></div>

              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Designation</label>
                <input type="text" placeholder="e.g. Sub Inspector" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} className={inputClass} /></div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">System Role</label>
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className={inputClass}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <button type="submit" className="w-full bg-military-800 text-white font-bold uppercase text-xs py-2 hover:bg-military-900 transition-colors">
              Authorize User Profile
            </button>
          </form>
        </div>

        {/* USER LIST */}
        <div className="lg:col-span-2 bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-military-900">Active System Personnel</span>
            <span className="text-[10px] font-bold text-slate-500">{filteredUsers.length} / {users.length} shown</span>
          </div>

          {/* ★ SEARCH + FILTERS BAR */}
          <div className="px-4 py-2 border-b border-slate-200 bg-white grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name / email / desig / phone"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full border border-slate-300 pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-military-700"
              />
            </div>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className={inputClass}>
              <option value="All">All Roles</option>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className={inputClass}>
              <option value="All">All Statuses</option>
              <option value="Active">✅ Active</option>
              <option value="Disabled">⛔ Disabled</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Name & Desig</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Contact</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Role</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Status</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-4 text-xs font-bold">Loading Personnel Data...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-xs font-bold text-slate-400">Koi user filter match nahi karta.</td></tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {u.name}
                          {/* ★ Legacy profile warning — Auth account nahi hai */}
                          {isLegacyProfile(u) && (
                            <span className="text-[8px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-sm uppercase">
                              ⚠ No Login (Legacy)
                            </span>
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
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => toggleUserStatus(u.id, u.isActive)}
                          className={`text-[10px] font-bold uppercase px-3 py-1 rounded-sm border ${u.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                        >
                          {u.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      {/* ★ ACTIONS: Edit + Password Reset */}
                      <td className="px-4 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            title="Edit Profile"
                            className="p-1.5 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-sm"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleSendReset(u)}
                            title="Send Password Reset Email"
                            disabled={isLegacyProfile(u)}
                            className="p-1.5 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-sm disabled:opacity-30"
                          >
                            <KeyRound size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ★ EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEditSave} className="bg-white w-full max-w-md border-t-4 border-t-military-800 shadow-flat p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-military-900">
                Edit Staff Profile — {editUser.email}
              </h2>
              <button type="button" onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            {editMessage && (
              <div className={`p-2 text-[10px] font-bold uppercase ${editMessage.includes('ERROR') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {editMessage}
              </div>
            )}

            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
              <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} /></div>

            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} /></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Designation</label>
                <input type="text" value={editForm.designation} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} className={inputClass} /></div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">System Role</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={inputClass}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {editUser.id === user?.uid && (
                <p className="text-[9px] text-amber-700 font-semibold mt-1">Apna khud ka role change nahi kar sakte (lockout protection).</p>
              )}
            </div>

            <button type="submit" className="w-full bg-military-800 text-white font-bold uppercase text-xs py-2 hover:bg-military-900 transition-colors">
              Save Changes
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
