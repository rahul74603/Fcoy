// ═══════════════════════════════════════════════════════════
// useGlobalSearch — debounced search hook
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SEARCH_PAGES, canAccess, type SearchPageEntry } from './searchConfig';
import { searchAll, type SearchGroup } from './searchEngine';
import { logSearchActivity } from './searchLog';

const DEBOUNCE_MS = 350;

/** Pages instantly match hote hain (Firestore fetch nahi chahiye) */
export function matchPages(rawQuery: string, userRole: string): SearchPageEntry[] {
  const q = rawQuery.trim().toLowerCase();
  const allowed = SEARCH_PAGES.filter((p) => canAccess(p.roles, userRole));
  if (q.length < 1) return allowed; // empty query → quick links

  const tokens = q.split(/\s+/).filter(Boolean);
  return allowed
    .map((p) => {
      const hay = `${p.title} ${p.keywords.join(' ')}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (p.title.toLowerCase().startsWith(t)) score += 60;
        else if (p.title.toLowerCase().includes(t)) score += 35;
        else if (hay.includes(t)) score += 15;
        else return { p, score: 0 };
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.p);
}

export function useGlobalSearch() {
  const { user } = useAuth();
  const role = user?.role ?? '';

  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [pages, setPages] = useState<SearchPageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    // Pages hamesha turant (local matching)
    const matchedPages = matchPages(query, role);
    setPages(matchedPages);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const myReq = ++reqIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const result = await searchAll(trimmed, role);
        if (myReq !== reqIdRef.current) return; // stale response
        setGroups(result);

        // Audit log (fire-and-forget) — permission log
        if (user) {
          const total = result.reduce((sum, g) => sum + g.totalMatches, 0);
          logSearchActivity({
            userId: user.uid,
            userName: user.name,
            role: user.role,
            query: trimmed,
            resultsCount: total,
            categories: result.map((g) => g.entity.label),
          });
        }
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, role, user]);

  const totalResults = groups.reduce((sum, g) => sum + g.totalMatches, 0);

  return { query, setQuery, groups, pages, loading, totalResults };
}
