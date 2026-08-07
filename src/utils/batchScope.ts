// src/utils/batchScope.ts
// ═════════════════════════════════════════════════════════════
// ⛓️ STRICT BATCH RULE (POORE APP KA KANUN — yeh hamesha yaad rakhna)
//
// 1. Kisi bhi screen pe 2+ batches ka data EK SAATH nahi dikhega,
//    na list me, na totals me — sirf CURRENTLY SELECTED batch.
// 2. Purane records (jinme batchId nahi hai) sirf asli ACTIVE batch
//    ke view me dikhte hain.
// 3. TEST batch (TEST-77, isDevData tagged) poori tarah isolated:
//    na usme koi aur data, na uska data kisi aur batch me.
// 4. Store/items (company assets stock, kit inventory, vendors,
//    subjects) — global, batch rule unpe lage hi nahi.
// 5. Naye records HAMESHA ACTIVE batch pe stamp hote hain (write-side),
//    chahe user koi purana batch dekh raha ho.
//
// BatchContext yahan current selected batch sync karta hai;
// koi bhi api/screen batchScopeRule(data) se filter la sakta hai.
// ═════════════════════════════════════════════════════════════

let _batchId: string | null = null;
let _isRealActiveView = true; // selected batch asli ACTIVE hai (dev/completed nahi)

type ScopeListener = (batchId: string | null) => void;
const _listeners = new Set<ScopeListener>();

/** BatchContext call karta hai jab selected batch badle */
export const setBatchScope = (batchId: string | null, isRealActiveView: boolean): void => {
  const changed = _batchId !== batchId || _isRealActiveView !== isRealActiveView;
  _batchId = batchId;
  _isRealActiveView = isRealActiveView;
  if (changed) _listeners.forEach(fn => fn(batchId));
};

export const currentScopedBatchId = (): string | null => _batchId;

export const onBatchScopeChange = (fn: ScopeListener): (() => void) => {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
};

/**
 * ⛓️ THE RULE — kya ye doc CURRENT selected batch ka hai?
 * batchId wale docs: sirf tabhi jab batchId match kare.
 * batchId ke bina (legacy): sirf asli ACTIVE batch ke view me.
 */
export const batchScopeRule = (data: Record<string, unknown> | null | undefined): boolean => {
  if (!data) return true;
  const bid = data['batchId'];
  if (bid) return bid === _batchId;
  return _isRealActiveView;
};
