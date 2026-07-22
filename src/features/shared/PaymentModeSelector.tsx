// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\shared\PaymentModeSelector.tsx

import React from 'react';
import { Banknote, Receipt, Smartphone, Globe, Hash } from 'lucide-react';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export type PaymentMode = 'Cash' | 'Check' | 'Online' | 'Bank Transfer';

interface PaymentModeSelectorProps {
  mode: PaymentMode;
  setMode: (m: PaymentMode) => void;
  checkNumber: string;
  setCheckNumber: (v: string) => void;
  transactionId: string;
  setTransactionId: (v: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const PAYMENT_MODES: {
  value: PaymentMode;
  label: string;
  icon: React.ReactNode;
  hint: string;
}[] = [
  { value: 'Cash',          label: 'Cash',     icon: <Banknote size={14} />,   hint: 'Naqad payment'           },
  { value: 'Check',         label: 'Check',    icon: <Receipt size={14} />,    hint: 'Check number daalo'      },
  { value: 'Online',        label: 'Online',   icon: <Smartphone size={14} />, hint: 'UPI/NEFT Transaction ID' },
  { value: 'Bank Transfer', label: 'Transfer', icon: <Globe size={14} />,      hint: 'Bank transfer reference' },
];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export const PaymentModeSelector: React.FC<PaymentModeSelectorProps> = ({
  mode,
  setMode,
  checkNumber,
  setCheckNumber,
  transactionId,
  setTransactionId,
  disabled = false,
  size = 'md',
}) => {
  const btnPy = size === 'sm' ? 'py-1.5' : 'py-2';
  const textSz = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-slate-500 uppercase block">
        Payment Mode *
      </label>

      {/* Mode Buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {PAYMENT_MODES.map(pm => (
          <button
            key={pm.value}
            type="button"
            disabled={disabled}
            onClick={() => setMode(pm.value)}
            className={`flex flex-col items-center gap-1 ${btnPy} px-1 rounded-lg border-2 ${textSz} font-bold transition-all ${
              mode === pm.value
                ? 'border-military-800 bg-military-50 text-military-800'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {pm.icon}
            <span>{pm.label}</span>
          </button>
        ))}
      </div>

      {/* Check Number Field */}
      {mode === 'Check' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <label className="text-[10px] font-bold text-blue-700 uppercase block mb-1 flex items-center gap-1">
            <Hash size={10} /> Check Number *
          </label>
          <input
            type="text"
            value={checkNumber}
            onChange={e => setCheckNumber(e.target.value)}
            placeholder="e.g. 123456"
            disabled={disabled}
            className="w-full border border-blue-300 px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-600 rounded bg-white"
          />
        </div>
      )}

      {/* Transaction ID Field */}
      {(mode === 'Online' || mode === 'Bank Transfer') && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <label className="text-[10px] font-bold text-purple-700 uppercase block mb-1 flex items-center gap-1">
            <Globe size={10} />{' '}
            {mode === 'Online' ? 'Transaction ID / UPI Ref' : 'Transfer Reference'} *
          </label>
          <input
            type="text"
            value={transactionId}
            onChange={e => setTransactionId(e.target.value)}
            placeholder={
              mode === 'Online'
                ? 'e.g. UPI123456789'
                : 'e.g. NEFT/RTGS Ref No.'
            }
            disabled={disabled}
            className="w-full border border-purple-300 px-3 py-2 text-xs font-bold focus:outline-none focus:border-purple-600 rounded bg-white"
          />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// HELPER: Payment Mode Badge (for display)
// ─────────────────────────────────────────────
export const PaymentModeBadge: React.FC<{
  mode?: string;
  checkNumber?: string;
  transactionId?: string;
}> = ({ mode, checkNumber, transactionId }) => {
  if (!mode) return null;

  const ref = checkNumber || transactionId || '';

  const cfg: Record<string, { bg: string; icon: React.ReactNode }> = {
    Cash:            { bg: 'bg-slate-100 text-slate-600',   icon: <Banknote size={9} />    },
    Check:           { bg: 'bg-blue-100 text-blue-700',     icon: <Receipt size={9} />     },
    Online:          { bg: 'bg-purple-100 text-purple-700', icon: <Smartphone size={9} />  },
    'Bank Transfer': { bg: 'bg-indigo-100 text-indigo-700', icon: <Globe size={9} />       },
  };

  const c = cfg[mode] ?? cfg['Cash'];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${c.bg}`}
      >
        {c.icon} {mode}
      </span>
      {ref && (
        <span
          className="text-[8px] font-mono text-slate-400 truncate max-w-[80px]"
          title={ref}
        >
          #{ref}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// HELPER: Validate Payment Mode
// ─────────────────────────────────────────────
export const validatePaymentMode = (
  mode: PaymentMode,
  checkNumber: string,
  transactionId: string
): string | null => {
  if (mode === 'Check' && !checkNumber.trim()) {
    return 'Check number daalo';
  }
  if ((mode === 'Online' || mode === 'Bank Transfer') && !transactionId.trim()) {
    return 'Transaction ID / Reference daalo';
  }
  return null; // valid
};

// ─────────────────────────────────────────────
// HELPER: Get Payment Reference
// ─────────────────────────────────────────────
export const getPaymentRef = (
  mode: PaymentMode,
  checkNumber: string,
  transactionId: string
): string => {
  if (mode === 'Check') return checkNumber;
  if (mode === 'Online' || mode === 'Bank Transfer') return transactionId;
  return '';
};

export default PaymentModeSelector;