// ═══════════════════════════════════════════════════════════════════════
// LLM PROVIDER LAYER — unified Groq/Gemini with bounded failover
// ───────────────────────────────────────────────────────────────────────
// Production path: Firebase Callable Functions hold the secrets server-side
// (functions/index.js → aiGroq / aiGemini). Dev/self-host path: browser keys
// are used only when explicitly opted in (browserKeysAllowed()).
//
// Failover policy (bounded, never endless):
//   Groq (server) → (dev keys rotate) → Gemini (server)
// On 429 / 5xx / network / malformed response we try the next provider with
// short exponential backoff. A short-lived health memory avoids hammering a
// failing endpoint within the same request burst.
// ═══════════════════════════════════════════════════════════════════════

import { AI_CONFIG } from '../config/ai.config';
import { shouldUseBackend, callGroq as backendCallGroq, callGemini as backendCallGemini, browserKeysAllowed } from '../api/aiBackend.client';

export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: any; tool_call_id?: string; name?: string; }
export interface ToolDef { type: string | 'function'; function: { name: string; description: string; parameters: any } }

export class ProviderError extends Error {
  constructor(public kind: 'rate' | 'auth' | 'server' | 'network' | 'malformed' | 'unavailable', msg: string) { super(msg); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Short-lived per-provider health (resets each session window) ──
const cooldown = new Map<string, number>();
const markCool = (k: string, ms: number) => cooldown.set(k, Date.now() + ms);
const isCool = (k: string) => (cooldown.get(k) ?? 0) > Date.now();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqOpts {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
}

// ───────────────────────────────────────────────────────────────────────
// GROQ — backend callable first; dev browser keys with rotation as fallback
// ───────────────────────────────────────────────────────────────────────
async function groqViaBackend(opts: GroqOpts): Promise<any> {
  // Callable forwards messages verbatim (including assistant tool_calls and
  // tool results with tool_call_id) so the full function-calling loop works.
  const payload: any = {
    messages: opts.messages.map((m) => ({
      role: m.role,
      content: m.content ?? '',
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
    temperature: opts.temperature ?? 0.1,
    maxTokens: opts.maxTokens ?? 1200,
  };
  if (opts.tools) { payload.tools = opts.tools; payload.toolChoice = 'auto'; }
  try {
    const r = await backendCallGroq(payload);
    // Server now returns { message: { role, content, tool_calls }, finishReason }.
    return { choices: [{ message: r.message, finish_reason: r.finishReason }] };
  } catch (e: any) {
    throw mapBackendError(e);
  }
}

async function groqViaBrowserKey(key: string, opts: GroqOpts): Promise<any> {
  const body: any = {
    model: AI_CONFIG.groqModel,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.tools) { body.tools = opts.tools; body.tool_choice = 'auto'; }
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new ProviderError('rate', 'Groq rate limited (browser key)');
  if (res.status === 401) throw new ProviderError('auth', 'Groq key invalid (browser key)');
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status >= 500) throw new ProviderError('server', `Groq ${res.status}: ${txt.slice(0, 120)}`);
    throw new ProviderError('server', `Groq ${res.status}: ${txt.slice(0, 120)}`);
  }
  return res.json();
}

export async function chatGroq(opts: GroqOpts): Promise<any> {
  // 1) Production backend (secrets server-side). This path enforces auth +
  //    role inside the Cloud Function.
  if (shouldUseBackend() && !isCool('groq-backend')) {
    try {
      return await groqViaBackend(opts);
    } catch (e: any) {
      if (e instanceof ProviderError && (e.kind === 'rate' || e.kind === 'server' || e.kind === 'network')) {
        markCool('groq-backend', e.kind === 'rate' ? 20000 : 8000);
      }
      // fall through to browser keys / gemini
    }
  }

  // 2) Dev browser keys (only when explicitly opted in).
  if (browserKeysAllowed() && AI_CONFIG.groqKeys.length) {
    for (let i = 0; i < AI_CONFIG.groqKeys.length; i++) {
      if (isCool(`groq-key-${i}`)) continue;
      try {
        return await groqViaBrowserKey(AI_CONFIG.groqKeys[i], opts);
      } catch (e: any) {
        if (e instanceof ProviderError) {
          if (e.kind === 'rate') markCool(`groq-key-${i}`, 15000);
          else if (e.kind === 'auth') { continue; }
          else if (e.kind === 'server') { await sleep(400 * (i + 1)); continue; }
        }
      }
    }
  }
  throw new ProviderError('unavailable', 'All Groq providers failed');
}

// ───────────────────────────────────────────────────────────────────────
// GEMINI — backend callable first, dev keys with model ladder as fallback
// ───────────────────────────────────────────────────────────────────────
const GEMINI_FALLBACKS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

async function geminiViaBackend(contents: any[], systemInstruction: string): Promise<any> {
  try {
    const data: any = await backendCallGemini({ contents, generationConfig: { temperature: 0.1, maxOutputTokens: 1200 }, systemInstruction: { parts: [{ text: systemInstruction }] } } as any);
    if (data?.candidates?.[0]?.content?.parts) return data;
    // If backend returned a normalized text payload
    if (typeof data?.text === 'string') {
      return { candidates: [{ content: { parts: [{ text: data.text }] } }] };
    }
    throw new ProviderError('malformed', 'Gemini backend malformed response');
  } catch (e: any) {
    throw mapBackendError(e);
  }
}

export async function chatGemini(contents: any[], systemInstruction: string, _tools?: ToolDef[]): Promise<any> {
  if (shouldUseBackend() && !isCool('gemini-backend')) {
    try {
      return await geminiViaBackend(contents, systemInstruction);
    } catch (e: any) {
      if (e instanceof ProviderError) markCool('gemini-backend', e.kind === 'rate' ? 20000 : 8000);
    }
  }
  if (browserKeysAllowed() && AI_CONFIG.geminiKeys.length) {
    for (const model of GEMINI_FALLBACKS) {
      for (const key of AI_CONFIG.geminiKeys) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const res = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
            }),
          });
          if (res.status === 429) { await sleep(600); continue; }
          if (res.status === 404 || res.status === 400) break; // next model
          if (!res.ok) { await sleep(400); continue; }
          return await res.json();
        } catch { /* next */ }
      }
    }
  }
  throw new ProviderError('unavailable', 'All Gemini providers failed');
}

function mapBackendError(e: any): ProviderError {
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? e ?? '');
  if (/unauthenticated|permission-denied|unauthorized/i.test(code + msg)) return new ProviderError('auth', msg);
  if (/resource-exhausted|429|rate/i.test(code + msg)) return new ProviderError('rate', msg);
  if (/unavailable|deadline|5..|internal|network|fetch/i.test(code + msg)) return new ProviderError('network', msg);
  return new ProviderError('server', msg);
}

/**
 * Bounded failover chat: Groq first; on provider failure Gemini. Retries are
 * capped (maxAttempts) with exponential backoff. Never loops forever.
 */
export async function chatWithFailover(
  opts: GroqOpts,
  geminiContents: () => { contents: any[]; system: string },
  maxAttempts = 2,
): Promise<{ provider: 'groq' | 'gemini'; data: any }> {
  let lastErr: any = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await chatGroq(opts);
      return { provider: 'groq', data };
    } catch (e) {
      lastErr = e;
      await sleep(Math.min(500 * 2 ** attempt, 2000));
    }
  }
  try {
    const g = geminiContents();
    const data = await chatGemini(g.contents, g.system, opts.tools);
    return { provider: 'gemini', data };
  } catch (e2) {
    lastErr = e2;
  }
  throw lastErr ?? new ProviderError('unavailable', 'All AI providers failed');
}
