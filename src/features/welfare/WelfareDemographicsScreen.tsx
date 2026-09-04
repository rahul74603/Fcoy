// ═══════════════════════════════════════════════════════════
// WELFARE & DEMOGRAPHICS INTELLIGENCE SCREEN
// ───────────────────────────────────────────────────────────
// KYA KARTA HAI:
//   Trainees ki registration form wali details par
//   State-wise / Religion-wise / Language-wise counts +
//   filters + festival welfare planner.
//
// KYUN:
//   Taaki har trainee ko uske apne tyohaar par sahi welfare
//   (ration, mithai, puja saamagri, chhutti, mess menu) mile.
//
// DATA SOURCE:
//   Sirf `trainees` collection — wahi fields jo Clerk ne
//   registration ke waqt bhare the. Koi nayi jaankari nahi.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  HeartHandshake, Search, X, Filter, Plus, RefreshCw, Printer,
  Download, Layers, Loader2, AlertCircle, ShieldCheck, Users,
  MapPin, Languages, Compass, Sparkles, Info, LayoutGrid,
  CalendarHeart, ListFilter, TrendingUp,
} from 'lucide-react';

import { useWelfareData } from './hooks/useWelfareData';
import DimensionCard from './components/DimensionCard';
import FestivalPlanner from './components/FestivalPlanner';
import TraineeResultTable from './components/TraineeResultTable';

import { DIM_MAP, OPTIONAL_DIMENSIONS, PINNED_DIMENSIONS, downloadCSV, printWelfareReport }
  from './utils/demographics';
import type { DimensionKey } from './types/welfare.types';

type TabKey = 'overview' | 'festivals' | 'roster';

interface WelfareScreenProps {
  /** true = CC dashboard ke andar card ke roop me (apna page header/padding nahi) */
  embedded?: boolean;
}

export const WelfareDemographicsScreen: React.FC<WelfareScreenProps> = ({ embedded = false }) => {
  const {
    filtered, facetStats, filteredStats, summary, festivalPlans,
    loading, error, filters, activeDimensions, activeFilterCount,
    allBatches, activeBatch, canViewAllBatches,
    toggleValue, clearDimension, clearAllFilters,
    setBatch, setSearch, addDimension, removeDimension,
  } = useWelfareData();

  const [tab, setTab] = useState<TabKey>('overview');
  const [showAddDim, setShowAddDim] = useState(false);

  // ── Scope label (har report/print me jaata hai) ──
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

  // ── Export: saare active dimensions ka summary ──
  const exportSummary = () => {
    const headers = ['Dimension', 'Value', 'Count', '% of Recorded'];
    const rows: (string | number)[][] = [];
    activeDimensions.forEach(d => {
      const s = filteredStats[d];
      if (!s) return;
      s.buckets.forEach(b => rows.push([s.label, b.value, b.count, `${b.percent}%`]));
    });
    downloadCSV('Welfare_Demographics_Summary', headers, rows);
  };

  // ── Print: formal A4 report ──
  const printSummary = () => {
    const sections = activeDimensions
      .map(d => filteredStats[d])
      .filter(Boolean)
      .map(s => ({
        heading: `${s.label} / ${s.hindiLabel}  —  ${s.distinct} distinct, ${s.missing} blank`,
        headers: ['S.No', s.label, 'Trainees', '% of Recorded'],
        rows: s.buckets.map((b, i) => [i + 1, b.value, b.count, `${b.percent}%`]),
      }));

    const upcoming = festivalPlans.filter(p => p.daysAway <= 90 && p.eligibleCount > 0);
    if (upcoming.length) {
      sections.push({
        heading: 'Upcoming Festivals (next 90 days) — Welfare Requirement',
        headers: ['Date', 'Festival', 'Eligible Trainees', 'Est. Budget (₹)'],
        rows: upcoming.map(p => [
          new Date(`${p.festival.date}T00:00:00`).toLocaleDateString('en-IN',
            { day: '2-digit', month: 'short', year: 'numeric' }),
          p.festival.name,
          p.eligibleCount,
          p.estimatedBudget.toLocaleString('en-IN'),
        ]),
      });
    }

    printWelfareReport(
      'Welfare & Demographics Report',
      scopeLabel,
      sections,
      summary.incompleteRecords > 0
        ? `DATA NOTE: ${summary.incompleteRecords} record(s) me State/Religion darj nahi hai. ` +
          `Trainee Profile → Edit se poora karein taaki welfare planning sahi ho. ` +
          `Data completeness: ${summary.dataCompleteness}%`
        : `Data completeness: ${summary.dataCompleteness}% — sabhi core welfare fields bhare hue hain.`,
    );
  };

  const inactiveDims = OPTIONAL_DIMENSIONS.filter(d => !activeDimensions.includes(d.key));

  // ═══════════════ LOADING ═══════════════
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 size={30} className="animate-spin text-military-700 mb-3" />
        <p className="text-xs font-black text-military-800 uppercase tracking-wider">
          Trainee data load ho raha hai...
        </p>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-3 pb-6'}>

      {/* ══════════ HEADER ══════════ */}
      <div className="bg-military-900 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-rose-600 p-2">
            <HeartHandshake size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">
              {embedded ? 'Company Information Board' : 'Welfare & Demographics Cell'}
            </h1>
            <p className="text-[9.5px] text-military-300">
              कल्याण एवं जनसांख्यिकी — त्योहार आधारित विशेष सुविधा योजना
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeBatch && (
            <span className="bg-military-800 text-white text-[9.5px] font-black px-2.5 py-1 border border-military-600 flex items-center gap-1">
              <Layers size={11} /> {activeBatch.batchNumber}
            </span>
          )}
          <button
            onClick={printSummary}
            className="bg-white text-military-900 px-2.5 py-1.5 text-[9.5px] font-black uppercase hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Printer size={11} /> Print Report
          </button>
          <button
            onClick={exportSummary}
            className="bg-emerald-600 text-white px-2.5 py-1.5 text-[9.5px] font-black uppercase hover:bg-emerald-700 flex items-center gap-1.5"
          >
            <Download size={11} /> Export
          </button>
        </div>
      </div>

      {/* ══════════ PURPOSE BANNER (compliance) ══════════ */}
      <div className="bg-emerald-50 border-l-4 border-emerald-600 px-4 py-2.5 flex items-start gap-2.5">
        <ShieldCheck size={16} className="text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-emerald-900 leading-relaxed">
          <b className="uppercase">Uddeshya / Purpose:</b> Ye page keval{' '}
          <b>kalyan (welfare) niyojan</b> ke liye hai — har jawan ko uske apne
          tyohaar par mithai, ration, puja saamagri, sahi mess menu, chhutti aur
          ghar baat karne ka mauka dene ke liye.{' '}
          <b className="text-emerald-800">
            Kisi bhi prakar ke bhedbhav ke liye iska prayog varjit hai.
          </b>
          <span className="block mt-0.5 text-emerald-700">
            <Info size={9} className="inline mr-1" />
            Saara data Trainee <b>Registration Form</b> se hi aata hai — koi nayi
            personal jaankari alag se nahi maangi jaati.
          </span>
        </div>
      </div>

      {/* ══════════ ERROR ══════════ */}
      {error && (
        <div className="bg-red-50 border border-red-200 px-3 py-2 text-[11px] font-bold text-red-700 flex items-center gap-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* ══════════ KPI STRIP ══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: 'Total Strength', hindi: 'कुल',        value: summary.totalTrainees,     icon: Users,     accent: 'border-t-military-700', text: 'text-military-900' },
          { label: 'In Current View', hindi: 'फ़िल्टर बाद', value: summary.filteredTrainees, icon: ListFilter, accent: 'border-t-blue-500',     text: 'text-blue-700' },
          { label: 'States',         hindi: 'राज्य',       value: summary.statesCovered,     icon: MapPin,    accent: 'border-t-sky-500',      text: 'text-sky-700' },
          { label: 'Religions',      hindi: 'धर्म',        value: summary.religionsCovered,  icon: Sparkles,  accent: 'border-t-orange-500',   text: 'text-orange-700' },
          { label: 'Languages',      hindi: 'भाषाएँ',      value: summary.languagesCovered,  icon: Languages, accent: 'border-t-violet-500',   text: 'text-violet-700' },
          { label: 'Data Complete',  hindi: 'पूर्णता',     value: `${summary.dataCompleteness}%`, icon: TrendingUp, accent: summary.dataCompleteness >= 80 ? 'border-t-emerald-500' : 'border-t-amber-500', text: summary.dataCompleteness >= 80 ? 'text-emerald-700' : 'text-amber-700' },
        ].map(k => (
          <div key={k.label} className={`bg-white border border-slate-300 border-t-2 ${k.accent} px-3 py-2 shadow-flat`}>
            <p className="text-[8.5px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <k.icon size={9} /> {k.label}
            </p>
            <p className={`text-2xl font-black leading-tight ${k.text}`}>{k.value}</p>
            <p className="text-[8.5px] text-slate-400">{k.hindi}</p>
          </div>
        ))}
      </div>

      {/* ══════════ DATA QUALITY WARNING ══════════ */}
      {summary.incompleteRecords > 0 && (
        <div className="bg-amber-50 border border-amber-300 px-3 py-2 flex items-center gap-2 text-[10.5px] text-amber-900">
          <AlertCircle size={13} className="text-amber-600 flex-shrink-0" />
          <span>
            <b>{summary.incompleteRecords}</b> record me State ya Religion darj nahi hai —
            in trainees ko festival welfare list me nahi gina jaayega.
            Theek karne ke liye: <b>Trainee Management → Search & Profile → Edit</b>.
          </span>
        </div>
      )}

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
              {canViewAllBatches && (
                <option value="ALL">All Batches ({summary.totalTrainees})</option>
              )}
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

export default WelfareDemographicsScreen;
