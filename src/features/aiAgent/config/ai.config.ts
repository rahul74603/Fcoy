// ═══════════════════════════════════════════════════════════════════════
// AI CONFIG
// ───────────────────────────────────────────────────────────────────────
// SECURITY NOTE
// ─────────────
// Anything prefixed with VITE_ is INLINED INTO THE BROWSER BUNDLE at build
// time and is visible to anyone who opens the deployed site. Secret cloud AI
// keys (Groq / Gemini / Pinecone) must therefore NOT be shipped as VITE_
// vars in production.
//
// Two safe modes:
//   1. (RECOMMENDED) AI proxy backend: set VITE_AI_PROXY_URL to the URL of a
//      small Cloud Function / server that holds the real keys and forwards
//      requests. The browser sends NO secret key.
//   2. Local ERP only: leave all cloud keys UNSET. The built-in local
//      command engine (fastPath) still answers ERP queries without any key.
//
// VITE_GROQ_API_KEY / VITE_GEMINI_API_KEY / VITE_PINECONE_API_KEY remain
// supported ONLY for local development / self-hosted single-owner setups
// where the operator accepts that the key ships in their own bundle. They
// are intentionally treated as opt-in and are never required.
// ═══════════════════════════════════════════════════════════════════════

const envList = (base: string, count = 5): string[] => {
  const values: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const key = i === 1 ? base : `${base}_${i}`;
    const value = import.meta.env[key];
    if (value) values.push(String(value));
  }
  return values;
};

export const AI_CONFIG = {
  // Optional REST-style proxy URL (alternative deployment). The PRIMARY
  // production path is Firebase Callable Functions (see aiBackend.client.ts),
  // which keep keys server-side and enforce auth + role.
  proxyUrl: (import.meta.env.VITE_AI_PROXY_URL as string | undefined) || '',

  // ── DEV-ONLY browser keys ─────────────────────────────────────────────
  // These are ONLY ever used when `browserKeysAllowed()` is true — i.e. a
  // local Vite dev server (import.meta.env.DEV) with the explicit opt-in
  // VITE_AI_ALLOW_BROWSER_KEYS=true. In a production build they are never
  // read/used; the deployed Cloud Functions supply the credentials.
  groqKeys: envList('VITE_GROQ_API_KEY'),
  geminiKeys: envList('VITE_GEMINI_API_KEY'),
  // 🔒 Pinecone credentials NEVER live in the client (the index is a secret
  // vector store). RAG always goes through the server callable functions.
  pineconeKey: '',
  pineconeHost: '',
  groqModel: import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile',
  // 'gemini-flash-latest' hamesha current stable flash model par point karta hai.
  // Purane pinned naam (2.0-flash, 2.5-flash-lite) retire ho chuke hain /
  // naye users ko nahi milte — isliye "latest" alias safest hai.
  // agentLoop me fallback ladder bhi hai agar ye bhi na chale.
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || 'gemini-flash-latest',
  enableLocalERP: import.meta.env.VITE_AI_ENABLE_LOCAL_ERP !== 'false',
  enableCache: import.meta.env.VITE_AI_ENABLE_CACHE !== 'false',
  enableGroq: import.meta.env.VITE_AI_ENABLE_GROQ !== 'false',
  enableGemini: import.meta.env.VITE_AI_ENABLE_GEMINI !== 'false',
  enablePinecone: import.meta.env.VITE_AI_ENABLE_PINECONE === 'true',
};

/**
 * Cloud AI is "secret-backed" only when either a proxy is configured or a
 * bundled dev key exists. Pinecone (secret vector DB) is NEVER usable from
 * the browser without a proxy — a bundled Pinecone key would expose the
 * whole index, so it is ignored unless a proxy is set.
 */
export const hasProxy = (): boolean => Boolean(AI_CONFIG.proxyUrl);

export const getAIHealth = () => ({
  localERP: AI_CONFIG.enableLocalERP,
  // Cloud providers are considered available when the deployed callable
  // functions are the path (production) OR a dev opted into browser keys.
  groq: AI_CONFIG.enableGroq,
  gemini: AI_CONFIG.enableGemini,
  // RAG requires server-side Pinecone (callable functions). A browser key is
  // never accepted.
  pinecone: AI_CONFIG.enablePinecone,
  proxy: hasProxy(),
  groqKeys: AI_CONFIG.groqKeys.length,
  geminiKeys: AI_CONFIG.geminiKeys.length,
});

export const hasAnyCloudAI = () => {
  const health = getAIHealth();
  return health.groq || health.gemini;
};
