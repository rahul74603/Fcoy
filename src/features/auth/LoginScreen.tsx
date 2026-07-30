import React, { useState, useEffect } from 'react';
import { auth, db } from '../../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ShieldCheck, AlertCircle, KeyRound, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  logLoginEvent,
  requestPasswordReset,
  SESSION_EXPIRED_FLAG,
} from '../system/authSecurity';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // ★ Session timeout notice (AuthContext auto-logout ke baad)
  const [sessionNotice, setSessionNotice] = useState('');
  // ★ Forgot Password panel state
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-logout ke baad yahan notice dikhana hai
    if (sessionStorage.getItem(SESSION_EXPIRED_FLAG)) {
      setSessionNotice('Aapki session 30 min inactivity ke karan expire ho gayi. Dobara login karein.');
      sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSessionNotice('');
    setLoading(true);

    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch Role from Firestore Database
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();

        if (!userData.isActive) {
          setError('Account is disabled. Contact Commander.');
          // ★ AUDIT: disabled account attempt
          logLoginEvent(email, 'FAILED', userData.role ?? '', 'Account disabled');
          auth.signOut();
          return;
        }

        // ★ AUDIT: successful login
        logLoginEvent(email, 'SUCCESS', userData.role ?? '');

        // 3. Role-Based Dashboard Redirection
        switch (userData.role) {
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
          default:
            setError('Unassigned Role. Access Denied.');
            // ★ AUDIT: unassigned role
            logLoginEvent(email, 'FAILED', '', 'Unassigned role');
            auth.signOut();
        }
      } else {
        setError('User profile missing in database.');
        // ★ AUDIT: profile missing
        logLoginEvent(email, 'FAILED', '', 'Profile missing');
        auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      setError('Invalid email or password. Access Denied.');
      // ★ AUDIT: failed credentials
      logLoginEvent(email, 'FAILED', '', 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // ★ FORGOT PASSWORD — reset email bhejo
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    if (!resetEmail.trim()) {
      setResetMessage('ERROR: Email enter karein.');
      return;
    }
    setResetLoading(true);
    try {
      await requestPasswordReset(resetEmail);
      setResetMessage('SUCCESS: Password reset link email par bhej diya gaya. Inbox/Spam check karein.');
    } catch (err: any) {
      setResetMessage(`ERROR: ${err.message}`);
    } finally {
      setResetLoading(false);
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
          {/* ★ SESSION TIMEOUT NOTICE */}
          {sessionNotice && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 text-xs font-bold uppercase flex items-center">
              <Clock size={14} className="mr-2 flex-shrink-0" />
              {sessionNotice}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs font-bold uppercase flex items-center">
              <AlertCircle size={14} className="mr-2 flex-shrink-0" />
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

          {/* ★ FORGOT PASSWORD TOGGLE */}
          <button
            type="button"
            onClick={() => { setShowReset(prev => !prev); setResetEmail(email); setResetMessage(''); }}
            className="w-full text-center text-[10px] font-bold text-military-700 hover:text-military-900 uppercase tracking-wider pt-1"
          >
            <KeyRound size={11} className="inline mr-1 -mt-0.5" />
            {showReset ? 'Hide Password Reset' : 'Forgot Password?'}
          </button>
        </form>

        {/* ★ FORGOT PASSWORD PANEL */}
        {showReset && (
          <form onSubmit={handlePasswordReset} className="px-6 pb-6 space-y-3 border-t border-slate-200 pt-4 bg-slate-50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Password Reset Link — registered email par milega
            </p>
            {resetMessage && (
              <div className={`px-3 py-2 text-[10px] font-bold uppercase border ${resetMessage.startsWith('ERROR') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
                {resetMessage}
              </div>
            )}
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="Registered Email ID"
              className="w-full border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-military-700 bg-white"
              required
            />
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full bg-slate-700 text-white font-bold uppercase tracking-wider py-2 text-xs hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
