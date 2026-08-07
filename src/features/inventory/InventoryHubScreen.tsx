import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { AlertTriangle, Archive, ArrowRight, Boxes, CheckCircle2, CircleDollarSign, RefreshCw, ShieldAlert, ShoppingCart, Users } from 'lucide-react';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { useNavigate } from 'react-router-dom';

interface Row { id: string; [key: string]: any }
const n = (v: any) => Number(v ?? 0);

/** Central read-only view over the two inventory ledgers. Mutations stay in the specialised screens. */
export const InventoryHubScreen: React.FC = () => {
  const navigate = useNavigate();
  const { activeBatch, allBatches } = useBatch();
  const [batchId, setBatchId] = useState('active');
  const [tab, setTab] = useState<'assets' | 'kit' | 'damage'>('assets');
  const [assets, setAssets] = useState<Row[]>([]);
  const [purchases, setPurchases] = useState<Row[]>([]);
  const [issues, setIssues] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const inBatch = useCallback((row: Row) => {
    if (batchId === 'all') return true;
    const selected = batchId === 'active' ? activeBatch?.id : batchId;
    // Legacy documents are intentionally treated as belonging to the active batch.
    return row.batchId ? row.batchId === selected : selected === activeBatch?.id;
  }, [activeBatch?.id, batchId]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const read = async (name: string) => (await getDocs(collection(db, name))).docs.map(d => ({ id: d.id, ...d.data() }));
      const [a, p, i] = await Promise.all([read('company_assets_expenses'), read('training_fund_expenses'), read('issue_records')]);
      setAssets(a); setPurchases(p); setIssues(i);
    } catch (e) { console.error(e); setError('Inventory data could not be loaded. Please refresh.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filteredAssets = useMemo(() => assets.filter(inBatch), [assets, inBatch]);
  const filteredPurchases = useMemo(() => purchases.filter(inBatch), [purchases, inBatch]);
  const filteredIssues = useMemo(() => issues.filter(r => inBatch(r) && (r.issueSource === 'TRAINING_ESSENTIALS' || r.issueType === 'TRAINING_ESSENTIALS')), [issues, inBatch]);
  const assetRows = useMemo(() => {
    const map = new Map<string, Row>();
    filteredAssets.forEach(r => { const key = String(r.itemName || 'Unnamed'); const old = map.get(key) || { id: key, itemName: key, quantity: 0, damaged: 0, disposed: 0, value: 0 }; old.quantity += n(r.quantity); old.damaged += n(r.damagedQty); old.disposed += n(r.disposedQty); old.value += n(r.amount); map.set(key, old); });
    return [...map.values()];
  }, [filteredAssets]);
  const kitRows = useMemo(() => {
    const map = new Map<string, Row>();
    filteredPurchases.forEach(r => { const key = String(r.itemName || 'Unnamed'); const old = map.get(key) || { id: key, itemName: key, purchased: 0, value: 0, issued: 0, min: n(r.minStockAlert) || 2 }; old.purchased += n(r.quantity); old.value += n(r.amount); old.min = n(r.minStockAlert) || old.min; map.set(key, old); });
    filteredIssues.forEach(r => (Array.isArray(r.issuedItems) ? r.issuedItems : r.items || []).forEach((item: any) => { const key = String(item.itemName || 'Unnamed'); const old = map.get(key) || { id: key, itemName: key, purchased: 0, value: 0, issued: 0, min: 2 }; old.issued += n(item.quantity) || 1; map.set(key, old); }));
    return [...map.values()].map(r => ({ ...r, available: Math.max(0, r.purchased - r.issued) }));
  }, [filteredPurchases, filteredIssues]);
  const damaged = assetRows.filter(r => r.damaged > 0 || r.disposed > 0);
  const totalDamaged = assetRows.reduce((s, r) => s + r.damaged, 0);
  const totalIssued = kitRows.reduce((s, r) => s + (r as any).issued, 0);
  const lowStock = kitRows.filter(r => (r as any).available <= (r as any).min).length;
  const valuation = filteredAssets.reduce((s, r) => s + n(r.amount), 0);

  const Stat = ({ label, value, tone, icon: Icon }: any) => <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${tone} p-4 shadow-sm`}><div className="flex justify-between text-slate-500"><span className="text-[11px] font-black uppercase tracking-wide">{label}</span><Icon size={18} /></div><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>;
  const Badge = ({ children, tone }: any) => <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${tone}`}>{children}</span>;

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-emerald-700"><Boxes size={16} /> Central Operations</div><h1 className="text-3xl font-black tracking-tight text-slate-900">Inventory &amp; Stock Hub</h1><p className="mt-1 text-sm text-slate-500">One clear source of truth for permanent property and trainee essentials.</p></div>
      <button onClick={load} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase hover:bg-slate-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </header>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><span className="text-xs font-black uppercase text-slate-500">Batch view</span><select value={batchId} onChange={e => setBatchId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><option value="active">Active batch (legacy records included)</option><option value="all">All batches</option>{allBatches.map(b => <option key={b.id} value={b.id}>{b.batchNumber} — {b.batchName}</option>)}</select>{activeBatch && <Badge tone="bg-emerald-100 text-emerald-700">ACTIVE: {activeBatch.batchNumber}</Badge>}</div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Asset valuation" value={`₹${valuation.toLocaleString('en-IN')}`} tone="border-emerald-500" icon={CircleDollarSign} /><Stat label="Low stock alerts" value={lowStock} tone="border-amber-500" icon={AlertTriangle} /><Stat label="Total issued items" value={totalIssued} tone="border-blue-500" icon={Users} /><Stat label="Damaged units" value={totalDamaged} tone="border-red-500" icon={ShieldAlert} /></div>
    <div className="flex flex-wrap gap-2 rounded-xl bg-slate-900 p-2">{([['assets','🏛️ Company Assets Ledger'],['kit','👟 Training Kit Stock & Issue'],['damage','📉 Damage & Disposed Registry']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2.5 text-sm font-black ${tab === key ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</button>)}</div>
    {loading ? <div className="rounded-xl bg-white p-12 text-center text-sm text-slate-500">Loading ledgers…</div> : <>
      {tab === 'assets' && <Ledger title="Company Assets Ledger" subtitle="Permanent company property · active, damaged and disposed quantities" rows={assetRows} type="asset" onManage={() => navigate('/company-assets-fund')} Badge={Badge} />}
      {tab === 'kit' && <Ledger title="Training Kit Stock & Issue" subtitle="Trainee essentials · available stock is purchased minus issued" rows={kitRows} type="kit" onManage={() => navigate('/issue-kit')} Badge={Badge} />}
      {tab === 'damage' && <Ledger title="Damage & Disposed Registry" subtitle="Central register for loss, damage and disposal across the selected batch" rows={damaged} type="damage" onManage={() => navigate('/company-assets-fund')} Badge={Badge} />}
    </>}
  </div>;
};

const Ledger = ({ title, subtitle, rows, type, onManage, Badge }: any) => <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-lg font-black text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button onClick={onManage} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700">{type === 'kit' ? <ShoppingCart size={14} /> : <Archive size={14} />} Open management screen <ArrowRight size={14} /></button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr>{type === 'kit' ? <><th className="px-5 py-3">Item</th><th className="px-5 py-3">Purchased</th><th className="px-5 py-3">Issued</th><th className="px-5 py-3">Available</th><th className="px-5 py-3">Status</th></> : <><th className="px-5 py-3">Asset</th><th className="px-5 py-3">Total purchased</th><th className="px-5 py-3">Active</th><th className="px-5 py-3">Damaged</th><th className="px-5 py-3">Disposed</th><th className="px-5 py-3">Valuation</th></>}</tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={type === 'kit' ? 5 : 6} className="p-10 text-center text-sm text-slate-400">No records for this batch.</td></tr> : rows.map((r: any) => type === 'kit' ? <tr key={r.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-bold">📦 {r.itemName}</td><td className="px-5 py-4">{r.purchased}</td><td className="px-5 py-4">{r.issued}</td><td className="px-5 py-4 font-black">{r.available}</td><td className="px-5 py-4">{(r as any).available <= (r as any).min ? <Badge tone="bg-amber-100 text-amber-700">LOW STOCK</Badge> : <Badge tone="bg-emerald-100 text-emerald-700"><CheckCircle2 size={11} className="mr-1" /> OK</Badge>}</td></tr> : <tr key={r.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-bold">🏛️ {r.itemName}</td><td className="px-5 py-4">{r.quantity}</td><td className="px-5 py-4 font-black text-emerald-700">{Math.max(0, r.quantity - r.damaged - r.disposed)}</td><td className="px-5 py-4"><Badge tone="bg-red-100 text-red-700">{r.damaged}</Badge></td><td className="px-5 py-4"><Badge tone="bg-slate-100 text-slate-700">{r.disposed}</Badge></td><td className="px-5 py-4 font-semibold">₹{n(r.value).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div></section>;

export default InventoryHubScreen;
