// ═══════════════════════════════════════════════════════════
// TRAINEE RESULT TABLE
// Filter lagne ke baad jo trainees bache — unki list.
// Sirf wahi fields dikhate hain jo registration form me hain.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  Users, Download, ChevronLeft, ChevronRight, ArrowUpDown, Eye, EyeOff,
} from 'lucide-react';
import type { WelfareTrainee } from '../types/welfare.types';
import { downloadCSV, getDimensionValue, MISSING } from '../utils/demographics';

const PAGE_SIZE = 25;

type SortKey = 'chestNo' | 'name' | 'state' | 'religion' | 'district' | 'platoon';

interface Props {
  trainees: WelfareTrainee[];
  scopeLabel: string;
}

export const TraineeResultTable: React.FC<Props> = ({ trainees, scopeLabel }) => {
  const [page, setPage]     = useState(0);
  const [sortKey, setSortKey]   = useState<SortKey>('chestNo');
  const [sortAsc, setSortAsc]   = useState(true);
  /** Privacy: contact number default me chhupa hua */
  const [showContact, setShowContact] = useState(false);

  const sorted = useMemo(() => {
    const val = (t: WelfareTrainee, k: SortKey): string => {
      if (k === 'state' || k === 'religion' || k === 'district') {
        return getDimensionValue(t, k);
      }
      return String(t[k] ?? '');
    };
    return [...trainees].sort((a, b) => {
      const r = val(a, sortKey).localeCompare(val(b, sortKey), 'en', { numeric: true });
      return sortAsc ? r : -r;
    });
  }, [trainees, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const rows       = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(true); }
    setPage(0);
  };

  const exportAll = () => {
    const headers = [
      'S.No', 'Chest No', 'Reg No', 'Name', 'Father Name', 'Gender',
      'Religion', 'Category', 'State', 'Zone', 'Language (Indicative)',
      'District', 'Blood Group', 'Platoon', 'Section',
    ];
    const data = sorted.map((t, i) => [
      i + 1,
      t.chestNo ?? '—',
      t.regNo ?? '—',
      t.name ?? '—',
      t.fatherName ?? '—',
      t.gender ?? '—',
      getDimensionValue(t, 'religion'),
      getDimensionValue(t, 'category'),
      getDimensionValue(t, 'state'),
      getDimensionValue(t, 'zone'),
      getDimensionValue(t, 'language'),
      getDimensionValue(t, 'district'),
      t.bloodGroup ?? '—',
      t.platoon ?? '—',
      t.section ?? '—',
    ]);
    downloadCSV('Welfare_Trainee_List', headers, data);
  };

  const Th: React.FC<{ k?: SortKey; children: React.ReactNode; className?: string }> =
    ({ k, children, className = '' }) => (
      <th
        onClick={k ? () => toggleSort(k) : undefined}
        className={`px-2.5 py-1.5 text-left text-[9px] font-black text-slate-500 uppercase whitespace-nowrap ${
          k ? 'cursor-pointer hover:text-military-800 select-none' : ''
        } ${className}`}
      >
        <span className="flex items-center gap-1">
          {children}
          {k === sortKey && <ArrowUpDown size={9} className="text-military-700" />}
        </span>
      </th>
    );

  const Cell: React.FC<{ v: string; mono?: boolean }> = ({ v, mono }) => (
    <td className={`px-2.5 py-1.5 text-[10.5px] ${mono ? 'font-mono font-bold' : ''} ${
      v === MISSING || v === '—' ? 'text-slate-300 italic' : 'text-slate-700'
    }`}>
      {v}
    </td>
  );

  return (
    <div className="bg-white border border-slate-300 shadow-flat">
      {/* HEADER */}
      <div className="bg-military-900 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-military-300" />
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              Matching Trainees
            </h2>
            <p className="text-[9px] text-military-300">{scopeLabel}</p>
          </div>
          <span className="bg-white text-military-900 text-[10px] font-black px-2 py-0.5 ml-1">
            {sorted.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowContact(s => !s)}
            className="bg-military-800 text-white px-2.5 py-1.5 text-[9.5px] font-black uppercase hover:bg-military-700 border border-military-600 flex items-center gap-1.5"
          >
            {showContact ? <EyeOff size={11} /> : <Eye size={11} />}
            {showContact ? 'Hide Contact' : 'Show Contact'}
          </button>
          <button
            onClick={exportAll}
            disabled={sorted.length === 0}
            className="bg-emerald-600 text-white px-2.5 py-1.5 text-[9.5px] font-black uppercase hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Download size={11} /> Export CSV
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-100 border-b border-slate-300">
            <tr>
              <Th>#</Th>
              <Th k="chestNo">Chest No</Th>
              <Th k="name">Name</Th>
              <Th k="religion">Religion</Th>
              <Th k="state">State</Th>
              <Th>Zone</Th>
              <Th>Language</Th>
              <Th k="district">District</Th>
              <Th>Category</Th>
              <Th k="platoon">Platoon</Th>
              {showContact && <Th>Mobile</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={showContact ? 11 : 10} className="px-4 py-10 text-center">
                  <Users size={26} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400 font-bold">
                    In filters se koi trainee nahi mila
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Kuch filters hataakar dobara try karein
                  </p>
                </td>
              </tr>
            )}

            {rows.map((t, i) => (
              <tr key={t.id} className="hover:bg-military-50/50">
                <td className="px-2.5 py-1.5 text-[9.5px] font-bold text-slate-400">
                  {safePage * PAGE_SIZE + i + 1}
                </td>
                <Cell v={t.chestNo || '—'} mono />
                <td className="px-2.5 py-1.5 text-[10.5px] font-bold text-slate-900 whitespace-nowrap">
                  {t.name || '—'}
                </td>
                <Cell v={getDimensionValue(t, 'religion')} />
                <Cell v={getDimensionValue(t, 'state')} />
                <Cell v={getDimensionValue(t, 'zone')} />
                <Cell v={getDimensionValue(t, 'language')} />
                <Cell v={getDimensionValue(t, 'district')} />
                <Cell v={getDimensionValue(t, 'category')} />
                <Cell v={t.platoon || '—'} />
                {showContact && <Cell v={t.mobileNo || '—'} mono />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {sorted.length > PAGE_SIZE && (
        <div className="border-t border-slate-200 px-3 py-2 flex items-center justify-between bg-slate-50">
          <p className="text-[9.5px] font-bold text-slate-500">
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="p-1 border border-slate-300 bg-white disabled:opacity-30 hover:bg-slate-100"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[9.5px] font-black text-slate-600 px-2">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="p-1 border border-slate-300 bg-white disabled:opacity-30 hover:bg-slate-100"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TraineeResultTable;
