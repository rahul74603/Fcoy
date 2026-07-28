// ═══════════════════════════════════════════════════════════
// useWelfareData
// `trainees` collection ko real-time sunta hai aur
// filtering / faceting / summary sab memoized deta hai.
//
// IMPORTANT: Ye hook sirf PADHTA hai (read-only).
// Koi nayi field create ya update nahi karta.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useBatch } from '../../../contexts/BatchContext';

import type {
  WelfareTrainee, WelfareFilters, DimensionKey, DimensionStat,
} from '../types/welfare.types';
import {
  applyFilters, buildFacetStat, buildDimensionStat, buildSummary,
  buildFestivalPlans, PINNED_DIMENSIONS,
} from '../utils/demographics';
import { FESTIVAL_CALENDAR } from '../data/festivalCalendar';

const EMPTY_FILTERS: WelfareFilters = {
  batchId: 'ALL',
  search: '',
  selections: {},
};

export const useWelfareData = () => {
  const { activeBatch, allBatches, loading: batchLoading } = useBatch();

  const [rawTrainees, setRawTrainees] = useState<WelfareTrainee[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const [filters, setFilters] = useState<WelfareFilters>(EMPTY_FILTERS);

  /** Kaunsi optional dimensions user ne on ki hain */
  const [activeDimensions, setActiveDimensions] =
    useState<DimensionKey[]>([...PINNED_DIMENSIONS]);

  // ── Batch default: active batch pe lock, warna ALL ──
  useEffect(() => {
    if (batchLoading) return;
    setFilters(prev =>
      prev.batchId === 'ALL' && activeBatch
        ? { ...prev, batchId: activeBatch.id }
        : prev,
    );
  }, [activeBatch, batchLoading]);

  // ── Real-time trainees listener ──
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'trainees'),
      snap => {
        const list: WelfareTrainee[] = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Record<string, any>),
        }));
        setRawTrainees(list);
        setError('');
        setLoading(false);
      },
      err => {
        console.error('Welfare listener error:', err);
        setError(`Trainee data load nahi hua: ${err.message}`);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // ── Batch-scoped pool (search/dimension filters se pehle) ──
  const batchPool = useMemo(() => (
    filters.batchId === 'ALL'
      ? rawTrainees
      : rawTrainees.filter(t => t.batchId === filters.batchId)
  ), [rawTrainees, filters.batchId]);

  // ── Final filtered set ──
  const filtered = useMemo(
    () => applyFilters(rawTrainees, filters),
    [rawTrainees, filters],
  );

  // ── Facet stats (cross-filtered — apna filter khud pe nahi lagta) ──
  const facetStats = useMemo(() => {
    const map = {} as Record<DimensionKey, DimensionStat>;
    activeDimensions.forEach(d => {
      map[d] = buildFacetStat(rawTrainees, filters, d);
    });
    return map;
  }, [rawTrainees, filters, activeDimensions]);

  // ── Filtered set ke exact stats (report/print ke liye) ──
  const filteredStats = useMemo(() => {
    const map = {} as Record<DimensionKey, DimensionStat>;
    activeDimensions.forEach(d => {
      map[d] = buildDimensionStat(filtered, d);
    });
    return map;
  }, [filtered, activeDimensions]);

  const summary = useMemo(
    () => buildSummary(batchPool, filtered),
    [batchPool, filtered],
  );

  const festivalPlans = useMemo(
    () => buildFestivalPlans(filtered, FESTIVAL_CALENDAR),
    [filtered],
  );

  // ── Filter actions ──
  const toggleValue = useCallback((dim: DimensionKey, value: string) => {
    setFilters(prev => {
      const cur = prev.selections[dim] ?? [];
      const next = cur.includes(value)
        ? cur.filter(v => v !== value)
        : [...cur, value];
      return {
        ...prev,
        selections: { ...prev.selections, [dim]: next },
      };
    });
  }, []);

  const clearDimension = useCallback((dim: DimensionKey) => {
    setFilters(prev => ({
      ...prev,
      selections: { ...prev.selections, [dim]: [] },
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(prev => ({ ...prev, search: '', selections: {} }));
  }, []);

  const setBatch  = useCallback((batchId: string) =>
    setFilters(prev => ({ ...prev, batchId })), []);

  const setSearch = useCallback((search: string) =>
    setFilters(prev => ({ ...prev, search })), []);

  const addDimension = useCallback((dim: DimensionKey) => {
    setActiveDimensions(prev => prev.includes(dim) ? prev : [...prev, dim]);
  }, []);

  const removeDimension = useCallback((dim: DimensionKey) => {
    if (PINNED_DIMENSIONS.includes(dim)) return;   // pinned hataya nahi ja sakta
    setActiveDimensions(prev => prev.filter(d => d !== dim));
    clearDimension(dim);
  }, [clearDimension]);

  const activeFilterCount = useMemo(() =>
    Object.values(filters.selections).reduce((n, v) => n + (v?.length ?? 0), 0),
    [filters.selections],
  );

  return {
    // data
    rawTrainees,
    batchPool,
    filtered,
    facetStats,
    filteredStats,
    summary,
    festivalPlans,

    // state
    loading: loading || batchLoading,
    error,
    filters,
    activeDimensions,
    activeFilterCount,
    allBatches,
    activeBatch,

    // actions
    toggleValue,
    clearDimension,
    clearAllFilters,
    setBatch,
    setSearch,
    addDimension,
    removeDimension,
  };
};
