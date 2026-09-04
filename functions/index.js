// ═══════════════════════════════════════════════════════════════════════
// FCOY ERP — SERVER-SIDE AI PROXY (Firebase Cloud Functions)
// ───────────────────────────────────────────────────────────────────────
// SECURITY MODEL
//   Browser  →  Firebase Callable Function (this code, trusted)  →  Groq/Gemini/Pinecone
//
//   • Cloud AI secrets live ONLY here (Firebase Secret Manager) — they are
//     never shipped to the browser and never returned in any response.
//   • Every call requires a signed-in Firebase user.
//   • The user's Firestore profile is read SERVER-SIDE with Admin SDK and the
//     role/active state is verified here. This is independent of (and
//     stronger than) any React-side check.
//   • These functions ONLY forward requests to the external AI providers.
//     They are NOT a Firestore/database proxy — clients cannot use them to
//     read or write arbitrary database data. All Firestore access stays
//     governed by firestore.rules (the client SDK uses the user's token).
//
// DEPLOYMENT (run once, from a machine with firebase-tools logged in):
//   firebase functions:secrets:set GROQ_API_KEY
//   firebase functions:secrets:set GEMINI_API_KEY      (optional)
//   firebase functions:secrets:set PINECONE_API_KEY    (optional RAG)
//   firebase functions:secrets:set PINECONE_HOST       (optional RAG)
//   firebase deploy --only functions
//   Optional non-secret config:
//     firebase functions:config:set ai.groq_model=llama-3.3-70b-versatile
//       ai.gemini_model=gemini-flash-latest
// ═══════════════════════════════════════════════════════════════════════

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import {
  runGroqFailover, runGeminiFailover, geminiModelLadder,
} from './aiFailover.mjs';
import {
  assertCallerIsCommander, normalizeStaffInput, provisionStaff, ProvisioningError,
  repairStaffAccount, auditStaffAccounts,
} from './staffProvisioning.mjs';

// ───────────────────────────────────────────────────────────────────────
// LAZY firebase-admin initialization.
//
// The Functions emulator ANALYZES this module (imports it) to discover the
// callable definitions. Doing initializeApp()/getFirestore() at top level
// forces Application Default Credentials (ADC) discovery at import time.
// ADC probes the Google metadata endpoint (169.254.169.254); on a developer
// machine outside GCP that probe can hang on a black-holed route instead of
// failing fast, blowing past the emulator's 10s analysis timeout
// ("Cannot determine backend specification").
//
// Deferring init until the first actual invocation keeps module analysis
// lightweight and makes NO outbound calls (no ADC probe, no Firestore, no
// Groq/Gemini/Pinecone) during import. In production the runtime provides
// the same automatic credentials as before — nothing about auth changes.
// ───────────────────────────────────────────────────────────────────────
let _db = null;
let _auth = null;
function getDb() {
  if (_db) return _db;
  if (!getApps().length) initializeApp();
  _db = getFirestore();
  return _db;
}
function getAdminAuth() {
  if (_auth) return _auth;
  if (!getApps().length) initializeApp();
  _auth = getAuth();
  return _auth;
}

// ── Secrets (values live in Google Secret Manager, never in the repo) ──
// Multiple Groq/Gemini keys are supported for bounded server-side failover:
//   firebase functions:secrets:set GROQ_API_KEY      (primary)
//   firebase functions:secrets:set GROQ_API_KEY_2    (failover)
//   firebase functions:secrets:set GROQ_API_KEY_3    (failover)
//   firebase functions:secrets:set GEMINI_API_KEY    (Gemini fallback)
//   firebase functions:secrets:set GEMINI_API_KEY_2  (optional)
const GROQ_API_KEY      = defineSecret('GROQ_API_KEY');
const GROQ_API_KEY_2    = defineSecret('GROQ_API_KEY_2');
const GROQ_API_KEY_3    = defineSecret('GROQ_API_KEY_3');
const GEMINI_API_KEY    = defineSecret('GEMINI_API_KEY');
const GEMINI_API_KEY_2  = defineSecret('GEMINI_API_KEY_2');
const PINECONE_API_KEY  = defineSecret('PINECONE_API_KEY');
const PINECONE_HOST     = defineSecret('PINECONE_HOST');

// Non-secret runtime config (defaults are safe).
const GROQ_MODEL   = process.env.GROQ_MODEL   || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// AI assistant is the Commander's tool. Keep server policy explicit.
const AI_ROLE = (process.env.AI_ALLOWED_ROLE || 'Company Commander').trim();

// Only bind secrets that are actually declared/available; extra *_2/_3 keys
// are optional — the function still deploys if they are not set.
const GROQ_SECRETS    = [GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3];
const GEMINI_SECRETS  = [GEMINI_API_KEY, GEMINI_API_KEY_2];
const PINECONE_SECRETS = [PINECONE_API_KEY, PINECONE_HOST];

/** Collect every configured Groq key (env values are '' when unset). */
function groqKeys() {
  return [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3]
    .map((k) => (k || '').trim())
    .filter(Boolean);
}
/** Collect every configured Gemini key. */
function geminiKeys() {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2]
    .map((k) => (k || '').trim())
    .filter(Boolean);
}

// ───────────────────────────────────────────────────────────────────────
// AUTHORIZATION — server-trusted role verification
// ───────────────────────────────────────────────────────────────────────
async function assertAiAuthorized(request) {
  if (!request?.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  const uid = request.auth.uid;
  let snap;
  try {
    snap = await getDb().collection('users').doc(uid).get();
  } catch (err) {
    logger.error('AI proxy role lookup failed', { uid, err: String(err) });
    throw new HttpsError('internal', 'Authorization check failed.');
  }
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'User profile not found.');
  }
  const data = snap.data() || {};
  if (data.isActive === false) {
    throw new HttpsError('permission-denied', 'Account is deactivated.');
  }
  if (String(data.role || '').trim() !== AI_ROLE) {
    // Do not leak role internals; a clear denial is enough.
    logger.warn('AI proxy denied: role not authorized', { uid, role: data.role });
    throw new HttpsError(
      'permission-denied',
      'Only the Company Commander may use the AI assistant.',
    );
  }
  return { uid, email: request.auth.token?.email || data.email || '' };
}

// Never echo a secret into an error/response.
function safeError(status, message, err) {
  if (err) logger.warn(message, { detail: String(err?.message || err).slice(0, 300) });
  return new HttpsError(status, message);
}

// ───────────────────────────────────────────────────────────────────────
// 1) GROQ CHAT COMPLETIONS
//    data: { messages: [{role, content}], temperature?, maxTokens?, responseFormat? }
// ───────────────────────────────────────────────────────────────────────
// A single Groq attempt with one key. Returns the raw provider JSON.
async function callGroqOnce(key, body) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) { const e = new Error('rate-limit'); e.retryable = true; e.status = 429; throw e; }
  if (resp.status === 401 || resp.status === 403) { const e = new Error('bad-key'); e.status = resp.status; throw e; }
  if (resp.status >= 500) { const e = new Error('server-error'); e.retryable = true; e.status = resp.status; throw e; }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    const e = new Error(`groq-${resp.status}`); e.status = resp.status; e.detail = txt.slice(0, 160); throw e;
  }
  return resp.json();
}

export const aiGroq = onCall(
  { secrets: GROQ_SECRETS, timeoutSeconds: 90, memory: '512MiB' },
  async (request) => {
    await assertAiAuthorized(request);

    const { messages, temperature = 0.1, maxTokens = 1000, responseFormat, tools, toolChoice, model } =
      request.data || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'messages[] is required.');
    }

    const keys = groqKeys();
    if (!keys.length) throw safeError('failed-precondition', 'Groq is not configured on the server.');

    const body = {
      model: model || GROQ_MODEL,
      messages,
      temperature: Number(temperature) || 0.1,
      max_tokens: Number(maxTokens) || 1000,
      ...(responseFormat ? { response_format: responseFormat } : {}),
      // Function-calling fields are forwarded verbatim (the client builds
      // the tool schemas). This is what makes the agent tool-loop work in
      // production — previously these were stripped.
      ...(Array.isArray(tools) && tools.length ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    };

    // Bounded failover across every configured Groq key: try each once;
    // on a retryable error (429/5xx/network) move to the next key. Never
    // loop forever, never log a key.
    const outcome = await runGroqFailover(keys, body, callGroqOnce);
    if (!outcome.ok) {
      logger.warn('Groq all attempts failed', { attempts: outcome.attempts });
      throw safeError('unavailable', 'All Groq providers failed.');
    }
    const data = outcome.data;
    const msg = data?.choices?.[0]?.message ?? {};
    // Return the FULL assistant message (content + tool_calls) plus
    // finish reason so the client agent loop can run tools.
    return {
      message: {
        role: 'assistant',
        content: msg.content ?? '',
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      },
      finishReason: data?.choices?.[0]?.finish_reason ?? null,
      model: data?.model || model || GROQ_MODEL,
      // Back-compat: older clients read .content directly.
      content: msg.content ?? '',
    };
  },
);

// ───────────────────────────────────────────────────────────────────────
// 2) GEMINI GENERATE CONTENT
//    data: { contents: [...], generationConfig?, systemInstruction? }
//    (The frontend builds the Gemini REST body; we forward the whitelisted
//     parts and inject the server-side key.)
// ───────────────────────────────────────────────────────────────────────
export const aiGemini = onCall(
  { secrets: GEMINI_SECRETS, timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    await assertAiAuthorized(request);

    const { contents, generationConfig, systemInstruction } = request.data || {};
    if (!contents || (Array.isArray(contents) ? contents.length === 0 : !contents)) {
      throw new HttpsError('invalid-argument', 'contents is required.');
    }

    const keys = geminiKeys();
    if (!keys.length) throw safeError('failed-precondition', 'Gemini is not configured on the server.');

    const { tools } = request.data || {};

    // Model ladder: pinned model first, then fallbacks for retirements.
    const models = geminiModelLadder(GEMINI_MODEL);

    const reqBodyBase = {
      contents,
      ...(generationConfig ? { generationConfig } : {}),
      ...(systemInstruction ? { systemInstruction } : {}),
      // Forward function-calling tool declarations (converted to
      // Gemini's functionDeclarations shape by the caller).
      ...(Array.isArray(tools) && tools.length ? { tools } : {}),
    };

    const outcome = await runGeminiFailover(models, keys, async (model, key) => {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
        `:generateContent?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBodyBase),
      });
      if (resp.status === 429) { const e = new Error('rate-limit'); e.status = 429; throw e; }
      if (resp.status === 404 || resp.status === 400) {
        const e = new Error(`gemini-${resp.status}`); e.status = resp.status; throw e;
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        const e = new Error(`gemini-${resp.status}`); e.status = resp.status; e.detail = txt.slice(0, 160); throw e;
      }
      // Return the provider JSON body (it contains no secret — the key
      // was only in the URL).
      return resp.json();
    });

    if (!outcome.ok) {
      logger.warn('Gemini all attempts failed', { attempts: outcome.attempts });
      throw safeError('unavailable', 'All Gemini providers failed.');
    }
    return outcome.data;
  },
);

// ───────────────────────────────────────────────────────────────────────
// 3) PINECONE VECTOR QUERY (RAG retrieval)
//    data: { vector: number[], topK?: number }  →  { matches: [{metadata}] }
//    Embeddings are computed in the browser (TF USE); only the vector is
//    sent. We return match metadata text only.
// ───────────────────────────────────────────────────────────────────────
export const aiPineconeQuery = onCall(
  { secrets: PINECONE_SECRETS, timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    await assertAiAuthorized(request);
    const { vector, topK = 5 } = request.data || {};
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new HttpsError('invalid-argument', 'vector[] is required.');
    }
    const key = process.env.PINECONE_API_KEY;
    const host = (process.env.PINECONE_HOST || '').replace(/\/$/, '');
    if (!key || !host) throw safeError('failed-precondition', 'RAG search is not configured on the server.');

    try {
      const resp = await fetch(`${host}/query`, {
        method: 'POST',
        headers: { 'Api-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector, topK: Number(topK) || 5, includeMetadata: true }),
      });
      if (!resp.ok) throw safeError('unavailable', `Pinecone error (${resp.status}).`, new Error(String(resp.status)));
      const data = await resp.json();
      // Return only match metadata — no key/host.
      const matches = Array.isArray(data?.matches)
        ? data.matches.map((m) => ({ id: m.id, score: m.score, metadata: m.metadata || {} }))
        : [];
      return { matches };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw safeError('unavailable', 'RAG query failed.', err);
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// 4) PINECONE UPSERT (admin sync of embeddings)
//    data: { vectors: [{id, values, metadata}] }
// ───────────────────────────────────────────────────────────────────────
export const aiPineconeUpsert = onCall(
  { secrets: PINECONE_SECRETS, timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    await assertAiAuthorized(request);
    const { vectors } = request.data || {};
    if (!Array.isArray(vectors) || vectors.length === 0) {
      throw new HttpsError('invalid-argument', 'vectors[] is required.');
    }
    const key = process.env.PINECONE_API_KEY;
    const host = (process.env.PINECONE_HOST || '').replace(/\/$/, '');
    if (!key || !host) throw safeError('failed-precondition', 'RAG is not configured on the server.');

    try {
      const resp = await fetch(`${host}/vectors/upsert`, {
        method: 'POST',
        headers: { 'Api-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectors }),
      });
      if (!resp.ok) throw safeError('unavailable', `Pinecone upsert error (${resp.status}).`, new Error(String(resp.status)));
      return { upserted: vectors.length };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw safeError('unavailable', 'RAG upsert failed.', err);
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// 5) STAFF ACCOUNT PROVISIONING (CC-only, server-side Admin SDK)
//    data: { name, email, password, role, phone?, designation?,
//            assignedBatchIds?: string[] }
//
// Replaces client-side createUserWithEmailAndPassword: only a Company
// Commander (active) can mint staff logins. The callable creates BOTH the
// Auth account and the Firestore profile with Admin SDK, forces
// isDeveloper=false, never trusts role/customerId from the client, and rolls
// back the Auth user if the profile write fails. Operates only inside this
// Firebase project (the company boundary).
// ───────────────────────────────────────────────────────────────────────
export const createStaffAccount = onCall(
  { timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    // assertAiAuthorized already enforces signed-in + active + CC and returns
    // the caller identity; re-assert against the fetched profile.
    const caller = await assertAiAuthorized(request);

    try {
      const callerSnap = await getDb().collection('users').doc(request.auth.uid).get();
      assertCallerIsCommander(callerSnap.exists ? callerSnap.data() : null);

      const input = normalizeStaffInput(request.data || {});
      const result = await provisionStaff(getAdminAuth(), getDb(), { uid: caller.uid }, input);
      // Only non-sensitive identity fields are returned — never password,
      // tokens, customerId or internal flags.
      return { uid: result.uid, email: result.email, role: result.role };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (err instanceof ProvisioningError) {
        // Map the domain error code to the matching callable status.
        const statusByCode = {
          'permission-denied': 'permission-denied',
          'invalid-argument': 'invalid-argument',
          'already-exists':    'already-exists',
          'internal':          'internal',
        };
        throw new HttpsError(statusByCode[err.code] || 'internal', err.message);
      }
      logger.error('Staff provisioning failed', { uid: request.auth?.uid, err: String(err) });
      throw new HttpsError('internal', 'Staff account create nahi ho paya.');
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// auditStaffLogins — READ ONLY. Kaunsa profile login kar sakta hai?
//    data: {}  →  [{ profileId, name, email, role, authExists,
//                    idMatchesAuth, canLogin, isActive }]
//
// Purane accounts sirf Firestore me bane the, Firebase Auth me nahi —
// unse login kabhi nahi hota tha (auth/invalid-credential). Ye callable
// bas batata hai kaun toota hua hai. Kuch badalta nahi.
// ───────────────────────────────────────────────────────────────────────
export const auditStaffLogins = onCall(
  { timeoutSeconds: 120, memory: '256MiB' },
  async (request) => {
    await assertAiAuthorized(request);
    try {
      const callerSnap = await getDb().collection('users').doc(request.auth.uid).get();
      assertCallerIsCommander(callerSnap.exists ? callerSnap.data() : null);
      return { rows: await auditStaffAccounts(getAdminAuth(), getDb()) };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (err instanceof ProvisioningError) {
        throw new HttpsError(err.code === 'permission-denied' ? 'permission-denied' : 'internal', err.message);
      }
      logger.error('Staff login audit failed', { uid: request.auth?.uid, err: String(err) });
      throw new HttpsError('internal', 'Audit nahi ho paya.');
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// repairStaffLogin — ek toote hue profile ko login-capable banata hai.
//    data: { profileId: string, password: string }
//
// Auth account nahi hai to banata hai; hai to password reset karta hai.
// Agar profile ka doc id auth uid se alag hai to profile ko sahi id par
// move karta hai aur purane ko deactivate kar deta hai (delete NAHI —
// history bachi rehni chahiye). Role/name/phone/assignedBatchIds preserve
// hote hain; isDeveloper hamesha false.
// ───────────────────────────────────────────────────────────────────────
export const repairStaffLogin = onCall(
  { timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    const caller = await assertAiAuthorized(request);
    try {
      const callerSnap = await getDb().collection('users').doc(request.auth.uid).get();
      assertCallerIsCommander(callerSnap.exists ? callerSnap.data() : null);

      const result = await repairStaffAccount(
        getAdminAuth(), getDb(), { uid: caller.uid }, request.data || {},
      );
      return result;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (err instanceof ProvisioningError) {
        const statusByCode = {
          'permission-denied': 'permission-denied',
          'invalid-argument': 'invalid-argument',
          'already-exists':    'already-exists',
          'internal':          'internal',
        };
        throw new HttpsError(statusByCode[err.code] || 'internal', err.message);
      }
      logger.error('Staff login repair failed', { uid: request.auth?.uid, err: String(err) });
      throw new HttpsError('internal', 'Repair nahi ho paya.');
    }
  },
);
