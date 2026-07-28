// ═══════════════════════════════════════════════════════════
// FESTIVAL WELFARE PLANNER
// Aane wale tyohaar + kitne trainees eligible hain +
// welfare suggestion + estimated budget.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  CalendarHeart, Users, IndianRupee, ChevronRight, Clock,
  MapPin, Download, AlertCircle, Sparkles,
} from 'lucide-react';
import type { FestivalPlan, WelfareTrainee } from '../types/welfare.types';
import { downloadCSV, getDimensionValue } from '../utils/demographics';

const KIND_STYLE: Record<string, { chip: string; bar: string }> = {
  National:  { chip: 'bg-slate-800 text-white',    bar: 'bg-slate-700' },
  Religious: { chip: 'bg-orange-100 text-orange-800 border border-orange-300', bar: 'bg-orange-500' },
  Regional:  { chip: 'bg-blue-100 text-blue-800 border border-blue-300',       bar: 'bg-blue-500' },
  Harvest:   { chip: 'bg-emerald-100 text-emerald-800 border border-emerald-300', bar: 'bg-emerald-500' },
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

const urgency = (d: number) => {
  if (d <= 7)  return { label: 'THIS WEEK',  cls: 'bg-red-500 text-white animate-pulse' };
  if (d <= 30) return { label: 'THIS MONTH', cls: 'bg-amber-500 text-white' };
  if (d <= 90) return { label: 'UPCOMING',   cls: 'bg-blue-500 text-white' };
  return { label: 'LATER', cls: 'bg-slate-300 text-slate-700' };
};

interface Props {
  plans: FestivalPlan[];
  /** filtered set ka size — context ke liye */
  scopeLabel: string;
}

export const FestivalPlanner: React.FC<Props> = ({ plans, scopeLabel }) => {
  const [horizon, setHorizon] = useState<30 | 90 | 400>(90);
  const [openId, setOpenId]   = useState<string | null>(null);

  const visible = useMemo(
    () => plans.filter(p => p.daysAway <= horizon && p.eligibleCount > 0),
    [plans, horizon],
  );

  const totalBudget = visible.reduce((s, p) => s + p.estimatedBudget, 0);

  const exportRoster = (plan: FestivalPlan) => {
    const headers = ['S.No', 'Chest No', 'Reg No', 'Name', 'Religion', 'State', 'District', 'Platoon', 'Mobile'];
    const rows = plan.eligible.map((t: WelfareTrainee, i) => [
      i + 1,
      t.chestNo ?? '—',
      t.regNo ?? '—',
      t.name ?? '—',
      getDimensionValue(t, 'religion'),
      getDimensionValue(t, 'state'),
      getDimensionValue(t, 'district'),
      t.platoon ?? '—',
      t.mobileNo ?? '—',
    ]);
    downloadCSV(
      `Welfare_${plan.festival.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      headers, rows,
    );
  };

  return (
    <div className="bg-white border border-slate-300 shadow-flat">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-rose-900 to-orange-900 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarHeart size={16} className="text-rose-200" />
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              Festival Welfare Planner
            </h2>
            <p className="text-[9px] text-rose-200">
              त्योहार कल्याण योजना · {scopeLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {([30, 90, 400] as const).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-2.5 py-1 text-[9.5px] font-black uppercase border ${
                horizon === h
                  ? 'bg-white text-rose-900 border-white'
                  : 'bg-transparent text-rose-200 border-rose-700 hover:bg-rose-800'
              }`}
            >
              {h === 400 ? 'Full Year' : `${h} Days`}
            </button>
          ))}
        </div>
      </div>

      {/* BUDGET STRIP */}
      {visible.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          <p className="text-[10px] font-bold text-amber-900 flex items-center gap-1.5">
            <Sparkles size={11} />
            {visible.length} tyohaar agle {horizon === 400 ? 'saal' : `${horizon} din`} me
          </p>
          <p className="text-[10px] font-black text-amber-900 flex items-center gap-1">
            <IndianRupee size={11} />
            Anumanit kul welfare budget: ₹{totalBudget.toLocaleString('en-IN')}
          </p>
        </div>
      )}

      {/* LIST */}
      <div className="divide-y divide-slate-200 max-h-[560px] overflow-y-auto custom-scrollbar">
        {visible.length === 0 && (
          <div className="p-8 text-center">
            <CalendarHeart size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400 font-bold">
              Is samay-seema me koi tyohaar nahi mila
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Filter badlein ya "Full Year" chunein
            </p>
          </div>
        )}

        {visible.map(plan => {
          const u = urgency(plan.daysAway);
          const style = KIND_STYLE[plan.festival.kind] ?? KIND_STYLE.National;
          const isOpen = openId === plan.festival.id;
          const tentative = plan.festival.welfareNote.startsWith('TENTATIVE');

          return (
            <div key={plan.festival.id} className="hover:bg-slate-50/60">
              {/* ROW */}
              <button
                onClick={() => setOpenId(isOpen ? null : plan.festival.id)}
                className="w-full text-left px-3 py-2.5 flex items-center gap-3"
              >
                <span className="text-xl flex-shrink-0">{plan.festival.emoji}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11.5px] font-black text-slate-900 truncate">
                      {plan.festival.name}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {plan.festival.hindiName}
                    </span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 uppercase ${style.chip}`}>
                      {plan.festival.kind}
                    </span>
                    {tentative && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300 uppercase">
                        Tentative
                      </span>
                    )}
                  </div>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock size={9} /> {fmtDate(plan.festival.date)}
                    </span>
                    <span className={`font-black px-1.5 py-0.5 text-[8px] uppercase ${u.cls}`}>
                      {plan.daysAway === 0 ? 'AAJ' : `${plan.daysAway} din baad`}
                    </span>
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-black text-military-900 leading-none">
                    {plan.eligibleCount}
                  </p>
                  <p className="text-[8.5px] font-bold text-slate-500 uppercase">Trainees</p>
                </div>

                <ChevronRight
                  size={14}
                  className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {/* DETAIL */}
              {isOpen && (
                <div className="px-3 pb-3 pt-1 bg-slate-50 border-t border-slate-200 space-y-2.5">
                  {/* welfare note */}
                  <div className="bg-white border-l-4 border-emerald-500 px-3 py-2">
                    <p className="text-[9px] font-black text-emerald-800 uppercase mb-0.5">
                      Welfare Action / कल्याण कार्रवाई
                    </p>
                    <p className="text-[10.5px] text-slate-700 leading-relaxed">
                      {plan.festival.welfareNote}
                    </p>
                  </div>

                  {/* stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-white border border-slate-200 px-2.5 py-1.5">
                      <p className="text-[8.5px] font-bold text-slate-500 uppercase">Eligible</p>
                      <p className="text-sm font-black text-military-900 flex items-center gap-1">
                        <Users size={11} /> {plan.eligibleCount}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 px-2.5 py-1.5">
                      <p className="text-[8.5px] font-bold text-slate-500 uppercase">Est. Budget</p>
                      <p className="text-sm font-black text-emerald-700 flex items-center">
                        <IndianRupee size={11} />{plan.estimatedBudget.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 px-2.5 py-1.5">
                      <p className="text-[8.5px] font-bold text-slate-500 uppercase">Applies To</p>
                      <p className="text-[9.5px] font-bold text-slate-700 truncate">
                        {plan.festival.religions.length
                          ? plan.festival.religions.join(', ')
                          : 'All Religions'}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 px-2.5 py-1.5">
                      <p className="text-[8.5px] font-bold text-slate-500 uppercase">Region Rule</p>
                      <p className="text-[9.5px] font-bold text-slate-700 truncate">
                        {plan.festival.states.length
                          ? `${plan.festival.states.length} states (${plan.festival.mode})`
                          : 'Pan-India'}
                      </p>
                    </div>
                  </div>

                  {/* top states */}
                  {plan.topStates.length > 0 && (
                    <div>
                      <p className="text-[8.5px] font-black text-slate-500 uppercase mb-1 flex items-center gap-1">
                        <MapPin size={9} /> State-wise breakup (top 5)
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {plan.topStates.map(s => (
                          <span
                            key={s.value}
                            className="text-[9.5px] font-bold bg-white border border-slate-300 px-2 py-0.5"
                          >
                            {s.value}
                            <span className="ml-1 text-military-800 font-black">{s.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {tentative && (
                    <p className="text-[9px] text-yellow-800 bg-yellow-50 border border-yellow-200 px-2 py-1 flex items-start gap-1">
                      <AlertCircle size={10} className="flex-shrink-0 mt-0.5" />
                      Chaand ke hisaab se date 1 din aage-peeche ho sakti hai — HQ se confirm karein.
                    </p>
                  )}

                  <button
                    onClick={() => exportRoster(plan)}
                    className="bg-military-800 text-white px-3 py-1.5 text-[9.5px] font-black uppercase hover:bg-military-900 flex items-center gap-1.5"
                  >
                    <Download size={11} /> Eligible Roster Export (CSV)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FestivalPlanner;
