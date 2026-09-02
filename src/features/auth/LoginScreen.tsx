import React, { useState } from 'react';
import { auth, db } from '../../config/firebase';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async () => {
    if (!email.trim()) { setError('Pehle registered email enter karein.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError('Password reset email bhej diya gaya hai. Inbox / spam check karein.');
    } catch (err: any) {
      setError(err?.code === 'auth/user-not-found' ? 'Ye email Firebase Authentication mein registered nahi hai.' : 'Password reset nahi bheja ja saka. Email check karein.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch Role from Firestore Database
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const legacySnap = !userDocSnap.exists() && user.email
        ? await getDocs(query(collection(db, 'users'), where('email', '==', user.email)))
        : null;
      const userData = userDocSnap.exists()
        ? userDocSnap.data()
        : legacySnap && !legacySnap.empty ? legacySnap.docs[0].data() : null;

      if (userData) {
        
        if (userData.isActive === false) {
          setError('Account disabled hai. App Owner / Commander se contact karo.');
          auth.signOut();
          return;
        }

        // 3. Role-Based Dashboard Redirection. Accept legacy role spellings.
        const roleKey = String(userData.role ?? '').trim().toLowerCase();
        const normalizedRole = roleKey === 'qm' || roleKey === 'quartermaster' ? 'Quarter Master'
          : roleKey === 'cc' || roleKey === 'commander' || roleKey === 'company commander' ? 'Company Commander'
          : roleKey === 'clerk' ? 'Clerk'
          : roleKey === 'ustad' || roleKey === 'instructor' ? 'Ustad'
          : roleKey === 'so' || roleKey === 'senior officer' || roleKey === 'inspector'
              || roleKey === 'senior officer / inspector' ? 'Senior Officer / Inspector'
          : roleKey === 'trainee' || roleKey === 'trainee senior' || roleKey === 'course trainee senior'
              || roleKey === 'senior trainee' || roleKey === 'course trainee' || roleKey === 'cts' ? 'Trainee'
          : String(userData.role ?? '');
        switch (normalizedRole) {
          case 'Company Commander':
            navigate('/commander');
            break;
          case 'Quarter Master':
            navigate('/quartermaster');
            break;
          case 'Clerk':
            navigate('/clerk');
            break;
          case 'Ustad':
            navigate('/ustad'); // Ustad dashboard route
            break;
          case 'Senior Officer / Inspector':
            navigate('/so-dashboard');
            break;
          case 'Trainee':
            navigate('/trainee-dashboard');
            break;
          default:
            setError('Unassigned Role. Access Denied.');
            auth.signOut();
        }
      } else {
        setError(`Profile missing: Firestore > users me is UID ka document nahi hai — ${user.uid} — App Owner se contact karo.`);
        auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      // Auth success ho sakta hai lekin profile read fail ho (rules) — galat error mat dikha
      if (err?.code === 'permission-denied') {
        setError('Login hua, lekin Firestore permissions deployed nahi hain. firestore.rules deploy karke try karo.');
      } else if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        setError('Invalid email or password. Access Denied.');
      } else if (err?.code === 'auth/too-many-requests') {
        setError('Bahut zyada attempts ho gaye. Thodi der baad try karo.');
      } else if (err?.code === 'auth/network-request-failed') {
        setError('Internet connection check karo.');
      } else {
        setError('Login service error. Firebase connection check karo.');
      }
      auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-military-950 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white shadow-flat border-t-4 border-military-800">
        <div className="p-6 text-center border-b border-slate-200 bg-slate-50">
          <div className="w-16 h-16 bg-military-900 mx-auto rounded-sm flex items-center justify-center mb-4 shadow-inner">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-military-900 uppercase tracking-widest">Training Command</h1>
          <p className="text-xs font-bold text-slate-500 tracking-wider mt-1 uppercase">Secure ERP Login (F COY)</p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs font-bold uppercase flex items-center">
              <AlertCircle size={14} className="mr-2" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email ID</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-military-700 bg-slate-50 focus:bg-white transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-military-700 bg-slate-50 focus:bg-white transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-military-800 text-white font-bold uppercase tracking-wider py-2.5 text-xs hover:bg-military-900 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
          <button type="button" onClick={handleResetPassword} className="w-full text-[10px] font-bold text-military-700 underline hover:text-military-900">Forgot password?</button>
          <button type="button" onClick={() => navigate('/first-run')}
            className="w-full text-[10px] font-bold text-slate-400 hover:text-green-600 mt-1 transition-colors">
            🚀 Nayi company app? First-Run Setup Wizard
          </button>
        </form>
      </div>
    </div>
  );
};