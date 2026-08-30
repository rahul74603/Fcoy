// ═══════════════════════════════════════════════════════════════════════
// AI PROVIDER FAILOVER — pure, testable logic (no firebase imports)
// ───────────────────────────────────────────────────────────────────────
// Bounded multi-key failover for Groq (OpenAI-compatible) and Gemini.
// Rules:
//   • Each key tried at most once per request — no hammering dead keys.
//   • 429 / 5xx / network error  → retryable → next key.
//   • 401 / 403                  → bad key  → next key (never logged).
//   • Other 4xx                  → non-retryable → stop immediately.
//   • Gemini additionally walks a model ladder: 404/400 → next model.
// Secret values are NEVER logged or returned in errors.
// ═══════════════════════════════════════════════════════════════════════

/** Classify an HTTP status into the failover decision. */
export function classifyGroqStatus(status) {
  if (status === 429 || status >= 500) return 'retryable';
  if (status === 401 || status === 403) return 'bad-key';
  return 'fatal';
}

/**
 * Run one Groq chat completion across all keys, bounded.
 * `callOnce(key, body)` performs the HTTP POST and returns the provider JSON,
 * throwing an Error with `.status` and optional `.retryable` on failure.
 * Returns { ok, data, attempts } or { ok:false, attempts, lastStatus }.
 */
export async function runGroqFailover(keys, body, callOnce) {
  const attempts = [];
  let lastErr = null;
  for (let i = 0; i < keys.length; i += 1) {
    try {
      const data = await callOnce(keys[i], body);
      attempts.push({ keyIndex: i, result: 'ok' });
      return { ok: true, data, attempts };
    } catch (err) {
      lastErr = err;
      const kind = err?.retryable
        ? 'retryable'
        : classifyGroqStatus(err?.status);
      attempts.push({ keyIndex: i, result: kind, status: err?.status ?? null });
      // bad-key (401/403) → try the next key; fatal 4xx → stop.
      if (kind === 'fatal') break;
    }
  }
  return { ok: false, attempts, lastStatus: lastErr?.status ?? null };
}

/** Gemini model ladder (pinned first, then fallbacks). */
export function geminiModelLadder(preferred) {
  return [preferred, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
    .filter((v, i, a) => v && a.indexOf(v) === i);
}

/**
 * Walk models × keys for Gemini. `callOnce(model, key)` returns parsed JSON
 * or throws an Error with `.status`. 429 → next key; 404/400 → next model;
 * other non-ok → next key. Bounded: models.length × keys.length attempts max.
 */
export async function runGeminiFailover(models, keys, callOnce) {
  const attempts = [];
  let lastErr = null;
  for (const model of models) {
    let modelBroken = false;
    for (let ki = 0; ki < keys.length; ki += 1) {
      try {
        const data = await callOnce(model, keys[ki]);
        attempts.push({ model, keyIndex: ki, result: 'ok' });
        return { ok: true, data, attempts };
      } catch (err) {
        lastErr = err;
        const status = err?.status ?? 0;
        if (status === 404 || status === 400) {
          attempts.push({ model, keyIndex: ki, result: 'bad-model', status });
          modelBroken = true;
          break; // next model (key is fine, model is wrong/retired)
        }
        attempts.push({
          model, keyIndex: ki,
          result: status === 429 || status >= 500 ? 'retryable' : 'error',
          status,
        });
      }
    }
    if (modelBroken) continue;
  }
  return { ok: false, attempts, lastStatus: lastErr?.status ?? null };
}
