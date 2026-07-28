// ═══════════════════════════════════════════════════════════
// DIMENSION CARD
// Ek dimension (State / Religion / Language ...) ka
// count breakdown + clickable filter bars.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, X, Pin, Search,
  Info, AlertTriangle, BarChart3,
} from 'lucide-react';
import type { DimensionStat, DimensionKey } from '../types/welfare.types';
import { DIM_MAP } from '../utils/demographics';
import { ZONE_COLORS, RELIGION_COLORS } from '../data/stateMeta';

const ACCENT: Record<string, { bar: string; head: string; text: string; ring: string }> = {
  blue:    { bar: 'bg-blue-500',    head: 'bg-blue-50 border-blue-200',       text: 'text-blue-800',    ring: 'ring-blue-400' },
  orange:  { bar: 'bg-orange-500',  head: 'bg-orange-50 border-orange-200',   text: 'text-orange-800',  ring: 'ring-orange-400' },
  violet:  { bar: 'bg-violet-500',  head: 'bg-violet-50 border-violet-200',   text: 'text-violet-800',  ring: 'ring-violet-400' },
  teal:    { bar: 'bg-teal-500',    head: 'bg-teal-50 border-teal-200',       text: 'text-teal-800',    ring: 'ring-teal-400' },
  sky:     { bar: 'bg-sky-500',     head: 'bg-sky-50 border-sky-200',         text: 'text-sky-800',     ring: 'ring-sky-400' },
  indigo:  { bar: 'bg-indigo-500',  head: 'bg-indigo-50 border-indigo-200',   text: 'text-indigo-800',  ring: 'ring-indigo-400' },
  pink:    { bar: 'bg-pink-500',    head: 'bg-pink-50 border-pink-200',       text: 'text-pink-800',    ring: 'ring-pink-400' },
  red:     { bar: 'bg-red-500',     head: 'bg-red-50 border-red-200',         text: 'text-red-800',     ring: 'ring-red-400' },
  emerald: { bar: 'bg-emerald-500', head: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', ring: 'ring-emerald-400' },
  rose:    { bar: 'bg-rose-500',    head: 'bg-rose-50 border-rose-200',       text: 'text-rose-800',    ring: 'ring-rose-400' },
  amber:   { bar: 'bg-amber-500',   head: 'bg-amber-50 border-amber-200',     text: 'text-amber-800',   ring: 'ring-amber-400' },
  slate:   { bar: 'bg-slate-500',   head: 'bg-slate-50 border-slate-200',     text: 'text-slate-800',   ring: 'ring-slate-400' },
  stone:   { bar: 'bg-stone-500',   head: 'bg-stone-50 border-stone-200',     text: 'text-stone-800',   ring: 'ring-stone-400' },
  lime:    { bar: 'bg-lime-500',    head: 'bg-lime-50 border-lime-200',       text: 'text-lime-800',    ring: 'ring-lime-400' },
};

interface Props {
  stat: DimensionStat;
  selected: string[];
  onToggle: (dim: DimensionKey, value: string) => void;
  onClear: (dim: DimensionKey) => void;
  onRemove?: (dim: DimensionKey) => void;
  /** kitne rows collapsed state me dikhaye */
  previewCount?: number;
}

export const DimensionCard: React.FC<Props> = ({
  stat, selected, onToggle, onClear, onRemove, previewCount = 6,
}) => {
  const def = DIM_MAP[stat.key];
  const theme = ACCENT[def.accent] ?? ACCENT.slate;

  const [expanded, setExpanded] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  const visible = useMemo(() => {
    let rows = stat.buckets;
    if (localSearch.trim()) {
      const q = localSearch.trim().toLowerCase();
      rows = rows.filter(b => b.value.toLowerCase().includes(q));
    }
    return expanded ? rows : rows.slice(0, previewCount);
  }, [stat.buckets, localSearch, expanded, previewCount]);

  const maxCount = Math.max(1, ...stat.buckets.filter(b => !b.isMissing).map(b => b.count));
  const hasMore  = stat.buckets.length > previewCount;

  /** Zone/Religion ke liye semantic colour, warna dimension accent */
  const barColor = (value: string) => {
    if (stat.key === 'zone')     return ZONE_COLORS[value] ?? theme.bar;
    if (stat.key === 'religion') return RELIGION_COLORS[value] ?? theme.bar;
    return theme.bar;
  };

  return (
    <div className="bg-white border border-slate-300 shadow-flat flex flex-col">
      {/* ── HEADER ── */}
      <div className={`px-3 py-2 border-b ${theme.head} flex items-start justify-between gap-2`}>
        <div className="min-w-0">
          <h3 className={`text-[11px] font-black uppercase tracking-wide ${theme.text} flex items-center gap-1.5`}>
            {def.pinned
              ? <Pin size={11} className="flex-shrink-0" />
              : <BarChart3 size={11} className="flex-shrink-0" />}
            <span className="truncate">{def.label}</span>
            <span className="text-[9px] font-bold opacity-70 flex-shrink-0">/ {def.hindiLabel}</span>
          </h3>
          <p className="text-[8.5px] text-slate-500 mt-0.5 flex items-center gap-1">
            <Info size={8} className="flex-shrink-0" />
            <span className="truncate">{def.hint}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <button
              onClick={() => onClear(stat.key)}
              title="Is filter ko hatao"
              className="text-[8.5px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full hover:bg-red-600 flex items-center gap-0.5"
            >
              <X size={8} /> {selected.length}
            </button>
          )}
          {!def.pinned && onRemove && (
            <button
              onClick={() => onRemove(stat.key)}
              title="Card hatao"
              className="text-slate-400 hover:text-red-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── META STRIP ── */}
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[9px]">
        <span className="font-bold text-slate-600">
          {stat.distinct} distinct · {stat.known} recorded
        </span>
        {stat.missing > 0 && (
          <span className="font-bold text-amber-700 flex items-center gap-1">
            <AlertTriangle size={9} /> {stat.missing} blank
          </span>
        )}
      </div>

      {/* ── SEARCH (agar bahut saare options ho) ── */}
      {stat.buckets.length > 10 && (
        <div className="px-3 pt-2">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder={`${def.label} search...`}
              className="w-full text-[10px] pl-6 pr-2 py-1 border border-slate-300 focus:outline-none focus:border-military-600"
            />
          </div>
        </div>
      )}

      {/* ── BUCKET LIST ── */}
      <div className="p-2 space-y-1 flex-1">
        {visible.length === 0 && (
          <p className="text-[10px] text-slate-400 italic text-center py-3">
            Koi record nahi mila
          </p>
        )}

        {visible.map(b => {
          const isSel = selected.includes(b.value);
          const width = b.isMissing ? 100 : Math.max(4, (b.count / maxCount) * 100);

          return (
            <button
              key={b.value}
              onClick={() => onToggle(stat.key, b.value)}
              className={`w-full text-left group relative overflow-hidden border transition-all ${
                isSel
                  ? `border-military-700 ring-1 ${theme.ring} bg-military-50`
                  : 'border-slate-200 hover:border-slate-400 bg-white'
              }`}
            >
              {/* bar background */}
              <div
                className={`absolute inset-y-0 left-0 opacity-20 transition-all ${
                  b.isMissing ? 'bg-slate-400' : barColor(b.value)
                }`}
                style={{ width: `${width}%` }}
              />
              <div className="relative flex items-center justify-between px-2 py-1.5 gap-2">
                <span className={`text-[10.5px] font-bold truncate ${
                  b.isMissing ? 'text-slate-500 italic' : 'text-slate-800'
                }`}>
                  {isSel && <span className="text-military-700 mr-1">✓</span>}
                  {b.value}
                </span>
                <span className="flex items-baseline gap-1.5 flex-shrink-0">
                  <span className={`text-[13px] font-black leading-none ${
                    b.isMissing ? 'text-slate-400' : 'text-military-900'
                  }`}>
                    {b.count}
                  </span>
                  <span className="text-[8.5px] font-bold text-slate-400 w-8 text-right">
                    {b.percent}%
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── EXPAND / COLLAPSE ── */}
      {hasMore && !localSearch && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="border-t border-slate-200 py-1.5 text-[9.5px] font-black uppercase text-slate-500 hover:text-military-800 hover:bg-slate-50 flex items-center justify-center gap-1"
        >
          {expanded
            ? <><ChevronUp size={11} /> Kam dikhao</>
            : <><ChevronDown size={11} /> Sabhi {stat.buckets.length} dikhao</>}
        </button>
      )}
    </div>
  );
};

export default DimensionCard;
