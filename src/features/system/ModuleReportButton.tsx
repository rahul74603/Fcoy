import React, { useState } from 'react';
import { FileSpreadsheet, Printer, X } from 'lucide-react';

export type ReportModule = 'mess' | 'training' | 'assets' | 'inventory' | 'general' | 'clerk' | 'all';
export interface ModuleReportRow { item: string; quantity?: number | string; unitPrice?: number | string; amount?: number | string; status?: string; detail?: string; }
export interface ModuleReportStat { label: string; value: string | number; }
interface Props { module: ReportModule; stats?: ModuleReportStat[]; rows?: ModuleReportRow[]; }
const CONFIG: Record<ReportModule, { title: string; subtitle: string; emoji: string }> = {
  mess: { title: 'Mess Fund Statement', subtitle: 'Collections, purchases, payments and vendor dues', emoji: '🍽️' },
  training: { title: 'Training Essentials Stock Report', subtitle: 'Purchased, issued, available stock and recovery', emoji: '🎓' },
  assets: { title: 'Company Assets Ledger', subtitle: 'Purchased property with active, damaged and disposed split', emoji: '🏛️' },
  inventory: { title: 'Training Kit Issue Report', subtitle: 'Trainee-wise issue and live stock statement', emoji: '👟' },
  general: { title: 'General Fund Statement', subtitle: 'Collections, transfers, purchases, payments and vendor dues', emoji: '💰' },
  clerk: { title: 'Clerk Operations Report', subtitle: 'Trainee, attendance and training records', emoji: '📋' },
  all: { title: 'Central Command Report', subtitle: 'Company-wide management statement', emoji: '🛡️' },
};
const money = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

/** Inline, data-backed report generator. It never navigates away from the active module. */
export const ModuleReportButton: React.FC<Props> = ({ module, stats = [], rows = [] }) => {
  const [open, setOpen] = useState(false); const config = CONFIG[module];
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const print = () => {
    const content = document.getElementById('inline-command-report'); if (!content) return;
    const win = window.open('', '_blank', 'width=1000,height=800'); if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${config.title}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;padding:28px}.head{border-bottom:3px solid #263c20;padding-bottom:14px;display:flex;justify-content:space-between}.brand{font-size:21px;font-weight:900;letter-spacing:1px;color:#263c20}.sub{font-size:11px;color:#64748b;margin-top:5px}.meta{text-align:right;font-size:10px;color:#475569}.title{font-size:18px;font-weight:900;text-transform:uppercase;margin:24px 0 4px}.rule{height:1px;background:#cbd5e1;margin:10px 0 18px}.notice{background:#f1f5f9;border-left:4px solid #263c20;padding:12px;font-size:12px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.card{border:1px solid #cbd5e1;padding:12px}.label{font-size:9px;text-transform:uppercase;color:#64748b;font-weight:bold}.value{font-size:18px;font-weight:900;margin-top:6px}.table{width:100%;border-collapse:collapse;margin-top:18px}.table th{background:#263c20;color:#fff;text-align:left;font-size:10px;text-transform:uppercase;padding:9px}.table td{border:1px solid #cbd5e1;padding:9px;font-size:11px}.footer{margin-top:35px;border-top:1px solid #cbd5e1;padding-top:10px;font-size:9px;color:#64748b;display:flex;justify-content:space-between}@media print{body{padding:12mm}}</style></head><body>${content.innerHTML}<script>window.onload=()=>window.print()</script></body></html>`); win.document.close();
  };
  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-slate-700 shadow-sm hover:border-slate-500 hover:bg-slate-50"><FileSpreadsheet size={13} /> Generate Report</button>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"><div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="font-black text-slate-900">{config.title} · Preview</h2><p className="text-xs text-slate-500">Live itemized statement · Print karke PDF save karein</p></div><button onClick={() => setOpen(false)}><X size={18}/></button></div>
      <div id="inline-command-report" className="p-8"><div className="head"><div><div className="brand">ALPHA COY · TRAINING COMMAND</div><div className="sub">BSF TRAINING CENTRE MANAGEMENT SYSTEM</div></div><div className="meta">OFFICIAL STATEMENT<br/>Date: {date}<br/>Time: {time}</div></div><div className="title">{config.emoji} {config.title}</div><div className="sub">{config.subtitle}</div><div className="rule"/><div className="notice"><b>Statement:</b> Active Batch · Live itemized records · Official use</div>
        {stats.length > 0 && <div className="grid">{stats.slice(0, 8).map(s => <div className="card" key={s.label}><div className="label">{s.label}</div><div className="value">{s.value}</div></div>)}</div>}
        <table className="table"><thead><tr><th>Item / Transaction</th><th>Quantity</th><th>Rate</th><th>Amount</th><th>Status / Details</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={5}>No records available for the selected batch.</td></tr> : rows.map((r, i) => <tr key={`${r.item}-${i}`}><td><b>{r.item}</b>{r.detail ? <div>{r.detail}</div> : null}</td><td>{r.quantity ?? '—'}</td><td>{typeof r.unitPrice === 'number' ? money(r.unitPrice) : (r.unitPrice ?? '—')}</td><td>{typeof r.amount === 'number' ? money(r.amount) : (r.amount ?? '—')}</td><td>{r.status ?? 'Recorded'}</td></tr>)}</tbody></table><div className="footer"><span>ALPHA COY · CONFIDENTIAL OFFICIAL USE</span><span>Signature / QM / Clerk / Commander</span></div></div>
      <div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-xs font-bold">Close</button><button onClick={print} className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-xs font-black text-white"><Printer size={14}/> Print / Save as PDF</button></div></div></div>}
  </>;
};
