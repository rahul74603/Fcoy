// ═══════════════════════════════════════════════════════════
// WELFARE SUMMARY WIDGET — embedded in CC Dashboard
// ───────────────────────────────────────────────────────────
// Compact version of WelfareDemographicsScreen showing key
// demographics + upcoming festivals directly on the dashboard.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartHandshake, Users, MapPin, Languages, Sparkles,
  TrendingUp, CalendarHeart, ChevronDown, ChevronUp,
  ArrowRight, AlertCircle, Info, ShieldCheck,
} from 'lucide-react';
import { useWelfareData } from '../welfare/hooks/useWelfareData';

export const WelfareSummaryWidget: React.FC = () => {
  const navigate = useNavigate();
  const {
    filtered, facetStats, summary, festivalPlans,
    loading, error, filters, activeDimensions,
    allBatches, activeBatch, canViewAllBatches,
    toggleValue, clearDimension, clearAllFilters,
    setBatch, setSearch,
  } = useWelfareData();

  const [expanded, setExpanded] = useState(false);
  const [showFestivals, setShowFestivals] = useState(false);

  // Upcoming festivals (next 90 days)
  const upcomingFestivals = useMemo(
    () => festivalPlans.filter(p => p.daysAway <= 90 && p.eligibleCount > 0).slice(0, 5),
    [festivalPlans],
  );

  // Top states
  const topStates = useMemo(() => {
    const stateStat = facetStats['state'];
    if (!stateStat) return [];
    return stateStat.buckets.slice(0, 6);
  }, [facetStats]);

  // Top religions
  const topReligions = useMemo(() => {
    const relStat = facetStats['religion'];
    if (!relStat) return [];
    return relStat.buckets.slice(0, 5);
  }, [facetStats]);

  // Top languages
  const topLanguages = useMemo(() => {
    const langStat = facetStats['language'];
    if (!langStat) return [];
    return langStat.buckets.slice(0, 5);
  }, [facetStats]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <HeartHandshake size={16} className="text-rose-500 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-500">Loading welfare data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[11px] text-red-700 flex items-center gap-2">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden border-l-4 border-l-rose-500">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
            <HeartHandshake size={16} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
              Welfare & Demographics
            </p>
            <p className="text-[9px] text-slate-500">
              कल्याण एवं जनसांख्यिकी — त्योहार आधारित विशेष सुविधा योजना
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/welfare-demographics')}
            className="text-[10px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1">
            Full Page <ArrowRight size={10} />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 rounded-lg bg-white border border-rose-200 flex items-center justify-center hover:bg-rose-50">
            {expanded ? <ChevronUp size={14} className="text-rose-600" /> : <ChevronDown size={14} className="text-rose-600" />}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 border-b border-slate-100">
        {[
          { label: 'Total Strength', value: summary.totalTrainees, icon: Users, color: 'text-slate-800' },
          { label: 'In View', value: summary.filteredTrainees, icon: Users, color: 'text-blue-700' },
          { label: 'States', value: summary.statesCovered, icon: MapPin, color: 'text-sky-700' },
          { label: 'Religions', value: summary.religionsCovered, icon: Sparkles, color: 'text-orange-700' },
          { label: 'Languages', value: summary.languagesCovered, icon: Languages, color: 'text-violet-700' },
          { label: 'Data Complete', value: `${summary.dataCompleteness}%`, icon: TrendingUp,
            color: summary.dataCompleteness >= 80 ? 'text-emerald-700' : 'text-amber-700' },
        ].map(k => (
          <div key={k.label} className="px-3 py-2.5 text-center border-r border-slate-100 last:border-0">
            <p className="text-[8px] font-bold text-slate-400 uppercase flex items-center justify-center gap-1">
              <k.icon size={8} /> {k.label}
            </p>
            <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Data quality warning */}
      {summary.incompleteRecords > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-[10px] text-amber-800">
          <AlertCircle size={12} className="text-amber-600 flex-shrink-0" />
          <span><b>{summary.incompleteRecords}</b> records me State/Religion missing hai — welfare planning incomplete.</span>
        </div>
      )}

      {/* Quick demographics + festivals */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top States */}
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1">
              <MapPin size={9} /> Top States
            </p>
            <div className="space-y-1">
              {topStates.map(b => (
                <div key={b.value} className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-700 truncate max-w-[120px]">{b.value}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min(b.percent, 100)}%` }} />
                    </div>
                    <span className="font-mono font-black text-slate-600 w-8 text-right">{b.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Religions */}
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1">
              <Sparkles size={9} /> Top Religions
            </p>
            <div className="space-y-1">
              {topReligions.map(b => (
                <div key={b.value} className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-700 truncate max-w-[120px]">{b.value}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(b.percent, 100)}%` }} />
                    </div>
                    <span className="font-mono font-black text-slate-600 w-8 text-right">{b.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Festivals */}
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1">
              <CalendarHeart size={9} /> Upcoming Festivals (90 days)
            </p>
            {upcomingFestivals.length === 0 ? (
              <p className="text-[10px] text-slate-400">No upcoming festivals</p>
            ) : (
              <div className="space-y-1">
                {upcomingFestivals.map(p => (
                  <div key={p.festival.name} className="flex items-center justify-between text-[10px] bg-rose-50 rounded-lg px-2 py-1.5 border border-rose-100">
                    <div>
                      <span className="font-bold text-slate-800">{p.festival.name}</span>
                      <span className="text-[8px] text-slate-500 ml-1">
                        {new Date(`${p.festival.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-rose-700">{p.eligibleCount} trainees</span>
                      <span className="text-[8px] text-slate-500 ml-1">₹{p.estimatedBudget.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: Language breakdown + purpose banner */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-4 space-y-3">
          {/* Languages */}
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1">
              <Languages size={9} /> Top Languages
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
              {topLanguages.map(b => (
                <div key={b.value} className="flex items-center justify-between text-[10px] bg-violet-50 rounded-lg px-2 py-1.5 border border-violet-100">
                  <span className="font-bold text-slate-700 truncate">{b.value}</span>
                  <span className="font-mono font-black text-violet-700">{b.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Purpose banner */}
          <div className="bg-emerald-50 border-l-4 border-emerald-600 px-3 py-2 flex items-start gap-2 text-[9px] text-emerald-900">
            <ShieldCheck size={12} className="text-emerald-700 flex-shrink-0 mt-0.5" />
            <div>
              <b>Uddeshya:</b> Ye data keval kalyan niyojan ke liye hai — har jawan ko uske apne tyohaar par
              sahi suvidha dene ke liye. Kisi bhi bhedbhav ke liye varjit hai.
              <span className="block mt-0.5 text-emerald-700">
                <Info size={8} className="inline mr-1" />
                Saara data Trainee Registration Form se hi aata hai.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[9px] text-slate-400">
          {activeBatch ? `Batch: ${activeBatch.batchNumber}` : 'All Batches'} · {summary.filteredTrainees} trainees
        </p>
        <button onClick={() => navigate('/welfare-demographics')}
          className="text-[9px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1">
          Open Full Welfare Page <ArrowRight size={9} />
        </button>
      </div>
    </div>
  );
};

export default WelfareSummaryWidget;
