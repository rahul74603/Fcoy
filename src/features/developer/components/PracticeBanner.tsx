// src/features/developer/components/PracticeBanner.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

// ─────────────────────────────────────────────
// 🧪 PRACTICE MODE banner — sirf tab dikhta hai jab
// Developer account se login ho (users/{uid}.isDeveloper)
// ─────────────────────────────────────────────
export const PracticeBanner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user?.isDeveloper) return null;

  return (
    <div className="bg-orange-500 border-b border-orange-600 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-bold">
      <FlaskConical size={13} className="flex-shrink-0" />
      <span>
        🧪 PRACTICE MODE — Dev account active hai. Jo bhi testing karo,
        baad me Practice Console se <strong>Clean</strong> dabana (sab delete ho jayega).
        Real records edit/delete mat karo.
      </span>
      <button
        onClick={() => navigate('/dev-practice')}
        className="ml-2 text-[10px] font-black uppercase px-2.5 py-1 rounded border border-white/40 hover:bg-white/10 transition-colors"
      >
        Open Console
      </button>
    </div>
  );
};

export default PracticeBanner;
