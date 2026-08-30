// ═══════════════════════════════════════════════════════════════════════
// Pure-Node unit tests for multi-key AI failover (no emulator needed).
// Run: node test/aiFailover.test.mjs
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import {
  classifyGroqStatus, runGroqFailover, geminiModelLadder, runGeminiFailover,
} from '../aiFailover.mjs';

let passed = 0;
const t = (name, fn) => { fn(); passed += 1; console.log(`✓ ${name}`); };

const err = (status, retryable = false) => {
  const e = new Error(`http-${status}`);
  e.status = status;
  if (retryable) e.retryable = true;
  return e;
};

// ── classification ──
t('classify: 429/5xx retryable, 401/403 bad-key, other 4xx fatal', () => {
  assert.equal(classifyGroqStatus(429), 'retryable');
  assert.equal(classifyGroqStatus(500), 'retryable');
  assert.equal(classifyGroqStatus(503), 'retryable');
  assert.equal(classifyGroqStatus(401), 'bad-key');
  assert.equal(classifyGroqStatus(403), 'bad-key');
  assert.equal(classifyGroqStatus(400), 'fatal');
  assert.equal(classifyGroqStatus(404), 'fatal');
});

// ── Groq failover ──
t('groq: first key 429 → second key succeeds (failover works)', async () => {
  const calls = [];
  const outcome = await runGroqFailover(['k1', 'k2'], { m: 1 }, async (key) => {
    calls.push(key);
    if (key === 'k1') throw err(429);
    return { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] };
  });
  assert.equal(outcome.ok, true);
  assert.deepEqual(calls, ['k1', 'k2']);
  assert.equal(outcome.attempts.length, 2);
  assert.equal(outcome.attempts[0].result, 'retryable');
  assert.equal(outcome.attempts[1].result, 'ok');
});

t('groq: 401 bad key → tries next key', async () => {
  const calls = [];
  const outcome = await runGroqFailover(['bad', 'good'], {}, async (key) => {
    calls.push(key);
    if (key === 'bad') throw err(401);
    return { choices: [{ message: { content: 'ok' } }] };
  });
  assert.equal(outcome.ok, true);
  assert.deepEqual(calls, ['bad', 'good']);
});

t('groq: fatal 400 stops immediately — does NOT hammer other keys', async () => {
  const calls = [];
  const outcome = await runGroqFailover(['k1', 'k2', 'k3'], {}, async (key) => {
    calls.push(key);
    throw err(400);
  });
  assert.equal(outcome.ok, false);
  assert.deepEqual(calls, ['k1']); // bounded: no hammering
});

t('groq: network error flagged retryable → next key', async () => {
  const outcome = await runGroqFailover(['k1', 'k2'], {}, async (key) => {
    if (key === 'k1') { const e = new Error('fetch failed'); e.retryable = true; throw e; }
    return { choices: [{ message: { content: 'ok' } }] };
  });
  assert.equal(outcome.ok, true);
});

t('groq: every key tried at most once, then fails honestly', async () => {
  const calls = [];
  const outcome = await runGroqFailover(['k1', 'k2', 'k3'], {}, async (key) => {
    calls.push(key);
    throw err(429);
  });
  assert.equal(outcome.ok, false);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls, ['k1', 'k2', 'k3']);
});

// ── Gemini ladder ──
t('gemini: model ladder dedupes, preferred first', () => {
  const ladder = geminiModelLadder('gemini-flash-latest');
  assert.equal(ladder[0], 'gemini-flash-latest');
  assert.equal(ladder.length, 3); // duplicate pinned removed
});

t('gemini: 404 on preferred model → falls to next model, succeeds', async () => {
  const seen = [];
  const outcome = await runGeminiFailover(
    ['gemini-pinned', 'gemini-flash-latest'], ['gk1'],
    async (model) => {
      seen.push(model);
      if (model === 'gemini-pinned') throw err(404);
      return { candidates: [{ content: 'ok' }] };
    },
  );
  assert.equal(outcome.ok, true);
  assert.deepEqual(seen, ['gemini-pinned', 'gemini-flash-latest']);
});

t('gemini: 429 on key 1 → key 2 on same model', async () => {
  const calls = [];
  const outcome = await runGeminiFailover(['m1'], ['gk1', 'gk2'], async (model, key) => {
    calls.push(key);
    if (key === 'gk1') throw err(429);
    return { candidates: [] };
  });
  assert.equal(outcome.ok, true);
  assert.deepEqual(calls, ['gk1', 'gk2']);
});

t('gemini: bounded attempts = models × keys', async () => {
  const calls = [];
  const outcome = await runGeminiFailover(['m1', 'm2'], ['k1', 'k2'], async (model, key) => {
    calls.push(`${model}/${key}`);
    throw err(429);
  });
  assert.equal(outcome.ok, false);
  assert.equal(calls.length, 4);
});

console.log(`\nFAILOVER TESTS: ${passed} passed, 0 failed`);
