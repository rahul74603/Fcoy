// ═══════════════════════════════════════════════════════════
// GLOBAL SEARCH — Header search bar + Command Palette (Ctrl+K)
// ───────────────────────────────────────────────────────────
// • Har cheez searchable: pages, trainees, staff, funds, vendors…
// • PERMISSION-BASED: jisko jo permission hai wahi results dikhte hain
//   (Company Commander ko sab kuch)
// • CC extra: poore system ka Search Activity Log dekh sakta hai
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Loader2, CornerDownLeft, ArrowUp, ArrowDown,
  Clock, FileSearch, Lock, ScrollText, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalSearch } from './useGlobalSearch';
import type { SearchResultItem } from './searchEngine';
import type { SearchPageEntry } from './searchConfig';
import { getAllowedEntityLabels } from './searchEngine';
import {
  fetchSearchActivity, getRecentSearches, pushRecentSearch,
  type SearchLogEntry,
} from './searchLog';

// ─── Flat item for keyboard navigation ───
type FlatItem =
  | { kind: 'page'; page: SearchPageEntry }
  | { kind: 'data'; item: SearchResultItem };

export const GlobalSearch: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activity, setActivity] = useState<SearchLogEntry[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  const { query, setQuery, groups, pages, loading, totalResults } = useGlobalSearch();

  const isCC = user?.role === 'Company Commander';
  const allowedLabels = useMemo(
    () => (user ? getAllowedEntityLabels(user.role) : []),
    [user],
  );

  // ─── Ctrl+K / Cmd+K shortcut ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── Modal open pe: focus + recent + (CC) activity log ───
  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    if (user) setRecent(getRecentSearches(user.uid));

    if (isCC) {
      fetchSearchActivity(12)
        .then(setActivity)
        .catch(() => setActivity([])); // rules block → chhupa do
    }
  }, [open, user, isCC]);

  // ─── Flat list (keyboard nav) ───
  const flatItems = useMemo<FlatItem[]>(() => {
    const list: FlatItem[] = [];
    for (const p of pages) list.push({ kind: 'page', page: p });
    for (const g of groups) for (const it of g.items) list.push({ kind: 'data', item: it });
    return list;
  }, [pages, groups]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const close = () => { setOpen(false); setQuery(''); };

  const executeItem = (fi: FlatItem) => {
    if (!user) return;
    if (query.trim().length >= 2) pushRecentSearch(user.uid, query);
    close();
    navigate(fi.kind === 'page' ? fi.page.path : fi.item.route);
  };

  // ─── Keyboard navigation ───
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (flatItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const fi = flatItems[activeIndex];
      if (fi) executeItem(fi);
    }
  };

  // Active item ko view mein rakho
  useEffect(() => {
    const el = document.getElementById(`gs-item-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const badgeColor = (b: string) => {
    const u = b.toUpperCase();
    if (['DUE', 'FAIL', 'INACTIVE', 'DISABLED', 'REJECTED', 'A'].includes(u))
      return 'bg-red-100 text-red-700 border-red-300';
    if (['PASS', 'ACTIVE', 'P'].includes(u))
      return 'bg-green-100 text-green-700 border-green-300';
    if (['PENDING', 'UPCOMING'].includes(u))
      return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-slate-100 text-slate-600 border-slate-300';
  };

  const fmtLogTime = (ts: any): string => {
    try {
      const d = typeof ts?.toDate === 'function' ? ts.toDate()
        : ts?.seconds ? new Date(ts.seconds * 1000) : null;
      if (!d) return '';
      return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  let flatIdx = -1; // render ke dauraan index track

  return (
    <>
      {/* ── HEADER TRIGGER BAR ── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full bg-military-50 hover:bg-military-100 border border-military-300 rounded-sm px-3 py-1.5 transition-colors group"
        title="Global Search (Ctrl+K)"
      >
        <Search size={15} className="text-military-700 flex-shrink-0" />
        <span className="text-[12px] font-bold text-slate-500 group-hover:text-slate-700 truncate">
          Search anything — trainees, funds, vendors, staff…
        </span>
        <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
          <kbd className="text-[9px] font-black bg-white border border-slate-300 rounded-sm px-1 py-0.5 text-slate-500">Ctrl</kbd>
          <kbd className="text-[9px] font-black bg-white border border-slate-300 rounded-sm px-1 py-0.5 text-slate-500">K</kbd>
        </span>
      </button>

      {/* ── COMMAND PALETTE MODAL ── */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[1px] flex items-start justify-center pt-[10vh] px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-md shadow-2xl border-2 border-military-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* INPUT ROW */}
            <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-military-800 bg-military-50">
              {loading
                ? <Loader2 size={18} className="text-military-700 animate-spin flex-shrink-0" />
                : <Search size={18} className="text-military-700 flex-shrink-0" />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Kuch bhi search karo — naam, chest no, vendor, fund, page…"
                className="flex-1 bg-transparent outline-none text-sm font-bold text-military-900 placeholder:text-slate-400 placeholder:font-normal"
              />
              <button onClick={close} className="text-slate-400 hover:text-red-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* PERMISSION STRIP */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-military-900 border-b border-military-700">
              <Lock size={10} className="text-amber-400 flex-shrink-0" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">
                {user?.role} Access
              </span>
              <span className="text-[9px] text-slate-400 truncate">
                — {allowedLabels.length} categories: {allowedLabels.slice(0, 6).join(', ')}{allowedLabels.length > 6 ? ` +${allowedLabels.length - 6} more` : ''}
              </span>
            </div>

            {/* RESULTS AREA */}
            <div className="max-h-[55vh] overflow-y-auto custom-scrollbar">

              {/* ── EMPTY QUERY → QUICK LINKS + RECENT + (CC) ACTIVITY LOG ── */}
              {query.trim().length < 2 && (
                <div className="p-3 space-y-4">
                  {/* Quick Pages */}
                  {pages.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Quick Pages
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {pages.slice(0, 8).map((p) => (
                          <div
                            key={p.id}
                            onClick={() => executeItem({ kind: 'page', page: p })}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-sm cursor-pointer text-slate-600 hover:bg-military-50 hover:text-military-900"
                          >
                            <p.icon size={14} className="text-military-600 flex-shrink-0" />
                            <span className="text-[12px] font-bold truncate">{p.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Searches (apne) */}
                  {recent.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={9} /> Aapke Recent Searches
                      </div>
                      <div className="flex flex-wrap gap-1.5 px-2">
                        {recent.map((r) => (
                          <button
                            key={r}
                            onClick={() => setQuery(r)}
                            className="text-[11px] font-bold bg-slate-100 hover:bg-military-100 border border-slate-300 rounded-sm px-2 py-1 text-slate-600"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── PERMISSION LOG / ACTIVITY — sirf CC ── */}
                  {isCC && activity.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <ScrollText size={9} /> Search Activity Log (All Users)
                      </div>
                      <div className="border border-slate-200 rounded-sm divide-y divide-slate-100">
                        {activity.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]">
                            <span className="font-black text-military-800 truncate max-w-[110px]">{a.userName}</span>
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-1 uppercase flex-shrink-0">
                              {a.role}
                            </span>
                            <button
                              onClick={() => setQuery(a.query)}
                              className="font-bold text-slate-600 hover:text-military-800 truncate"
                              title="Is query ko dobara search karo"
                            >
                              “{a.query}”
                            </button>
                            <span className="text-slate-400 flex-shrink-0">→ {a.resultsCount} results</span>
                            <span className="ml-auto text-[9px] text-slate-400 flex-shrink-0">{fmtLogTime(a.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pages.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs font-bold">
                      Type karke search shuru karo (kam se kam 2 letters)
                    </div>
                  )}
                </div>
              )}

              {/* ── PAGES GROUP ── */}
              {query.trim().length >= 1 && pages.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <FileSearch size={9} /> Pages ({pages.length})
                  </div>
                  {pages.map((p) => {
                    flatIdx++;
                    const myIdx = flatIdx;
                    const active = myIdx === activeIndex;
                    return (
                      <div
                        id={`gs-item-${myIdx}`}
                        key={p.id}
                        onClick={() => executeItem({ kind: 'page', page: p })}
                        onMouseEnter={() => setActiveIndex(myIdx)}
                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer border-l-4 ${
                          active ? 'bg-military-100 border-military-700' : 'border-transparent'
                        }`}
                      >
                        <div className="h-7 w-7 bg-military-700 text-white rounded-sm flex items-center justify-center flex-shrink-0">
                          <p.icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-black text-military-900 truncate">{p.title}</div>
                          <div className="text-[10px] text-slate-400 font-bold truncate">Go to page</div>
                        </div>
                        {active && <CornerDownLeft size={13} className="text-military-600 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── DATA GROUPS ── */}
              {groups.map((g) => (
                <div key={g.entity.id}>
                  <div className="px-4 pt-3 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <g.entity.icon size={9} />
                    {g.entity.label}
                    <span className="text-military-600">
                      ({g.totalMatches}{g.totalMatches > g.items.length ? `, top ${g.items.length}` : ''})
                    </span>
                  </div>
                  {g.items.map((it) => {
                    flatIdx++;
                    const myIdx = flatIdx;
                    const active = myIdx === activeIndex;
                    return (
                      <div
                        id={`gs-item-${myIdx}`}
                        key={`${g.entity.id}-${it.docId}`}
                        onClick={() => executeItem({ kind: 'data', item: it })}
                        onMouseEnter={() => setActiveIndex(myIdx)}
                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer border-l-4 ${
                          active ? 'bg-military-100 border-military-700' : 'border-transparent'
                        }`}
                      >
                        <div className="h-7 w-7 bg-white border border-military-400 text-military-700 rounded-sm flex items-center justify-center flex-shrink-0">
                          <g.entity.icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-black text-military-900 truncate">{it.title}</div>
                          {it.subtitle && (
                            <div className="text-[10px] text-slate-500 font-bold truncate">{it.subtitle}</div>
                          )}
                        </div>
                        {it.badge && (
                          <span className={`text-[8px] font-black border rounded-sm px-1.5 py-0.5 uppercase flex-shrink-0 ${badgeColor(it.badge)}`}>
                            {it.badge}
                          </span>
                        )}
                        {active
                          ? <CornerDownLeft size={13} className="text-military-600 flex-shrink-0" />
                          : <ChevronRight size={13} className="text-slate-300 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* ── NO RESULTS ── */}
              {query.trim().length >= 2 && !loading && groups.length === 0 && pages.length === 0 && (
                <div className="text-center py-10">
                  <Search size={28} className="text-slate-300 mx-auto mb-2" />
                  <div className="text-sm font-black text-slate-500">“{query}” ke liye kuch nahi mila</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1">
                    Aapki role mein sirf permitted categories search hoti hain
                  </div>
                </div>
              )}

              <div className="h-2" />
            </div>

            {/* FOOTER */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 bg-slate-50 text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><ArrowUp size={9} /><ArrowDown size={9} /> Navigate</span>
              <span className="flex items-center gap-1"><CornerDownLeft size={9} /> Open</span>
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-300 rounded-sm px-1">Esc</kbd> Close</span>
              {query.trim().length >= 2 && (
                <span className="ml-auto text-military-700 font-black uppercase">
                  {totalResults + pages.length} total results
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
