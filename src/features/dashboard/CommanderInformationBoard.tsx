// ═══════════════════════════════════════════════════════════
// COMMANDER INFORMATION BOARD
// ───────────────────────────────────────────────────────────
// CC dashboard par Welfare & Demographics ka POORA view —
// wahi State / Religion / Language / Zone breakdown, festival
// planner aur trainee roster jo /welfare-demographics page par
// milta hai. Pehle yahan ek chhota filter-strip tha; commander
// ko dashboard par hi pura demographic picture chahiye.
//
// Implementation: WelfareDemographicsScreen ko `embedded` mode
// me render karte hain taaki ek hi source of truth rahe —
// welfare logic do jagah duplicate na ho.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { WelfareDemographicsScreen } from '../welfare/WelfareDemographicsScreen';

export const CommanderInformationBoard: React.FC = () => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <WelfareDemographicsScreen embedded />
  </section>
);
