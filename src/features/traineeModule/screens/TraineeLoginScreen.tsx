// ═══════════════════════════════════════════════════════════
// TRAINEE LOGIN SCREEN
// Username + Password login (set by Clerk)
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { getTraineeAccountByUsername, changeTraineePassword } from '../api/trainee.api';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

export const TRAINEE_SESSION_KEY = 'fcoy_trainee_session';

export const TraineeLoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Change password modal
  const [showChangePass, setShowChangePass] = useState(false);
  const [changePassData, setChangePassData] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [changePassError, setChangePassError] = useState('');
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassAccountId, setChangePassAccountId] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username aur Password dono daalo');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const account = await getTraineeAccountByUsername(username.trim());
      if (!account) { setError('Account nahi mila. Admin se baat karo.'); setLoading(false); return; }
      if (!account.isActive) { setError('Account band hai. Admin se baat karo.'); setLoading(false); return; }
      if (account.password !== password) { setError('Galat password'); setLoading(false); return; }

      // Get trainee details
      let traineeData: any = {};
      try {
        const traineeSnap = await getDocs(query(collection(db, 'trainees'), where('__name__', '==', account.traineeId)));
        if (!traineeSnap.empty) traineeData = traineeSnap.docs[0].data();
      } catch {}

      // Get batch name
      let batchName = '';
      if (traineeData.batchId) {
        try {
          const batchSnap = await getDocs(query(collection(db, 'batches'), where('__name__', '==', traineeData.batchId)));
          if (!batchSnap.empty) batchName = batchSnap.docs[0].data().name || '';
        } catch {}
      }

      const session = {
        accountId: account.id,
        traineeId: account.traineeId,
        username: account.username,
        chestNo: traineeData.chestNo || '',
        name: traineeData.name || 'Trainee',
        platoon: traineeData.platoon || '',
        batchId: traineeData.batchId || '',
        batchName,
        loginTime: new Date().toISOString(),
      };
      sessionStorage.setItem(TRAINEE_SESSION_KEY, JSON.stringify(session));
      navigate('/trainee-dashboard');
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    setPassError('');
    if (!changePassData.oldPass || !changePassData.newPass) {
      setPassError('Purana aur naya password dono daalo');
      return;
    }
    if (changePassData.newPass !== changePassData.confirmPass) {
      setPassError('Naya password aur confirm match nahi kar rahe');
      return;
    }
    if (changePassData.newPass.length < 4) {
      setPassError('Password kam se kam 4 characters ka ho');
      return;
    }
    setChangePassLoading(true);
    try {
      const account = await getTraineeAccountByUsername(username.trim());
      if (!account) { setPassError('Pehle login karo'); setChangePassLoading(false); return; }
      const ok = await changeTraineePassword(account.id, changePassData.oldPass, changePassData.newPass);
      if (!ok) { setPassError('Purana password galat hai'); setChangePassLoading(false); return; }
      setShowChangePass(false);
      setChangePassData({ oldPass: '', newPass: '', confirmPass: '' });
      alert('✅ Password change ho gaya! Naye password se login karo.');
    } catch (err: any) {
      setPassError(err.message);
    }
    setChangePassLoading(false);
  };

  const setPassError = (msg: string) => setChangePassError(msg);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-green-800 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white">TRAINEE LOGIN</h1>
          <p className="text-green-200 text-xs mt-1">BSF Training Center — Trainee Portal</p>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-xs font-bold">{error}</div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Username</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Username jo Clerk ne diya"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm font-bold"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm font-bold pr-10"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="w-full py-3 bg-green-700 text-white font-black rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            {loading ? 'Login ho raha hai...' : 'LOGIN'}
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setShowChangePass(true); setChangePassError(''); }}
              className="flex-1 py-2 text-xs text-green-700 hover:text-green-900 flex items-center justify-center gap-1 border border-green-200 rounded-lg hover:bg-green-50">
              <KeyRound size={14} /> Change Password
            </button>
            <button onClick={() => navigate('/login')}
              className="flex-1 py-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
              ← Staff Login
            </button>
          </div>
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showChangePass && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="bg-green-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2"><KeyRound size={16} /> Change Password</h3>
              <button onClick={() => setShowChangePass(false)} className="text-white"><span className="text-lg">×</span></button>
            </div>
            <div className="p-4 space-y-3">
              {changePassError && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-xs font-bold">{changePassError}</div>}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Purana Password *</label>
                <input type="password" value={changePassData.oldPass} onChange={e => setChangePassData(p => ({ ...p, oldPass: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Naya Password *</label>
                <input type="password" value={changePassData.newPass} onChange={e => setChangePassData(p => ({ ...p, newPass: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Naya Password Confirm *</label>
                <input type="password" value={changePassData.confirmPass} onChange={e => setChangePassData(p => ({ ...p, confirmPass: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowChangePass(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleChangePassword} disabled={changePassLoading}
                  className="px-6 py-2 bg-green-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-green-800 disabled:opacity-50">
                  {changePassLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
