// src/utils/devDataFilter.ts
// ─────────────────────────────────────────────
// 🧪 DEV DATA HIDER (Central)
// Docs tagged `isDevData: true` (dev seed / test batch)
// SIRF developer account ko dikhte hain.
// Baaki sab roles ke liye poore app se hidden.
//
// AuthContext login pe setDevViewer(true/false) karta hai,
// aur har read spot pe showDoc()/filter lagaya gaya hai.
// ─────────────────────────────────────────────

export const DEV_TAG = 'isDevData';

let _isDevViewer = false;

type DevListener = (isDev: boolean) => void;
const _listeners = new Set<DevListener>();

/** AuthContext call karta hai — login/logout pe */
export const setDevViewer = (isDev: boolean): void => {
  if (_isDevViewer === isDev) return;
  _isDevViewer = isDev;
  _listeners.forEach(fn => fn(isDev));
};

export const isDevViewer = (): boolean => _isDevViewer;

/** Flag change ka realtime notice chahiye ho (jaise BatchContext listener) */
export const onDevViewerChange = (fn: DevListener): (() => void) => {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
};

/** Ye doc current user ko dikhna chahiye? */
export const showDoc = (data: Record<string, unknown> | undefined | null): boolean =>
  _isDevViewer || !data || data[DEV_TAG] !== true;

/** Raw row objects filter (rows jinke andar data ho) */
export const filterDevRows = <T>(rows: T[]): T[] =>
  _isDevViewer
    ? rows
    : rows.filter(r => (r as Record<string, unknown> | null)?.[DEV_TAG] !== true);

interface SnapLike {
  docs: Array<{ data: () => Record<string, unknown> }>;
}

/** "tSnap.size" ki jagah — sirf visible docs ka count */
export const visibleDocCount = (snap: SnapLike): number =>
  _isDevViewer
    ? snap.docs.length
    : snap.docs.filter(d => showDoc(d.data())).length;
