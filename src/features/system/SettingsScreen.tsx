// D:\ALL PROJECTS\BSF COYs\frontend\src\features\settings\SettingsScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  Settings, Shield, User, Lock, Save, UserPlus,
  AlertTriangle, CheckCircle2, X, Loader2, Eye,
  EyeOff, RefreshCw, ToggleLeft, ToggleRight,
  Mail, Phone, BadgeCheck, Key, Users, Edit3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail
} from 'firebase/auth';
// ★ Module 18: session-safe user provisioning (secondary app — M16 helper)
import { createStaffAuthUser } from './authSecurity';
import {
  doc, setDoc, getDocs, collection,
  updateDoc, getDoc
} from 'firebase/firestore';
import {
  auth as firebaseAuth,
  db
} from '../../config/firebase';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

interface ProfileForm {
  name: string;
  phone: string;
  designation: string;
}

interface UnitConfig {
  parentUnit: string;
  companyName: string;
  companyShort: string;
  location: string;
  commanderName: string;
  financialYear: string;   // ★ Module 18: e.g. "2026-27"
  sessionLabel: string;    // ★ Module 18: e.g. "Training Session 2026"
  updatedAt: string;
  updatedBy: string;
}

// ★ Module 18: current Indian Financial Year (April–March) auto-compute
export const computeCurrentFY = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const SettingsScreen = () => {
  const { user, refreshUser } = useAuth();

  const isCommander = user?.role === 'Company Commander';
  const canManage   = isCommander;

  // ── Staff List ──
  const [staffList,    setStaffList]    = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // ── Create Staff Form ──
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '',
    phone: '', designation: '', role: 'Clerk'
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);

  // ── Password Change ──
  const [pwForm, setPwForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [showCurrPw, setShowCurrPw] = useState(false);
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [pwLoading,  setPwLoading]  = useState(false);

  // ── Profile Edit ──
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name:        user?.name        ?? '',
    phone:       user?.phone       ?? '',
    designation: user?.designation ?? '',
  });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Unit Config ──
  const [unitConfig,        setUnitConfig]        = useState<UnitConfig | null>(null);
  const [unitConfigLoading, setUnitConfigLoading] = useState(false);
  const [unitEditing,       setUnitEditing]       = useState(false);
  const [unitSaving,        setUnitSaving]        = useState(false);
  const [unitForm,          setUnitForm]          = useState<UnitConfig>({
    parentUnit:    '',
    companyName:   '',
    companyShort:  '',
    location:      '',
    commanderName: '',
    financialYear: computeCurrentFY(),  // ★ Module 18
    sessionLabel:  '',                  // ★ Module 18
    updatedAt:     '',
    updatedBy:     '',
  });

  // ── Alerts ──
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  // ── Active Tab ──
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'staff' | 'unit'>('profile');

  // ── Commander re-auth password ──


  // ── CSS helpers ──
  const inputCls    = "w-full border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-military-700 bg-white rounded";
  const disabledCls = "w-full border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-500 rounded cursor-not-allowed";
  const labelCls    = "text-[10px] font-bold text-slate-500 uppercase block mb-1";

  // ─────────────────────────────────────────
  // SYNC profileForm when user changes
  // ─────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setProfileForm({
        name:        user.name        ?? '',
        phone:       user.phone       ?? '',
        designation: user.designation ?? '',
      });
    }
  }, [user]);

  // ─────────────────────────────────────────
  // FETCH STAFF
  // ─────────────────────────────────────────
  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: StaffUser[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id:          d.id,
          name:        data.name        ?? '',
          email:       data.email       ?? '',
          role:        data.role        ?? '',
          designation: data.designation ?? '',
          phone:       data.phone       ?? '',
          isActive:    data.isActive !== false,
          createdAt:   data.createdAt   ?? '',
        });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStaffList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'staff') fetchStaff();
  }, [activeTab]);

  // ─────────────────────────────────────────
  // FETCH UNIT CONFIG
  // ─────────────────────────────────────────
  const fetchUnitConfig = async () => {
    setUnitConfigLoading(true);
    try {
      const snap = await getDoc(doc(db, 'unitConfig', 'main'));
      if (snap.exists()) {
        const data = snap.data() as UnitConfig;
        // ★ Module 18: purane docs mein FY/session fields nahi honge — defaults merge
        const merged: UnitConfig = {
          ...data,
          financialYear: data.financialYear || computeCurrentFY(),
          sessionLabel:  data.sessionLabel ?? '',
        };
        setUnitConfig(merged);
        setUnitForm(merged);
      } else {
        const defaults: UnitConfig = {
          parentUnit:    'STC TEKANPUR',
          companyName:   'ALPHA-COMPANY',
          companyShort:  'A-COY',
          location:      'TEKANPUR, MADHYA PRADESH',
          commanderName: '',
          financialYear: computeCurrentFY(),
          sessionLabel:  '',
          updatedAt:     '',
          updatedBy:     '',
        };
        setUnitConfig(defaults);
        setUnitForm(defaults);
      }
    } catch (err) {
      console.error('Unit config fetch error:', err);
    } finally {
      setUnitConfigLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'unit') fetchUnitConfig();
  }, [activeTab]);

  // ─────────────────────────────────────────
  // UPDATE OWN PROFILE
  // ─────────────────────────────────────────
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      setError('Name khali nahi ho sakta');
      return;
    }
    setProfileLoading(true);
    setError('');
    setSuccess('');
    try {
      const uid = firebaseAuth.currentUser?.uid;
      if (!uid) throw new Error('Not logged in');

      await updateDoc(doc(db, 'users', uid), {
        name:        profileForm.name.trim(),
        phone:       profileForm.phone.trim(),
        designation: profileForm.designation.trim(),
        updatedAt:   new Date().toISOString(),
      });

      await refreshUser();
      setSuccess('✓ Profile successfully update ho gaya!');
      setProfileEditing(false);
    } catch (err: any) {
      setError(`Profile update failed: ${err.message}`);
    } finally {
      setProfileLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // SAVE UNIT CONFIG
  // ─────────────────────────────────────────
  const handleSaveUnitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCommander) return;
    if (!unitForm.parentUnit.trim() || !unitForm.companyName.trim()) {
      setError('Parent Unit aur Company Name required hain');
      return;
    }
    setUnitSaving(true);
    setError('');
    setSuccess('');
    try {
      const dataToSave: UnitConfig = {
        ...unitForm,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name ?? user?.email ?? 'Unknown',
      };
      await setDoc(doc(db, 'unitConfig', 'main'), dataToSave);
      setUnitConfig(dataToSave);
      setUnitEditing(false);
      setSuccess('✓ Unit configuration save ho gaya!');
    } catch (err: any) {
      setError(`Unit config save failed: ${err.message}`);
    } finally {
      setUnitSaving(false);
    }
  };

  // ─────────────────────────────────────────
  // CREATE STAFF
  // ─────────────────────────────────────────
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!createForm.name || !createForm.email || !createForm.password) {
      setError('Name, Email aur Password required hain');
      return;
    }
    if (createForm.password.length < 6) {
      setError('Password minimum 6 characters ka hona chahiye');
      return;
    }

    setCreateLoading(true);
    setError('');
    setSuccess('');

    // ♻️ Module 18 REFACTOR (M16 pattern ke saath align):
    // Pehle live auth instance par createUserWithEmailAndPassword hota
    // tha — jo CC ko LOGOUT karke naye user mein sign-in kar deta tha,
    // phir CC apna password dobara daal kar vaapis aata tha. Network
    // error aane par CC mid-session logout ho jaata tha.
    // Ab secondary-app pattern — CC ka session 100% safe, password
    // dobara daalne ki zaroorat nahi.
    try {
      const authUid = await createStaffAuthUser(
        createForm.email.trim().toLowerCase(),
        createForm.password
      );

      await setDoc(doc(db, 'users', authUid), {
        name:        createForm.name,
        email:       createForm.email.trim().toLowerCase(),
        phone:       createForm.phone,
        designation: createForm.designation,
        role:        createForm.role,
        isActive:    true,
        createdBy:   user?.uid ?? '',
        createdAt:   new Date().toISOString(),
      });

      setSuccess(`✓ ${createForm.name} (${createForm.role}) ka account ban gaya! Ab ye email/password se login kar sakta hai.`);
      setCreateForm({ name: '', email: '', password: '', phone: '', designation: '', role: 'Clerk' });
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      // createStaffAuthUser friendly Hinglish errors deta hai
      setError(err.message || 'User creation failed');
    } finally {
      setCreateLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // TOGGLE STAFF STATUS
  // ─────────────────────────────────────────
  const handleToggleStatus = async (staff: StaffUser) => {
    if (!canManage) return;
    try {
      await updateDoc(doc(db, 'users', staff.id), {
        isActive: !staff.isActive
      });
      setSuccess(`${staff.name} ${staff.isActive ? 'deactivated' : 'activated'}`);
      fetchStaff();
    } catch {
      setError('Status update failed');
    }
  };

  // ─────────────────────────────────────────
  // CHANGE OWN PASSWORD
  // ─────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      setError('Sab fields fill karo');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setError('Naya password aur confirm password match nahi kar rahe');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setError('Password minimum 6 characters ka hona chahiye');
      return;
    }
    setPwLoading(true);
    setError('');
    setSuccess('');
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('Not logged in');

      const credential = EmailAuthProvider.credential(
        currentUser.email, pwForm.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, pwForm.newPassword);

      setSuccess('✓ Password successfully change ho gaya!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Current password galat hai');
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setPwLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // RESET PASSWORD EMAIL
  // ─────────────────────────────────────────
  const handleResetPasswordEmail = async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setSuccess(`Password reset email bhej diya: ${email}`);
    } catch {
      setError('Email send nahi hua');
    }
  };

  // ─────────────────────────────────────────
  // ROLE COLORS
  // ─────────────────────────────────────────
  const ROLE_COLORS: Record<string, string> = {
    'Company Commander': 'bg-red-100 text-red-800 border-red-300',
    'Quarter Master':    'bg-blue-100 text-blue-800 border-blue-300',
    'Clerk':             'bg-slate-100 text-slate-800 border-slate-300',
    'Ustad':             'bg-green-100 text-green-800 border-green-300',
  };

  // ═════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-military-900 uppercase tracking-wider flex items-center gap-2">
            <Settings size={22} className="text-military-700" />
            System Configuration
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Profile · Security · Staff Management · Unit Config
          </p>
        </div>
        <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
          ROLE_COLORS[user?.role ?? ''] ?? 'bg-slate-100 text-slate-700 border-slate-300'
        }`}>
          {user?.role ?? 'Unknown Role'}
        </span>
      </div>

      {/* ── ALERTS ── */}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* ── TABS ── */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {([
          { key: 'profile',  label: 'My Profile',      icon: <User size={13} />   },
          { key: 'security', label: 'Change Password',  icon: <Lock size={13} />   },
          { key: 'staff',    label: 'Staff Management', icon: <Users size={13} />  },
          { key: 'unit',     label: 'Unit Config',      icon: <Shield size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-military-800 text-military-800'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════ */}
      {/* TAB: MY PROFILE                     */}
      {/* ════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

          {/* Card Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={14} className="text-military-700" />
              <h3 className="text-xs font-black text-slate-800 uppercase">My Profile Information</h3>
            </div>
            {!profileEditing ? (
              <button
                onClick={() => setProfileEditing(true)}
                className="flex items-center gap-1.5 text-[10px] font-black text-military-700 hover:text-military-900 border border-military-300 px-3 py-1.5 rounded hover:bg-military-50 transition-colors"
              >
                <Edit3 size={11} /> Edit Profile
              </button>
            ) : (
              <button
                onClick={() => {
                  setProfileEditing(false);
                  setProfileForm({
                    name:        user?.name        ?? '',
                    phone:       user?.phone       ?? '',
                    designation: user?.designation ?? '',
                  });
                }}
                className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-slate-700 border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
              >
                <X size={11} /> Cancel
              </button>
            )}
          </div>

          <div className="p-5">

            {/* Avatar Row */}
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-military-800 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-black text-white">
                  {(profileEditing ? profileForm.name : user?.name ?? 'U')
                    .charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">
                  {profileEditing ? profileForm.name || '—' : user?.name ?? '—'}
                </p>
                <p className="text-xs text-slate-500">{user?.email ?? '—'}</p>
                <span className={`mt-1 inline-block text-[9px] font-black px-2 py-0.5 rounded-full border ${
                  ROLE_COLORS[user?.role ?? ''] ?? 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  {user?.role ?? '—'}
                </span>
              </div>
            </div>

            {/* ── EDIT MODE ── */}
            {profileEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Name */}
                  <div>
                    <label className={labelCls}>Full Name / Rank & Name *</label>
                    <input
                      type="text" required
                      value={profileForm.name}
                      onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                      className={inputCls}
                      placeholder="e.g. Insp. R.K. Sharma"
                    />
                    <p className="text-[9px] text-slate-400 mt-0.5">Rank + Name dono likhein</p>
                  </div>

                  {/* Role — locked */}
                  <div>
                    <label className={labelCls}>System Role</label>
                    <div className={`${disabledCls} flex items-center gap-2`}>
                      <BadgeCheck size={12} className="text-slate-400" />
                      {user?.role ?? '—'}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Role change ke liye Admin se contact karein
                    </p>
                  </div>

                  {/* Email — locked */}
                  <div>
                    <label className={labelCls}>Email Address</label>
                    <div className={`${disabledCls} flex items-center gap-2`}>
                      <Mail size={12} className="text-slate-400" />
                      {user?.email ?? '—'}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">Email change nahi hoti</p>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className={inputCls}
                      placeholder="10 digit mobile number"
                      maxLength={10}
                    />
                  </div>

                  {/* Designation */}
                  <div className="md:col-span-2">
                    <label className={labelCls}>Designation / Post</label>
                    <input
                      type="text"
                      value={profileForm.designation}
                      onChange={e => setProfileForm({ ...profileForm, designation: e.target.value })}
                      className={inputCls}
                      placeholder="e.g. Company Commander, Head Constable"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="bg-military-800 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-military-700 disabled:opacity-50 flex items-center gap-2 rounded"
                  >
                    {profileLoading
                      ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
                      : <><Save size={13} /> Save Profile</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileEditing(false);
                      setProfileForm({
                        name:        user?.name        ?? '',
                        phone:       user?.phone       ?? '',
                        designation: user?.designation ?? '',
                      });
                    }}
                    className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>

            ) : (
              /* ── VIEW MODE ── */
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Full Name</label>
                    <div className={`${disabledCls} flex items-center gap-2`}>
                      <User size={12} className="text-slate-400" /> {user?.name ?? '—'}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>System Role</label>
                    <div className={`${disabledCls} flex items-center gap-2`}>
                      <BadgeCheck size={12} className="text-slate-400" /> {user?.role ?? '—'}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Email Address</label>
                    <div className={`${disabledCls} flex items-center gap-2`}>
                      <Mail size={12} className="text-slate-400" /> {user?.email ?? '—'}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <div className={`${disabledCls} flex items-center gap-2`}>
                      <Phone size={12} className="text-slate-400" /> {user?.phone ?? 'Not set'}
                    </div>
                  </div>
                  {user?.designation && (
                    <div className="md:col-span-2">
                      <label className={labelCls}>Designation</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <BadgeCheck size={12} className="text-slate-400" /> {user.designation}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-[10px] text-blue-700 font-semibold flex items-center gap-1.5">
                    <Edit3 size={11} />
                    Name, Phone aur Designation change karne ke liye upar&nbsp;
                    <strong>"Edit Profile"</strong>&nbsp;button dabayein.
                    Password change ke liye "Change Password" tab use karein.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: CHANGE PASSWORD                */}
      {/* ════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <Lock size={14} className="text-red-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase">Change Your Password</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleChangePassword} className="max-w-md space-y-4">

              {/* Current Password */}
              <div>
                <label className={labelCls}>Current Password *</label>
                <div className="relative">
                  <input
                    type={showCurrPw ? 'text' : 'password'}
                    value={pwForm.currentPassword}
                    onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    className={inputCls}
                    placeholder="Abhi ka password"
                    required
                  />
                  <button type="button"
                    onClick={() => setShowCurrPw(!showCurrPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showCurrPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className={labelCls}>New Password *</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={pwForm.newPassword}
                    onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    className={inputCls}
                    placeholder="Naya password (min 6 chars)"
                    required minLength={6}
                  />
                  <button type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showNewPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                {/* Strength Bar */}
                {pwForm.newPassword && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {[1, 2, 3, 4].map(level => (
                      <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${
                        pwForm.newPassword.length >= level * 2
                          ? level <= 1 ? 'bg-red-400'
                          : level <= 2 ? 'bg-amber-400'
                          : level <= 3 ? 'bg-blue-400'
                          : 'bg-green-500'
                          : 'bg-slate-200'
                      }`} />
                    ))}
                    <span className="text-[9px] text-slate-500 font-bold">
                      {pwForm.newPassword.length < 6  ? 'Weak'
                       : pwForm.newPassword.length < 8  ? 'OK'
                       : pwForm.newPassword.length < 10 ? 'Good'
                       : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className={labelCls}>Confirm New Password *</label>
                <input
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  className={`${inputCls} ${
                    pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword
                      ? 'border-red-400 bg-red-50'
                      : pwForm.confirmPassword && pwForm.newPassword === pwForm.confirmPassword
                      ? 'border-green-400 bg-green-50'
                      : ''
                  }`}
                  placeholder="Password confirm karo"
                  required
                />
                {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                  <p className="text-[10px] text-red-600 font-bold mt-1">⚠ Passwords match nahi kar rahe</p>
                )}
                {pwForm.confirmPassword && pwForm.newPassword === pwForm.confirmPassword && (
                  <p className="text-[10px] text-green-600 font-bold mt-1">✓ Passwords match kar rahe hain</p>
                )}
              </div>

              <button type="submit" disabled={pwLoading}
                className="bg-military-800 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-military-700 disabled:opacity-50 flex items-center gap-2 rounded">
                {pwLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Changing...</>
                  : <><Key size={13} /> Change Password</>}
              </button>
            </form>

            {/* Forgot Password */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Password bhool gaye?</p>
              <button
                onClick={() => { if (user?.email) handleResetPasswordEmail(user.email); }}
                className="flex items-center gap-1.5 text-[11px] font-bold text-military-700 hover:text-military-900 border border-military-300 px-3 py-1.5 rounded hover:bg-military-50 transition-colors"
              >
                <Mail size={12} /> Send Reset Email to {user?.email}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: STAFF MANAGEMENT               */}
      {/* ════════════════════════════════════ */}
      {activeTab === 'staff' && (
        <div className="space-y-4">

          {/* Create Staff — Commander only */}
          {canManage ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-green-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <UserPlus size={14} className="text-green-700" />
                <h3 className="text-xs font-black text-slate-800 uppercase">Create New Staff Account</h3>
              </div>
              <div className="p-5">
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                  <p className="text-[10px] text-blue-700 font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={11} />
                    Apna (Commander) password neeche enter karo — naya account banane ke baad
                    aap auto-logout NAHI honge. System wapas aapko login kar dega.
                  </p>
                </div>

                <form onSubmit={handleCreateStaff}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className={labelCls}>Rank & Name *</label>
                      <input type="text" required
                        value={createForm.name}
                        onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                        className={inputCls} placeholder="e.g. Insp. R.K. Sharma" />
                    </div>
                    <div>
                      <label className={labelCls}>Official Email *</label>
                      <input type="email" required
                        value={createForm.email}
                        onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                        className={inputCls} placeholder="staff@fcoy.com" />
                    </div>
                    <div>
                      <label className={labelCls}>Login Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required minLength={6}
                          value={createForm.password}
                          onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                          className={inputCls} placeholder="Min 6 characters" />
                        <button type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input type="text"
                        value={createForm.phone}
                        onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                        className={inputCls} placeholder="10 digit number" />
                    </div>
                    <div>
                      <label className={labelCls}>Designation</label>
                      <input type="text"
                        value={createForm.designation}
                        onChange={e => setCreateForm({ ...createForm, designation: e.target.value })}
                        className={inputCls} placeholder="e.g. Head Constable" />
                    </div>
                    <div>
                      <label className={labelCls}>System Role *</label>
                      <select value={createForm.role}
                        onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                        className={inputCls}>
                        <option value="Clerk">Clerk (Documents)</option>
                        <option value="Quarter Master">Quarter Master (Inventory)</option>
                        <option value="Ustad">Ustad (Training)</option>
                      </select>
                    </div>
                  </div>

                  {/* ★ Module 18: Commander re-auth password ki ab zaroorat NAHI —
                      secondary-app provisioning se CC session kabhi disturb nahi hota */}
                  <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                    <p className="text-[10px] font-black text-green-800 uppercase">
                      ✓ Session-Safe Creation — ab aapka apna password dobara nahi maanga jaayega
                    </p>
                    <p className="text-[10px] text-green-700 mt-1">
                      Naya account bante waqt aapka login session ab bilkul disturb nahi hoga.
                      Staff ko uska password verbally dein — wo Settings se baad mein change kar sakta hai.
                    </p>
                  </div>

                  <button type="submit" disabled={createLoading}
                    className="bg-green-700 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 rounded">
                    {createLoading
                      ? <><Loader2 size={13} className="animate-spin" /> Creating Account...</>
                      : <><UserPlus size={13} /> Create Staff Account</>}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded p-4 flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
              <p className="text-xs font-bold text-red-700 uppercase">
                Access Denied: Only Company Commander can create or manage staff accounts.
              </p>
            </div>
          )}

          {/* Staff List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-military-700" />
                <h3 className="text-xs font-black text-slate-800 uppercase">All Staff Accounts</h3>
                <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border">
                  {staffList.length} users
                </span>
              </div>
              <button onClick={fetchStaff} disabled={staffLoading}
                className="text-[10px] font-bold text-military-700 flex items-center gap-1 hover:text-military-900">
                <RefreshCw size={11} className={staffLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {staffLoading ? (
              <div className="p-8 text-center">
                <Loader2 size={24} className="animate-spin text-military-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading staff...</p>
              </div>
            ) : staffList.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Users size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-xs font-bold">Koi staff record nahi</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Name', 'Email', 'Role', 'Designation', 'Status', 'Action'].map(h => (
                        <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {staffList.map(staff => (
                      <tr key={staff.id} className={`hover:bg-slate-50 transition-colors ${
                        !staff.isActive ? 'opacity-50' : ''
                      }`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-military-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-[9px] font-black text-military-800">
                                {staff.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-bold text-slate-800 truncate max-w-[100px]">
                              {staff.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 truncate max-w-[140px]">{staff.email}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                            ROLE_COLORS[staff.role] ?? 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {staff.role}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{staff.designation || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            staff.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {staff.isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {canManage && staff.id !== user?.uid && (
                              <>
                                <button
                                  onClick={() => handleToggleStatus(staff)}
                                  title={staff.isActive ? 'Deactivate' : 'Activate'}
                                  className={`p-1 rounded ${
                                    staff.isActive
                                      ? 'text-red-600 hover:bg-red-50'
                                      : 'text-green-600 hover:bg-green-50'
                                  }`}>
                                  {staff.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                </button>
                                <button
                                  onClick={() => handleResetPasswordEmail(staff.email)}
                                  title="Send password reset email"
                                  className="p-1 rounded text-blue-600 hover:bg-blue-50">
                                  <Mail size={13} />
                                </button>
                              </>
                            )}
                            {staff.id === user?.uid && (
                              <span className="text-[9px] text-slate-400 font-bold">YOU</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: UNIT CONFIG                    */}
      {/* ════════════════════════════════════ */}
      {activeTab === 'unit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

          {/* Card Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-military-700" />
              <h3 className="text-xs font-black text-slate-800 uppercase">Unit Configuration</h3>
              {!isCommander && (
                <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Read Only
                </span>
              )}
            </div>

            {isCommander && !unitEditing && (
              <button
                onClick={() => setUnitEditing(true)}
                className="flex items-center gap-1.5 text-[10px] font-black text-military-700 hover:text-military-900 border border-military-300 px-3 py-1.5 rounded hover:bg-military-50 transition-colors"
              >
                <Edit3 size={11} /> Edit Config
              </button>
            )}
            {unitEditing && (
              <button
                onClick={() => {
                  setUnitEditing(false);
                  if (unitConfig) setUnitForm(unitConfig);
                }}
                className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50"
              >
                <X size={11} /> Cancel
              </button>
            )}
          </div>

          {/* Loading */}
          {unitConfigLoading ? (
            <div className="p-8 text-center">
              <Loader2 size={20} className="animate-spin text-military-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading config...</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">

              {/* ── EDIT MODE ── */}
              {unitEditing && isCommander ? (
                <form onSubmit={handleSaveUnitConfig} className="space-y-4">

                  <div className="bg-amber-50 border border-amber-200 rounded p-3">
                    <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1.5">
                      <AlertTriangle size={11} />
                      Ye changes poore system mein reflect honge. Soch samajh ke update karein.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Parent Unit */}
                    <div>
                      <label className={labelCls}>Parent Unit *</label>
                      <input
                        type="text" required
                        value={unitForm.parentUnit}
                        onChange={e => setUnitForm({ ...unitForm, parentUnit: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. STC TEKANPUR"
                      />
                    </div>

                    {/* Company Full Name */}
                    <div>
                      <label className={labelCls}>Company Full Name *</label>
                      <input
                        type="text" required
                        value={unitForm.companyName}
                        onChange={e => setUnitForm({ ...unitForm, companyName: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. F COY (ALPHA)"
                      />
                    </div>

                    {/* Company Short Name */}
                    <div>
                      <label className={labelCls}>Company Short Name</label>
                      <input
                        type="text"
                        value={unitForm.companyShort}
                        onChange={e => setUnitForm({ ...unitForm, companyShort: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. FCOY"
                        maxLength={10}
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Documents / headers mein use hoga
                      </p>
                    </div>

                    {/* Location */}
                    <div>
                      <label className={labelCls}>Location / Station</label>
                      <input
                        type="text"
                        value={unitForm.location}
                        onChange={e => setUnitForm({ ...unitForm, location: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. TEKANPUR, MADHYA PRADESH"
                      />
                    </div>

                    {/* Commander Name */}
                    <div className="md:col-span-2">
                      <label className={labelCls}>Commander Name & Rank</label>
                      <input
                        type="text"
                        value={unitForm.commanderName}
                        onChange={e => setUnitForm({ ...unitForm, commanderName: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. Insp. Rajesh Kumar"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Official documents mein Commander ka naam aayega
                      </p>
                    </div>

                    {/* ★ Module 18: Financial Year */}
                    <div>
                      <label className={labelCls}>Financial Year</label>
                      <input
                        type="text"
                        value={unitForm.financialYear}
                        onChange={e => setUnitForm({ ...unitForm, financialYear: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. 2026-27"
                        maxLength={9}
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Finance reports / vouchers mein reference
                      </p>
                    </div>

                    {/* ★ Module 18: Training Session */}
                    <div>
                      <label className={labelCls}>Training Session Label</label>
                      <input
                        type="text"
                        value={unitForm.sessionLabel}
                        onChange={e => setUnitForm({ ...unitForm, sessionLabel: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. Session 2025-26 (RECT)"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Academic year / course session ka label
                      </p>
                    </div>
                  </div>

                  {/* Save / Cancel Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={unitSaving}
                      className="bg-military-800 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-military-700 disabled:opacity-50 flex items-center gap-2 rounded"
                    >
                      {unitSaving
                        ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
                        : <><Save size={13} /> Save Configuration</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUnitEditing(false);
                        if (unitConfig) setUnitForm(unitConfig);
                      }}
                      className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>

              ) : (
                /* ── VIEW MODE ── */
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Parent Unit</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <Shield size={12} className="text-slate-400" />
                        {unitConfig?.parentUnit || '—'}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Company Full Name</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <Shield size={12} className="text-slate-400" />
                        {unitConfig?.companyName || '—'}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Company Short Name</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <Shield size={12} className="text-slate-400" />
                        {unitConfig?.companyShort || '—'}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Location / Station</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <Shield size={12} className="text-slate-400" />
                        {unitConfig?.location || '—'}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Commander Name & Rank</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <User size={12} className="text-slate-400" />
                        {unitConfig?.commanderName || '—'}
                      </div>
                    </div>
                    {/* ★ Module 18: FY + Session view rows */}
                    <div>
                      <label className={labelCls}>Financial Year</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <Shield size={12} className="text-slate-400" />
                        {unitConfig?.financialYear || computeCurrentFY()}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Training Session</label>
                      <div className={`${disabledCls} flex items-center gap-2`}>
                        <Shield size={12} className="text-slate-400" />
                        {unitConfig?.sessionLabel || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Last Updated Info */}
                  {unitConfig?.updatedAt && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <p className="text-[10px] text-slate-500 font-semibold">
                        Last updated by{' '}
                        <strong className="text-slate-700">{unitConfig.updatedBy || '—'}</strong>
                        {' '}on{' '}
                        <strong className="text-slate-700">
                          {new Date(unitConfig.updatedAt).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </strong>
                      </p>
                    </div>
                  )}

                  {/* Info for non-commanders */}
                  {!isCommander && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1.5">
                        <AlertTriangle size={11} />
                        Unit configuration sirf Company Commander change kar sakta hai.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SettingsScreen;