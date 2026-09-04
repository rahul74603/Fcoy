// ═══════════════════════════════════════════════════════════
// COMMANDER INFORMATION BOARD
// ───────────────────────────────────────────────────────────
// CC dashboard par Welfare & Demographics ka POORA view —
// wahi State / Religion / Language / Zone breakdown, festival
// planner aur trainee roster jo /welfare-demographics page par
// milta hai.
//
// Baaki dashboard sections ki tarah ye bhi collapsible hai —
// band hone par header HIGHLIGHTED dikhta hai ("Click here for
// more"), taaki commander ko pata rahe ki andar data hai.
//
// Implementation: WelfareDemographicsScreen ko `embedded` mode
// me render karte hain taaki ek hi source of truth rahe —
// welfare logic do jagah duplicate na ho.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { ChevronDown, HeartHandshake } from 'lucide-react';
import { WelfareDemographicsScreen } from '../welfare/WelfareDemographicsScreen';

export const CommanderInformationBoard: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-rose-500">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`group w-full flex items-center justify-between px-5 py-3.5 transition-colors ${
          open ? 'bg-white hover:bg-slate-50/60' : 'bg-rose-50/80 hover:bg-rose-100/80'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={open ? 'text-slate-500' : 'text-rose-700'}>
            <HeartHandshake size={14} />
          </span>
          <div className="text-left">
            <p className={`text-[11px] font-black uppercase tracking-wider ${open ? 'text-slate-700' : 'text-rose-900'}`}>
              Company Information Board
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">
              कल्याण एवं जनसांख्यिकी — त्योहार आधारित विशेष सुविधा योजना
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden sm:flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide transition-colors ${
            open
              ? 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
              : 'bg-rose-600 text-white shadow-sm group-hover:bg-rose-700'
          }`}>
            {open ? 'Hide' : 'Click here for more'}
          </span>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${
            open ? 'bg-slate-100 text-slate-500 rotate-180' : 'bg-rose-600 text-white'
          }`}>
            <ChevronDown size={15} />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          <WelfareDemographicsScreen embedded />
        </div>
      )}
    </section>
  );
};
