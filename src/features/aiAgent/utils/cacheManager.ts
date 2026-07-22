// ═══════════════════════════════════════════════════════════
// CACHE MANAGER - Pehle pucha hua sawal yaad rakhta hai
// ═══════════════════════════════════════════════════════════
// Kaam: User ne agar same query pehle puchi hai, to API call
// kiye bina hi answer de dega. Speed bhi fast, quota bhi save!
// ═══════════════════════════════════════════════════════════

// Cache mein har entry kaisi hogi
interface CacheEntry {
  query: string;           // User ne kya pucha tha
  response: any;           // AI ne kya jawab diya tha
  timestamp: number;       // Kab cache hua tha
  hitCount: number;        // Kitni baar use hua
}

// ─────────────────────────────────────────────────────────
// CONFIG - Cache ke rules
// ─────────────────────────────────────────────────────────
const CACHE_KEY = "ai_agent_cache_v1";          // LocalStorage key
const MAX_CACHE_SIZE = 100;                      // Max 100 queries store
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;   // 24 ghante baad expire
const CACHEABLE_ACTIONS = ["get_list", "unknown"]; // Sirf ye actions cache honge

// ─────────────────────────────────────────────────────────
// HELPER: Query ko normalize karo (case + spaces fix)
// ─────────────────────────────────────────────────────────
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()           // Sab small letters
    .trim()                  // Aage peeche ke spaces hatao
    .replace(/\s+/g, " ");   // Multiple spaces ko ek karo
}

// ─────────────────────────────────────────────────────────
// CACHE READ - LocalStorage se cache padho
// ─────────────────────────────────────────────────────────
function readCache(): CacheEntry[] {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (err) {
    // Agar cache corrupt ho gaya to khali kar do
    console.warn("Cache corrupt tha, clear kar diya");
    localStorage.removeItem(CACHE_KEY);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// CACHE WRITE - LocalStorage mein cache save karo
// ─────────────────────────────────────────────────────────
function writeCache(entries: CacheEntry[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch (err) {
    // LocalStorage full ho gaya to old entries delete karo
    console.warn("LocalStorage full, purani entries delete kar rahe hain");
    const reduced = entries.slice(-50); // Sirf last 50 rakho
    localStorage.setItem(CACHE_KEY, JSON.stringify(reduced));
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION 1: Cache se response dhundo
// ═══════════════════════════════════════════════════════════
export function getCachedResponse(query: string): any | null {
  const normalized = normalizeQuery(query);
  const cache = readCache();
  const now = Date.now();

  // Cache mein query dhundo
  const entry = cache.find((e) => e.query === normalized);

  // Nahi mili to null return
  if (!entry) return null;

  // Mili lekin expire ho gayi to delete karo
  if (now - entry.timestamp > CACHE_EXPIRY_MS) {
    const filtered = cache.filter((e) => e.query !== normalized);
    writeCache(filtered);
    return null;
  }

  // Mili aur valid hai - hit count badhao
  entry.hitCount += 1;
  writeCache(cache);

  console.log(`✅ Cache HIT: "${query}" (used ${entry.hitCount} times)`);
  return entry.response;
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION 2: Response ko cache mein save karo
// ═══════════════════════════════════════════════════════════
export function setCachedResponse(query: string, response: any): void {
  // Pehle check karo ki ye action cache hone layak hai ya nahi
  if (!response?.action || !CACHEABLE_ACTIONS.includes(response.action)) {
    // Add/Update/Delete waale actions cache mat karo
    // Kyunki har baar fresh data chahiye
    return;
  }

  const normalized = normalizeQuery(query);
  let cache = readCache();

  // Agar already hai to remove karo (update karenge)
  cache = cache.filter((e) => e.query !== normalized);

  // Naya entry add karo
  cache.push({
    query: normalized,
    response: response,
    timestamp: Date.now(),
    hitCount: 0,
  });

  // Agar size limit cross ho gayi to oldest delete karo
  if (cache.length > MAX_CACHE_SIZE) {
    cache = cache.slice(-MAX_CACHE_SIZE);
  }

  writeCache(cache);
  console.log(`💾 Cached: "${query}"`);
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION 3: Cache clear karo (settings ya debug ke liye)
// ═══════════════════════════════════════════════════════════
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
  console.log("🗑️ Cache clear ho gaya");
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION 4: Cache stats dekho (debug ke liye)
// ═══════════════════════════════════════════════════════════
export function getCacheStats() {
  const cache = readCache();
  const totalHits = cache.reduce((sum, e) => sum + e.hitCount, 0);
  const oldestEntry = cache[0]?.timestamp || Date.now();
  const newestEntry = cache[cache.length - 1]?.timestamp || Date.now();

  return {
    totalEntries: cache.length,
    totalHits: totalHits,
    maxSize: MAX_CACHE_SIZE,
    oldestEntryAge: Math.floor((Date.now() - oldestEntry) / 1000 / 60), // minutes
    newestEntryAge: Math.floor((Date.now() - newestEntry) / 1000 / 60), // minutes
    topQueries: [...cache]
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 5)
      .map((e) => ({ query: e.query, hits: e.hitCount })),
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION 5: Specific query ko cache se hatao
// ═══════════════════════════════════════════════════════════
export function invalidateCache(query: string): void {
  const normalized = normalizeQuery(query);
  const cache = readCache();
  const filtered = cache.filter((e) => e.query !== normalized);
  writeCache(filtered);
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION 6: Saare related caches hatao
// (jaise trainee add hua to "list dikhao" wala cache hatao)
// ═══════════════════════════════════════════════════════════
export function invalidateRelatedCaches(action: string): void {
  // Jab koi add/update/delete ho to list waale cache delete karo
  if (
    action === "add_trainee" ||
    action === "update_trainee" ||
    action === "apply_leave" ||
    action === "add_document"
  ) {
    const cache = readCache();
    const filtered = cache.filter((e) => {
      // List, count, stats waale queries hatao
      const q = e.query;
      return !(
        q.includes("list") ||
        q.includes("dikha") ||
        q.includes("show") ||
        q.includes("count") ||
        q.includes("kitne") ||
        q.includes("total")
      );
    });
    writeCache(filtered);
    console.log(`🔄 Related caches cleared (${cache.length - filtered.length} removed)`);
  }
}