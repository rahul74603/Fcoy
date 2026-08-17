// src/features/dashboard/CommanderInformationBoard.tsx
// ═══════════════════════════════════════════════════════════
// 🏢 COMPANY INFORMATION BOARD — CC Dashboard
//
// Welfare & Demographics wala PURA interactive panel ab yahin:
//   • State / Religion / Language / Zone permanent breakdown
//   • Search + batch selector + "Add Filter" (District, Category,
//     Blood Group, Age Band...)
//   • Demographics / Festival Planner / Trainee List tabs
//
// Ye WelfareExplorer (shared component) use karta hai — exact
// wahi functionality jo /welfare-demographics screen par hai.
//
// ⚠️ NOTE: Pehle yahan ek auto-cleanup tha jo har dashboard load
// par bina-batchId wale trainees ko DELETE kar deta tha — wo
// destructive behavior hata diya gaya hai (data kabhi bhi
// silently delete nahi hona chahiye).
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Users, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWelfareData } from '../welfare/hooks/useWelfareData';
import WelfareExplorer from '../welfare/components/WelfareExplorer';

export const CommanderInformationBoard: React.FC = () => {
  const welfare = useWelfareData();
  const { loading, error, summary, activeFilterCount, clearAllFilters } = welfare;
  const navigate = useNavigate();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-military-700">
            <Users size={14} /> Company Information Board
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            State · Religion · Language · Zone breakdown — filters se exact matching trainees dekhein.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-military-50 px-3 py-1 text-[10px] font-black text-military-700">
            {summary.filteredTrainees} shown
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="rounded-lg bg-red-50 px-3 py-1.5 text-[10px] font-black text-red-700"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => navigate('/welfare-demographics')}
            title="Full Welfare Cell screen kholo (Print/Export ke saath)"
            className="flex items-center gap-1 rounded-lg bg-military-800 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-military-900"
          >
            <ExternalLink size={11} /> Welfare Cell
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-slate-50 p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 size={24} className="mb-2 animate-spin text-military-700" />
            <p className="text-[10px] font-black uppercase tracking-wider text-military-800">
              Trainee data load ho raha hai...
            </p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-2 text-[11px] font-bold text-red-700">
            <AlertCircle size={13} /> {error}
          </div>
        ) : (
          <WelfareExplorer w={welfare} />
        )}
      </div>
    </section>
  );
};
