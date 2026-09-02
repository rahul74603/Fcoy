// ═══════════════════════════════════════════════════════════════════════
// AI BACKEND CLIENT (callable functions)
// ───────────────────────────────────────────────────────────────────────
// Old cloud functions (aiGroq, aiGemini, aiPineconeQuery, aiPineconeUpsert)
// have been REMOVED. These stubs return errors so the app doesn't crash.
// The local ERP engine handles all AI queries now.
// ═══════════════════════════════════════════════════════════════════════

export interface BackendAvailability {
  available: boolean;
  reason?: string;
}

/** Cloud AI backend is no longer available. */
export function shouldUseBackend(): boolean {
  return false;
}

/** Cloud AI functions have been removed. Use local ERP engine. */
export async function callGroq(_payload: unknown): Promise<any> {
  throw new Error('AI cloud functions have been removed. Use local ERP engine.');
}

export async function callGemini(_payload: unknown): Promise<any> {
  throw new Error('AI cloud functions have been removed. Use local ERP engine.');
}

export async function callPineconeQuery(_payload: unknown): Promise<any> {
  throw new Error('AI cloud functions have been removed. Use local ERP engine.');
}

export async function callPineconeUpsert(_payload: unknown): Promise<any> {
  throw new Error('AI cloud functions have been removed. Use local ERP engine.');
}

/** Browser keys are no longer supported. */
export function browserKeysAllowed(): boolean {
  return false;
}
