// ═══════════════════════════════════════════════════════════
// MISMATCH DASHBOARD SCREEN (Bemel Dashboard)
// Auto-detects missing/inconsistent data
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle, Search, Loader2, RefreshCw, Filter,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBatch } from '../../../contexts/BatchContext';
import { scanForMismatch, type MismatchIssue, type MismatchSeverity } from '../engine/mismatchEngine';

export const MismatchDashboardScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const navigate = useNavigate();

  const [issues, setIssues] = useState<MismatchIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<MismatchSeverity | 'All'>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const runScan = async () => {
    if (!activeBatch) return;
    setLoading(true);
    try {
      const result = await scanForMismatch(activeBatch.id);
      setIssues(result);
    } catch (err) {
      console.error('Scan failed:', err);
    }
    setLoading(false);
  };

  useEffect(() => { runScan(); }, [activeBatch]);

  const categories = useMemo(() => [...new Set(issues.map(i => i.category))], [issues]);

  const filtered = useMemo(() => {
    return issues.filter(i => {
      if (filterSeverity !== 'All' && i.severity !== filterSeverity) return false;
      if (filterCategory !== 'All' && i.category !== filterCategory) return false;
      if (search) {
        const s = search.toLowerCase();
        return i.traineeName.toLowerCase().includes(s) || i.chestNo.toLowerCase().includes(s) || i.issue.toLowerCase().includes(s);
      }
      return true;
    });
  }, [issues, filterSeverity, filterCategory, search]);

  const stats = useMemo(() => ({
    total: issues.length,
    critical: issues.filter(i => i.severity === 'Critical').length,
    high: issues.filter(i => i.severity === 'High').length,
    medium: issues.filter(i => i.severity === 'Medium').length,
    low: issues.filter(i => i.severity === 'Low').length,
  }), [issues]);

  const severityConfig: Record<MismatchSeverity, { color: string; bg: string; icon: string }> = {
    Critical: { color: 'text-red-800', bg: 'bg-red-100 border-red-300', icon: '🔴' },
    High: { color: 'text-orange-800', bg: 'bg-orange-100 border-orange-300', icon: '🟠' },
    Medium: { color: 'text-yellow-800', bg: 'bg-yellow-100 border-yellow-300', icon: '🟡' },
    Low: { color: 'text-blue-800', bg: 'bg-blue-100 border-blue-300', icon: '🔵' },
  };

  if (!activeBatch) return (
    <div className="p-8 text-center"><AlertTriangle size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-orange-900 to-red-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">🔍 Bemel Dashboard</h1>
          <p className="text-[10px] text-orange-200">Data Mismatch & Missing Records — Auto Scan</p>
        </div>
        <button onClick={runScan} disabled={loading} className="bg-white text-red-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-red-50 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Re-Scan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Issues', value: stats.total, icon: '📋', color: 'bg-slate-50 border-slate-300 text-slate-800' },
          { label: 'Critical', value: stats.critical, icon: '🔴', color: 'bg-red-50 border-red-300 text-red-800' },
          { label: 'High', value: stats.high, icon: '🟠', color: 'bg-orange-50 border-orange-300 text-orange-800' },
          { label: 'Medium', value: stats.medium, icon: '🟡', color: 'bg-yellow-50 border-yellow-300 text-yellow-800' },
          { label: 'Low', value: stats.low, icon: '🔵', color: 'bg-blue-50 border-blue-300 text-blue-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border-2 p-3 text-center ${card.color}`}>
            <p className="text-xl mb-1">{card.icon}</p>
            <p className="text-2xl font-black">{card.value}</p>
            <p className="text-[8px] font-bold uppercase opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Severity</option>
          {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Issues List */}
      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-orange-600 mx-auto" /><p className="text-xs text-slate-500 mt-2">Scanning all records...</p></div>
      : filtered.length === 0 ? <div className="bg-green-50 border border-green-200 p-8 text-center rounded-xl"><p className="text-lg font-black text-green-700">✅ Koi issue nahi!</p><p className="text-xs text-green-600 mt-1">Sab records sahi hain</p></div>
      : <div className="space-y-2">
          {filtered.map(issue => {
            const config = severityConfig[issue.severity];
            return (
              <div key={issue.id} className={`rounded-xl border ${config.bg} px-4 py-3 flex items-center justify-between gap-3`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl">{config.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-800">
                      {issue.traineeName !== 'SYSTEM' ? `${issue.traineeName} (${issue.chestNo})` : '⚠️ SYSTEM ISSUE'}
                    </p>
                    <p className={`text-[10px] font-bold ${config.color}`}>{issue.issue}</p>
                    <p className="text-[9px] text-slate-500">💡 {issue.suggestion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${config.bg} ${config.color}`}>{issue.severity}</span>
                  <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">{issue.category}</span>
                </div>
              </div>
            );
          })}
        </div>}
    </div>
  );
};
