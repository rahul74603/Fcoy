// ═══════════════════════════════════════════════════════════════════════
// AI BACKEND CLIENT (callable functions)
// ───────────────────────────────────────────────────────────────────────
// In PRODUCTION the browser calls Firebase Callable Functions that hold
// the cloud-AI secrets server-side. The browser never sends or receives a
// Groq/Gemini/Pinecone key. Authorization (signed-in + Company Commander +
// active account) is enforced inside the function.
//
// `backendReady()` is false when the functions emulator / deployed functions
// are not reachable; callers then fall back to the local ERP engine. Browser
// bundled keys (VITE_*) are used ONLY as an explicit, dev-only opt-in and are
// never required in production.
// ═══════════════════════════════════════════════════════════════════════

import {
  getFunctions, httpsCallable, connectFunctionsEmulator, type Functions,
} from 'firebase/functions';
import { app } from '../../../config/firebase';
import { AI_CONFIG } from '../config/ai.config';

let functionsInstance: Functions | null = null;
function functions(): Functions | null {
  if (functionsInstance) return functionsInstance;
  try {
    // Region must match the deployed function region (default us-central1).
    const region = (import.meta.env.VITE_FUNCTIONS_REGION as string | undefined) || 'us-central1';
    functionsInstance = getFunctions(app, region);
    // Local emulator wiring (dev only): set VITE_USE_FUNCTIONS_EMULATOR=true.
    if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
      connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
    }
    return functionsInstance;
  } catch {
    return null;
  }
}

export interface BackendAvailability {
  available: boolean;
  reason?: string;
}

/**
 * Whether the server proxy should be used. This is the PRIMARY path in
 * production; it does not depend on any browser secret.
 */
export function shouldUseBackend(): boolean {
  // An explicit proxy URL or callable functions support.
  return functions() !== null;
}

export async function callGroq(payload: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: unknown;
}): Promise<string> {
  const fn = httpsCallable<typeof payload, { content: string; model: string }>(
    functions()!, 'aiGroq',
  );
  const res = await fn(payload);
  return res.data?.content ?? '';
}

export async function callGemini(payload: {
  contents: unknown;
  generationConfig?: unknown;
  systemInstruction?: unknown;
}): Promise<Record<string, unknown>> {
  const fn = httpsCallable<typeof payload, Record<string, unknown>>(
    functions()!, 'aiGemini',
  );
  const res = await fn(payload);
  return res.data as Record<string, unknown>;
}

export async function callPineconeQuery(payload: {
  vector: number[];
  topK?: number;
}): Promise<{ matches: Array<{ id: string; score: number; metadata: Record<string, unknown> }> }> {
  const fn = httpsCallable<typeof payload, { matches: any[] }>(
    functions()!, 'aiPineconeQuery',
  );
  const res = await fn(payload);
  return { matches: res.data?.matches ?? [] };
}

export async function callPineconeUpsert(payload: {
  vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>;
}): Promise<{ upserted: number }> {
  const fn = httpsCallable<typeof payload, { upserted: number }>(
    functions()!, 'aiPineconeUpsert',
  );
  const res = await fn(payload);
  return { upserted: res.data?.upserted ?? 0 };
}

/** True only when a non-production dev build explicitly opts into browser keys. */
export function browserKeysAllowed(): boolean {
  // Production builds never use bundled secrets. Local dev may opt in.
  return import.meta.env.DEV === true
    && import.meta.env.VITE_AI_ALLOW_BROWSER_KEYS === 'true';
}

export { AI_CONFIG };
