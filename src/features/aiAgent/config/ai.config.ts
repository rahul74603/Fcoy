export const envList = (base: string, count = 5): string[] => {
  const values: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const key = i === 1 ? base : `${base}_${i}`;
    const value = import.meta.env[key];
    if (value) values.push(String(value));
  }
  return values;
};

export const AI_CONFIG = {
  groqKeys: envList('VITE_GROQ_API_KEY'),
  geminiKeys: envList('VITE_GEMINI_API_KEY'),
  pineconeKey: import.meta.env.VITE_PINECONE_API_KEY || '',
  pineconeHost: import.meta.env.VITE_PINECONE_HOST || '',
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

export const getAIHealth = () => ({
  localERP: AI_CONFIG.enableLocalERP,
  groq: AI_CONFIG.enableGroq && AI_CONFIG.groqKeys.length > 0,
  gemini: AI_CONFIG.enableGemini && AI_CONFIG.geminiKeys.length > 0,
  pinecone: AI_CONFIG.enablePinecone && Boolean(AI_CONFIG.pineconeKey && AI_CONFIG.pineconeHost),
  groqKeys: AI_CONFIG.groqKeys.length,
  geminiKeys: AI_CONFIG.geminiKeys.length,
});

export const hasAnyCloudAI = () => {
  const health = getAIHealth();
  return health.groq || health.gemini;
};
