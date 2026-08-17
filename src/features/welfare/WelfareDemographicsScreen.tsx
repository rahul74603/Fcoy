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

import React, { useMemo } from 'react';
import {
  HeartHandshake, Printer,
  Download, Layers, Loader2, AlertCircle, ShieldCheck, Users,
  MapPin, Languages, Sparkles, Info, ListFilter, TrendingUp,
} from 'lucide-react';

import { useWelfareData } from './hooks/useWelfareData';
import WelfareExplorer from './components/WelfareExplorer';

import { downloadCSV, printWelfareReport } from './utils/demographics';

export const WelfareDemographicsScreen: React.FC = () => {
  const welfare = useWelfareData();
  const {
    filteredStats, summary, festivalPlans,
    loading, error, filters, activeDimensions, activeFilterCount,
    allBatches, activeBatch,
  } = welfare;

  // ── Scope label (har report/print me jaata hai) ──
  const scopeLabel = useMemo(() => {
    const b = filters.batchId === 'ALL'
      ? 'All Batches'
      : (allBatches.find((x: any) => x.id === filters.batchId)?.batchNumber ?? 'Batch');
    const f = activeFilterCount > 0 ? ` · ${activeFilterCount} filter applied` : '';
    return `${b}${f} · ${summary.filteredTrainees} trainees`;
  }, [filters.batchId, allBatches, activeFilterCount, summary.filteredTrainees]);

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
    <div className="space-y-3 pb-6">

      {/* ══════════ HEADER ══════════ */}
      <div className="bg-military-900 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-rose-600 p-2">
            <HeartHandshake size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">
              Welfare & Demographics Cell
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

      {/* ══════════ EXPLORER — control bar + Demographics / Festival / Roster tabs
          (shared with CC Dashboard Company Information Board) ══════════ */}
      <WelfareExplorer w={welfare} />
    </div>
  );
};

export default WelfareDemographicsScreen;
