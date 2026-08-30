// ═══════════════════════════════════════════════════════════════════════
// CENTRAL BUSINESS CONSTANTS
// ───────────────────────────────────────────────────────────────────────
// Single source of truth for current official default values.
// HISTORICAL records keep whatever value was stored when they were
// created — never rewrite them. Only NEW defaults use these constants.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Official monthly mess collection per trainee (rupees).
 *
 * History (do NOT use these for new records):
 *   • ₹3500 — very old default (see legacy StudentForm.messBill)
 *   • ₹4650 — intermediate rate used during data migration window
 *   • ₹4680 — CURRENT official rate (used by Mess Fund collection form)
 */
export const MESS_COLLECTION_PER_HEAD = 4680;

/** Legacy rates — kept for reference/migration only; not for new writes. */
export const LEGACY_MESS_RATES = {
  veryOld: 3500,
  migration: 4650,
} as const;
