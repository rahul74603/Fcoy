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

import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ChevronDown, HeartHandshake } from 'lucide-react';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { buildAvailabilityMap, summarizeAvailability } from '../shared/availability';
import { WelfareDemographicsScreen } from '../welfare/WelfareDemographicsScreen';

export const CommanderInformationBoard: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { activeBatch } = useBatch();
  // Header summary tiles — ye purane board par the, welfare view me nahi hain,
  // isliye yahin rakhe gaye hain taaki band hone par bhi ek nazar me dikhein.
  const [tiles, setTiles] = useState({ trainees: 0, staff: 0, away: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const staffSnap = await getDocs(collection(db, 'staff'));
        let trainees = 0, away = 0;
        if (activeBatch?.id) {
          const [tSnap, aSnap, mSnap] = await Promise.all([
            getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id))),
            getDocs(query(collection(db, 'absentRecords'), where('batchId', '==', activeBatch.id))),
            getDocs(query(collection(db, 'medicalRecords'), where('batchId', '==', activeBatch.id))),
          ]);
          const tList: any[] = []; tSnap.forEach(d => tList.push({ id: d.id, ...d.data() }));
          const aList: any[] = []; aSnap.forEach(d => aList.push({ id: d.id, ...d.data() }));
          const mList: any[] = []; mSnap.forEach(d => mList.push({ id: d.id, ...d.data() }));
          const sum = summarizeAvailability(tList, buildAvailabilityMap({
            trainees: tList, absentRecords: aList, medicalRecords: mList,
          }));
          trainees = sum.total; away = sum.away;
        }
        if (!cancelled) setTiles({ trainees, staff: staffSnap.size, away });
      } catch (err) {
        console.error('Information board summary failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [activeBatch?.id]);

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

      {/* Summary tiles — Total Trainees / Total Staff / Away. Purane board se
          wapas laaye gaye; away count ab availability engine se aata hai. */}
      <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 p-4">
        {[
          { label: 'Total Trainees', value: tiles.trainees, hint: 'Current batch', cls: 'border-blue-100 text-blue-700' },
          { label: 'Total Staff', value: tiles.staff, hint: 'Registered staff', cls: 'border-violet-100 text-violet-700' },
          { label: 'Away / Attention', value: tiles.away, hint: 'Sick · chutti · hospital', cls: 'border-amber-100 text-amber-700' },
        ].map(t => (
          <div key={t.label} className={`rounded-xl border bg-white p-3 ${t.cls.split(' ')[0]}`}>
            <p className="text-[9px] font-black uppercase text-slate-500">{t.label}</p>
            <p className={`mt-1 text-2xl font-black ${t.cls.split(' ')[1]}`}>{t.value}</p>
            <p className="text-[9px] text-slate-400">{t.hint}</p>
          </div>
        ))}
      </div>

      {open && (
        <div className="border-t border-slate-200">
          <WelfareDemographicsScreen embedded />
        </div>
      )}
    </section>
  );
};
