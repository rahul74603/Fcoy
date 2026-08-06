// src/components/common/ReportButton.tsx
// ─────────────────────────────────────────────
// 📄 PAGE REPORT BUTTON — har data page pe Refresh ke paas
// Click → browser Print dialog → "Save as PDF" select karke PDF
// ya direct printer se nikaal lo.
//
// Print stylesheet (index.css) automatically:
//   • Sidebar, banners, saare BUTTONS hide
//   • Page ka table/data full-width clean print
//   • Upar app header (unit, coy, date-time) = letterhead
// Har role apni permission wali screen ka report nikaal sakta hai.
// ─────────────────────────────────────────────

import { Printer } from 'lucide-react';

interface ReportButtonProps {
  label?: string;
  className?: string;
}

export const ReportButton = ({ label = 'Report', className = '' }: ReportButtonProps) => (
  <button
    onClick={() => window.print()}
    title="Is page ka report nikalo — Print dialog me 'Save as PDF' select karke PDF bhi ban jayega"
    className={`print:hidden flex items-center gap-1.5 text-[11px] font-bold uppercase border border-military-800 bg-military-800 text-white px-3 py-1.5 hover:bg-military-900 rounded ${className}`}
  >
    <Printer size={12} /> 📄 {label}
  </button>
);

export default ReportButton;
