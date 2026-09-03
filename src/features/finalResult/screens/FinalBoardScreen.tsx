// ═══════════════════════════════════════════════════════════
// FINAL BOARD SCREEN (Antim Board Parinaam)
// Auto-aggregate + Merit list + Certificate
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, Loader2, RefreshCw, Download, Award, Search,
} from 'lucide-react';
import { exportMeritList } from '../../../services/export.service';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  calculateFinalResult, saveFinalResult, getFinalResultsByBatch, deleteFinalResult,
} from '../api/finalResult.api';
import { type FinalResult, type FinalRecommendation, RECOMMENDATION_CONFIG } from '../types/finalResult.types';

export const FinalBoardScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [results, setResults] = useState<FinalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [trainees, setTrainees] = useState<any[]>([]);

  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getFinalResultsByBatch(activeBatch.id).then(setResults).finally(() => setLoading(false));

    import('firebase/firestore').then(({ getDocs, collection: col, query: q, where: w }) => {
      import('../../../config/firebase').then(({ db }) => {
        getDocs(q(col(db, 'trainees'), w('batchId', '==', activeBatch.id))).then(snap => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          setTrainees(list);
        });
      });
    });
  }, [activeBatch]);

  const handleCalculateAll = async () => {
    if (!activeBatch) return;
    setCalculating(true);
    try {
      const newResults: FinalResult[] = [];
      let position = 1;

      for (const t of trainees) {
        const calc = await calculateFinalResult(t.id, activeBatch.id);
        const result: Omit<FinalResult, 'id' | 'createdAt'> = {
          traineeId: t.id,
          traineeName: t.name || '',
          chestNo: t.chestNo || '',
          regNo: t.regNo || '',
          platoon: t.platoon || '',
          batchId: activeBatch.id,
          position: 0,
          ...calc,
          passedOutDate: '', certificateNo: '', boardMembers: [], remarks: '',
        } as any;
        newResults.push(result as any);
      }

      // Sort by percentage descending
      newResults.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
      newResults.forEach((r, i) => { (r as any).position = i + 1; });

      // Save all
      for (const r of newResults) {
        await saveFinalResult(r as any);
      }

      setResults(await getFinalResultsByBatch(activeBatch.id));
      setMessage(`✅ Final results calculated for ${trainees.length} trainees!`);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setCalculating(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const filtered = useMemo(() => {
    if (!search) return results;
    const s = search.toLowerCase();
    return results.filter(r => r.traineeName.toLowerCase().includes(s) || r.chestNo.toLowerCase().includes(s));
  }, [results, search]);

  const stats = useMemo(() => ({
    total: results.length,
    fit: results.filter(r => r.recommendation === 'Fit for Duty').length,
    unfit: results.filter(r => r.recommendation === 'Unfit').length,
    conditional: results.filter(r => r.recommendation === 'Conditional').length,
    avgPercentage: results.length > 0 ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length) : 0,
  }), [results]);

  if (!activeBatch) return (
    <div className="p-8 text-center"><Trophy size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-yellow-900 to-amber-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">🏆 Antim Board Parinaam</h1>
          <p className="text-[10px] text-yellow-200">Final Board Result — Merit List & Certificate</p>
        </div>
        <button onClick={handleCalculateAll} disabled={calculating}
          className="bg-white text-amber-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-amber-50 disabled:opacity-50">
          {calculating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Calculate All
        </button>
        <button onClick={() => exportMeritList(results)} className="bg-white text-amber-600 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-amber-50 border border-amber-200">
          📥 Export Merit List
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: '📋', color: 'bg-slate-50 border-slate-300 text-slate-800' },
          { label: 'Fit for Duty', value: stats.fit, icon: '✅', color: 'bg-green-50 border-green-300 text-green-800' },
          { label: 'Unfit', value: stats.unfit, icon: '❌', color: 'bg-red-50 border-red-300 text-red-800' },
          { label: 'Conditional', value: stats.conditional, icon: '⚠️', color: 'bg-amber-50 border-amber-300 text-amber-800' },
          { label: 'Avg %', value: `${stats.avgPercentage}%`, icon: '📊', color: 'bg-blue-50 border-blue-300 text-blue-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border-2 p-3 text-center ${card.color}`}>
            <p className="text-xl mb-1">{card.icon}</p>
            <p className="text-2xl font-black">{card.value}</p>
            <p className="text-[8px] font-bold uppercase opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>

      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-amber-600 mx-auto" /></div>
      : results.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><Trophy size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Click "Calculate All" to generate results</p></div>
      : <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amber-50 sticky top-0">
              <tr>
                {['#', 'Chest', 'Name', 'Platoon', 'Obtained', '%', 'Grade', 'FPT', 'Firing', 'Attn%', 'Recommendation'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-black text-amber-800 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => {
                const rec = RECOMMENDATION_CONFIG[r.recommendation] || RECOMMENDATION_CONFIG['Fit for Duty'];
                return (
                  <tr key={r.id} className={`hover:bg-slate-50 ${r.position <= 3 ? 'bg-yellow-50/50' : ''}`}>
                    <td className="px-3 py-2 font-black text-amber-700">{r.position <= 3 ? ['🥇', '🥈', '🥉'][r.position - 1] : r.position}</td>
                    <td className="px-3 py-2 font-mono text-xs font-bold">{r.chestNo}</td>
                    <td className="px-3 py-2 text-xs font-bold">{r.traineeName}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.platoon}</td>
                    <td className="px-3 py-2 text-xs font-black">{r.obtainedMarks}/{r.totalMarks}</td>
                    <td className="px-3 py-2 text-xs font-black">{r.percentage}%</td>
                    <td className="px-3 py-2"><span className="text-xs font-black px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800">{r.overallGrade}</span></td>
                    <td className="px-3 py-2 text-xs">{r.fptResult}</td>
                    <td className="px-3 py-2 text-xs">{r.firingClassification}</td>
                    <td className="px-3 py-2 text-xs">{r.attendancePercentage}%</td>
                    <td className="px-3 py-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${rec.bg} ${rec.color}`}>{rec.icon} {r.recommendation}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
    </div>
  );
};
