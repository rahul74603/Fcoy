// 🔑 OWNER RENEW PANEL — payment ke baad plan extend sirf OWNER KEY se
// Company isko use nahi kar sakti (key sirf owner ke paas hoti hai).
// Key wizard ke time banti hai aur subscription/current me save hoti hai.
import React, { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { renewWithOwnerKey } from '../api/subscription.api';
import { PAYMENT_MODES, formatINR } from '../types/subscription.types';
import { fetchPlans } from '../api/subscription.api';

interface Props {
  /** Default selected months (grace/lock me 1 mahina sensible hai) */
  defaultMonths?: number;
  onSuccess?: (endDate: string) => void;
}

const OwnerRenewPanel: React.FC<Props> = ({ defaultMonths = 1, onSuccess }) => {
  const [ownerKey, setOwnerKey] = useState('');
  const [months, setMonths] = useState(defaultMonths);
  const [payMode, setPayMode] = useState(PAYMENT_MODES[0]);
  const [payRef, setPayRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [price, setPrice] = useState<number | null>(null);

  React.useEffect(() => {
    let live = true;
    fetchPlans()
      .then(plans => {
        const p = plans.find(x => x.durationMonths === months) ?? plans[0];
        if (live && p) setPrice(p.price);
      })
      .catch(() => { /* silent */ });
    return () => { live = false; };
  }, [months]);

  const handleRenew = async () => {
    setErr(''); setOkMsg('');
    if (ownerKey.trim().length < 4) { setErr('Owner key daalo (wizard ke done screen pe mili thi).'); return; }
    if (!payRef.trim()) { setErr('Payment reference likhna zaroori hai (UPI txn / receipt no / cash note).'); return; }
    setBusy(true);
    try {
      const res = await renewWithOwnerKey(ownerKey, months, payMode, payRef.trim());
      const msg = `✓ RENEW HO GAYA! Nayi end date: ${new Date(res.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — app ab unlocked hai.`;
      setOkMsg(msg);
      setOwnerKey(''); setPayRef('');
      onSuccess?.(res.endDate);
    } catch (e: any) {
      setErr(e.message ?? 'Renew fail ho gaya');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 space-y-3 text-left">
      <div className="flex items-center gap-2">
        <KeyRound size={15} className="text-amber-400" />
        <h4 className="text-[11px] font-black uppercase text-amber-300 tracking-wider">Owner Renewal (sirf App Owner)</h4>
      </div>

      {okMsg && (
        <div className="bg-green-900/60 border border-green-600 text-green-200 text-xs font-bold px-3 py-2 rounded flex items-start gap-2">
          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" /> {okMsg}
        </div>
      )}
      {err && (
        <div className="bg-red-900/60 border border-red-600 text-red-200 text-xs font-bold px-3 py-2 rounded flex items-start gap-2">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {err}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Owner Key (secret — company ko mat do)</label>
          <input
            value={ownerKey}
            onChange={e => setOwnerKey(e.target.value.toUpperCase())}
            placeholder="OWN-XXXXXX"
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm font-black tracking-widest text-amber-300 uppercase placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Months</label>
          <div className="flex gap-1">
            {[1, 3, 12].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`flex-1 py-1.5 text-xs font-black rounded border transition-colors ${months === m ? 'bg-amber-500 border-amber-400 text-slate-900' : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Payment Mode</label>
          <select
            value={payMode}
            onChange={e => setPayMode(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Payment Reference (UPI txn / receipt no)</label>
          <input
            value={payRef}
            onChange={e => setPayRef(e.target.value)}
            placeholder="jaise: UPI-456789XXXX ya CASH-08AUG"
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs font-semibold text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <button
        onClick={handleRenew}
        disabled={busy}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-xs font-black uppercase py-2.5 rounded transition-colors flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {busy ? 'Renewing...' : `Renew +${months} Month${months > 1 ? 's' : ''}${price != null ? ` · ${formatINR(price)}` : ''}`}
      </button>
      <p className="text-[9px] text-slate-500 font-semibold leading-relaxed">
        Ye sirf OWNER key se chalta hai — payment milne ke baad owner yahin se plan extend karta hai.
        History (subscriptionHistory) me entry apne aap likhi jaati hai. Master app me bhi same payment record karo (billing ledger).
      </p>
    </div>
  );
};

export default OwnerRenewPanel;
