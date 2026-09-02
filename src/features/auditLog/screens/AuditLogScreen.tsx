// ═══════════════════════════════════════════════════════════
// AUDIT LOG SCREEN (Lekha-Jokha Register)
// CC only — who changed what, when
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Search, Loader2, RefreshCw, Filter, Download,
} from 'lucide-react';
import { getAuditLogs, type AuditLogEntry } from '../../../services/auditLog.service';

export const AuditLogScreen: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('All');

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getAuditLogs(undefined, 500);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterAction !== 'All' && l.action !== filterAction) return false;
      if (search) {
        const s = search.toLowerCase();
        return l.userName.toLowerCase().includes(s) || l.description.toLowerCase().includes(s) || l.collection.toLowerCase().includes(s);
      }
      return true;
    });
  }, [logs, filterAction, search]);

  const stats = useMemo(() => ({
    total: logs.length,
    creates: logs.filter(l => l.action === 'Create').length,
    updates: logs.filter(l => l.action === 'Update').length,
    deletes: logs.filter(l => l.action === 'Delete').length,
    logins: logs.filter(l => l.action === 'Login').length,
  }), [logs]);

  const actionColors: Record<string, string> = {
    Create: 'bg-green-100 text-green-800',
    Update: 'bg-blue-100 text-blue-800',
    Delete: 'bg-red-100 text-red-800',
    Login: 'bg-purple-100 text-purple-800',
    Export: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">📝 Lekha-Jokha Register</h1>
          <p className="text-[10px] text-slate-300">Audit Log — Who changed what, when</p>
        </div>
        <button onClick={fetchLogs} disabled={loading} className="bg-white text-slate-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-50 border-slate-300 text-slate-800' },
          { label: 'Creates', value: stats.creates, color: 'bg-green-50 border-green-300 text-green-800' },
          { label: 'Updates', value: stats.updates, color: 'bg-blue-50 border-blue-300 text-blue-800' },
          { label: 'Deletes', value: stats.deletes, color: 'bg-red-50 border-red-300 text-red-800' },
          { label: 'Logins', value: stats.logins, color: 'bg-purple-50 border-purple-300 text-purple-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border-2 p-3 text-center ${card.color}`}>
            <p className="text-2xl font-black">{card.value}</p>
            <p className="text-[8px] font-bold uppercase opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Actions</option>
          {['Create', 'Update', 'Delete', 'Login', 'Export'].map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-slate-600 mx-auto" /></div>
      : filtered.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><FileText size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi audit log nahi</p></div>
      : <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {['Time', 'User', 'Role', 'Action', 'Collection', 'Description'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((l, i) => (
                <tr key={l.id || i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-[10px] font-mono text-slate-500 whitespace-nowrap">{l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN') : '—'}</td>
                  <td className="px-3 py-2 text-[10px] font-bold text-slate-800">{l.userName}</td>
                  <td className="px-3 py-2 text-[10px] text-slate-500">{l.userRole}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${actionColors[l.action] || 'bg-slate-100 text-slate-600'}`}>{l.action}</span></td>
                  <td className="px-3 py-2 text-[10px] font-mono text-slate-600">{l.collection}</td>
                  <td className="px-3 py-2 text-[10px] text-slate-700 max-w-[300px] truncate">{l.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
};
