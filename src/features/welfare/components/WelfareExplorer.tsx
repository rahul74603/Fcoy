// src/features/welfare/components/WelfareExplorer.tsx
// ═══════════════════════════════════════════════════════════
// 🔍 WELFARE EXPLORER — shared interactive demographics panel
//
// Ye WelfareDemographicsScreen ka core panel hai (control bar +
// Demographics / Festival Planner / Trainee List tabs), ab ek
// SHARED component ke roop me — do jagah use hota hai:
//   1. /welfare-demographics (Welfare Cell screen)
//   2. CC Dashboard → Company Information Board
//
// State (filters/batch/search) parent ke useWelfareData() se aata
// hai — is component me sirf UI + tab state hai. Functionality
// dono jagah EXACT same rehti hai.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  Search, X, Filter, Plus, RefreshCw, Layers, Users,
  Compass, LayoutGrid, CalendarHeart,
} from 'lucide-react';

import type { useWelfareData } from '../hooks/useWelfareData';
import DimensionCard from './DimensionCard';
import FestivalPlanner from './FestivalPlanner';
import TraineeResultTable from './TraineeResultTable';

import { DIM_MAP, OPTIONAL_DIMENSIONS, PINNED_DIMENSIONS } from '../utils/demographics';
import type { DimensionKey } from '../types/welfare.types';

type TabKey = 'overview' | 'festivals' | 'roster';

export type WelfareData = ReturnType<typeof useWelfareData>;

interface WelfareExplorerProps {
  w: WelfareData;
}

export const WelfareExplorer: React.FC<WelfareExplorerProps> = ({ w }) => {
  const {
    filtered, facetStats, summary, festivalPlans,
    filters, activeDimensions, activeFilterCount,
    allBatches,
    toggleValue, clearDimension, clearAllFilters,
    setBatch, setSearch, addDimension, removeDimension,
  } = w;

  const [tab, setTab] = useState<TabKey>('overview');
  const [showAddDim, setShowAddDim] = useState(false);

  // ── Scope label (reports/prints me jaata hai) ──
  const scopeLabel = useMemo(() => {
    const b = filters.batchId === 'ALL'
      ? 'All Batches'
      : (allBatches.find((x: any) => x.id === filters.batchId)?.batchNumber ?? 'Batch');
    const f = activeFilterCount > 0 ? ` · ${activeFilterCount} filter applied` : '';
    return `${b}${f} · ${summary.filteredTrainees} trainees`;
  }, [filters.batchId, allBatches, activeFilterCount, summary.filteredTrainees]);

  // ── Active filter chips ──
  const chips = useMemo(() => {
    const out: { dim: DimensionKey; value: string }[] = [];
    (Object.entries(filters.selections) as [DimensionKey, string[]][])
      .forEach(([dim, vals]) => (vals ?? []).forEach(v => out.push({ dim, value: v })));
    return out;
  }, [filters.selections]);

  const inactiveDims = OPTIONAL_DIMENSIONS.filter(d => !activeDimensions.includes(d.key));

  return (
    <div className="space-y-3">

      {/* ══════════ CONTROL BAR ══════════ */}
      <div className="bg-white border border-slate-300 shadow-flat px-3 py-2.5 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Batch */}
          <div className="flex items-center gap-1.5">
            <Layers size={12} className="text-slate-400" />
            <select
              value={filters.batchId}
              onChange={e => setBatch(e.target.value)}
              className="text-[10.5px] font-bold border border-slate-300 px-2 py-1.5 focus:outline-none focus:border-military-600 bg-white"
            >
              <option value="ALL">All Batches ({summary.totalTrainees})</option>
              {allBatches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.batchNumber} — {b.batchName}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Naam, Chest No, Reg No, District, Village se search..."
              className="w-full text-[10.5px] pl-8 pr-8 py-1.5 border border-slate-300 focus:outline-none focus:border-military-600"
            />
            {filters.search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Add filter dimension */}
          <div className="relative">
            <button
              onClick={() => setShowAddDim(s => !s)}
              disabled={inactiveDims.length === 0}
              className="bg-military-800 text-white px-2.5 py-1.5 text-[9.5px] font-black uppercase hover:bg-military-900 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Plus size={11} /> Add Filter
              {inactiveDims.length > 0 && (
                <span className="bg-military-600 px-1 rounded-full text-[8px]">
                  {inactiveDims.length}
                </span>
              )}
            </button>

            {showAddDim && inactiveDims.length > 0 && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowAddDim(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-300 shadow-lg w-64 max-h-80 overflow-y-auto custom-scrollbar">
                  <p className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    Aur filter jodein
                  </p>
                  {inactiveDims.map(d => (
                    <button
                      key={d.key}
                      onClick={() => { addDimension(d.key); setShowAddDim(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-military-50 border-b border-slate-100"
                    >
                      <p className="text-[10.5px] font-bold text-slate-800">
                        {d.label} <span className="text-slate-400 font-normal">/ {d.hindiLabel}</span>
                      </p>
                      <p className="text-[8.5px] text-slate-500 mt-0.5">{d.hint}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Clear */}
          {(activeFilterCount > 0 || filters.search) && (
            <button
              onClick={clearAllFilters}
              className="bg-red-50 text-red-700 border border-red-300 px-2.5 py-1.5 text-[9.5px] font-black uppercase hover:bg-red-100 flex items-center gap-1.5"
            >
              <RefreshCw size={11} /> Reset ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Active chips */}
        {chips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
              <Filter size={9} /> Active:
            </span>
            {chips.map(c => (
              <button
                key={`${c.dim}-${c.value}`}
                onClick={() => toggleValue(c.dim, c.value)}
                className="text-[9.5px] font-bold bg-military-800 text-white px-2 py-0.5 hover:bg-red-600 flex items-center gap-1 group"
                title="Hatane ke liye click karein"
              >
                <span className="opacity-60">{DIM_MAP[c.dim].label}:</span>
                {c.value}
                <X size={9} className="opacity-60 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══════════ TABS ══════════ */}
      <div className="flex items-center gap-1 border-b-2 border-military-800">
        {([
          { key: 'overview',  label: 'Demographics',      hindi: 'जनसांख्यिकी',  icon: LayoutGrid,    badge: activeDimensions.length },
          { key: 'festivals', label: 'Festival Planner',  hindi: 'त्योहार योजना', icon: CalendarHeart, badge: festivalPlans.filter(p => p.daysAway <= 90 && p.eligibleCount > 0).length },
          { key: 'roster',    label: 'Trainee List',      hindi: 'सूची',          icon: Users,         badge: summary.filteredTrainees },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-[10.5px] font-black uppercase flex items-center gap-1.5 transition-colors ${
              tab === t.key
                ? 'bg-military-800 text-white'
                : 'bg-white text-slate-500 hover:text-military-800 hover:bg-slate-50 border border-b-0 border-slate-300'
            }`}
          >
            <t.icon size={12} />
            <span>{t.label}</span>
            <span className="text-[8px] font-normal opacity-70 hidden md:inline">{t.hindi}</span>
            <span className={`text-[8.5px] font-black px-1.5 rounded-full ${
              tab === t.key ? 'bg-white text-military-900' : 'bg-slate-200 text-slate-600'
            }`}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* ══════════ TAB: DEMOGRAPHICS ══════════ */}
      {tab === 'overview' && (
        <div className="space-y-3">
          {/* Pinned section */}
          <div>
            <p className="text-[9.5px] font-black text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
              <Compass size={11} /> Permanent Breakdown — hamesha dikhega
              <span className="text-slate-400 font-normal normal-case">
                (State · Religion · Language · Zone)
              </span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {PINNED_DIMENSIONS.map(d => facetStats[d] && (
                <DimensionCard
                  key={d}
                  stat={facetStats[d]}
                  selected={filters.selections[d] ?? []}
                  onToggle={toggleValue}
                  onClear={clearDimension}
                  previewCount={d === 'zone' ? 8 : 6}
                />
              ))}
            </div>
          </div>

          {/* Optional section */}
          {activeDimensions.some(d => !PINNED_DIMENSIONS.includes(d)) && (
            <div>
              <p className="text-[9.5px] font-black text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                <Filter size={11} /> Additional Filters — aap ne jode
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
                {activeDimensions
                  .filter(d => !PINNED_DIMENSIONS.includes(d))
                  .map(d => facetStats[d] && (
                    <DimensionCard
                      key={d}
                      stat={facetStats[d]}
                      selected={filters.selections[d] ?? []}
                      onToggle={toggleValue}
                      onClear={clearDimension}
                      onRemove={removeDimension}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Empty-add hint */}
          {inactiveDims.length > 0 && (
            <div className="bg-slate-50 border border-dashed border-slate-300 px-4 py-3 text-center">
              <p className="text-[10px] text-slate-500">
                Aur {inactiveDims.length} filter available hain —{' '}
                <b className="text-military-800">District, Category, Blood Group, Age Band</b> waghairah.
                Upar <b>"Add Filter"</b> button se jodein.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: FESTIVALS ══════════ */}
      {tab === 'festivals' && (
        <FestivalPlanner plans={festivalPlans} scopeLabel={scopeLabel} />
      )}

      {/* ══════════ TAB: ROSTER ══════════ */}
      {tab === 'roster' && (
        <TraineeResultTable trainees={filtered} scopeLabel={scopeLabel} />
      )}
    </div>
  );
};

export default WelfareExplorer;
