// ═══════════════════════════════════════════════════════════
// CHANGE PASSWORD MODAL
// Any logged-in user can change their own password
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { KeyRound, Loader2, X, Eye, EyeOff } from 'lucide-react';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = async () => {
    setError('');
    setSuccess('');

    if (!currentPass || !newPass) {
      setError('Purana aur naya password dono daalo');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Naya password aur confirm match nahi kar rahe');
      return;
    }
    if (newPass.length < 6) {
      setError('Password kam se kam 6 characters ka ho');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email) {
        setError('Login nahi hai. Pehle login karo.');
        setLoading(false);
        return;
      }

      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPass);

      setSuccess('✅ Password change ho gaya!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setTimeout(() => { onClose(); setSuccess(''); }, 2000);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Purana password galat hai');
      } else if (err.code === 'auth/weak-password') {
        setError('Password bahut kamzor hai — kam se kam 6 characters');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Bahut zyada attempts. Thodi der baad try karo.');
      } else {
        setError(err.message || 'Error aa gaya');
      }
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="bg-military-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <KeyRound size={16} /> Change Password
          </h3>
          <button onClick={onClose} className="text-white hover:text-red-300"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-xs font-bold">{error}</div>}
          {success && <div className="bg-green-50 border border-green-300 text-green-700 px-3 py-2 rounded-lg text-xs font-bold">{success}</div>}

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">Purana Password *</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm pr-10" />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">Naya Password *</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
              placeholder="Min 6 characters" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">Naya Password Confirm *</label>
            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
            <button onClick={handleChange} disabled={loading}
              className="px-6 py-2 bg-military-800 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-military-900 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
