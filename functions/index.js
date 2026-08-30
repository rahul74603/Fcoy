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

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError, defineSecret } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

initializeApp();
const db = getFirestore();

// ── Secrets (values live in Google Secret Manager, never in the repo) ──
const GROQ_API_KEY      = defineSecret('GROQ_API_KEY');
const GEMINI_API_KEY    = defineSecret('GEMINI_API_KEY');
const PINECONE_API_KEY  = defineSecret('PINECONE_API_KEY');
const PINECONE_HOST     = defineSecret('PINECONE_HOST');

// Non-secret runtime config (defaults are safe).
const GROQ_MODEL   = process.env.GROQ_MODEL   || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// AI assistant is the Commander's tool. Keep server policy explicit.
const AI_ROLE = (process.env.AI_ALLOWED_ROLE || 'Company Commander').trim();

const GROQ_SECRETS    = [GROQ_API_KEY];
const GEMINI_SECRETS  = [GEMINI_API_KEY];
const PINECONE_SECRETS = [PINECONE_API_KEY, PINECONE_HOST];

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
    snap = await db.collection('users').doc(uid).get();
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
export const aiGroq = onCall(
  { secrets: GROQ_SECRETS, timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    await assertAiAuthorized(request);

    const { messages, temperature = 0.1, maxTokens = 1000, responseFormat } =
      request.data || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'messages[] is required.');
    }

    const key = process.env.GROQ_API_KEY;
    if (!key) throw safeError('failed-precondition', 'Groq is not configured on the server.');

    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: Number(temperature) || 0.1,
          max_tokens: Number(maxTokens) || 1000,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        // Strip anything that could contain the key (it won't, but be safe).
        throw safeError('unavailable', `Groq provider error (${resp.status}).`, new Error(txt.slice(0, 200)));
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      // Return only the assistant content — never headers/keys.
      return { content, model: GROQ_MODEL };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw safeError('unavailable', 'Groq request failed.', err);
    }
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

    const key = process.env.GEMINI_API_KEY;
    if (!key) throw safeError('failed-precondition', 'Gemini is not configured on the server.');

    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}` +
        `:generateContent?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(generationConfig ? { generationConfig } : {}),
          ...(systemInstruction ? { systemInstruction } : {}),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw safeError('unavailable', `Gemini provider error (${resp.status}).`, new Error(txt.slice(0, 200)));
      }
      // Return the provider JSON body (it contains no secret — the key was
      // only in the URL).
      return await resp.json();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw safeError('unavailable', 'Gemini request failed.', err);
    }
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
