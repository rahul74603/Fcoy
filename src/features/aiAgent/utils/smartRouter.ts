// ═══════════════════════════════════════════════════════════
// SMART ROUTER - The Brain of AI System 🧠
// ═══════════════════════════════════════════════════════════
// Ye decide karta hai ki user ke command ko kaha bhejna hai:
// 1. Quick Match (greetings) - 0ms
// 2. Cache (repeat queries) - 0ms
// 3. Groq AI (primary) - 500ms
// 4. Gemini AI (fallback) - 1500ms
// ═══════════════════════════════════════════════════════════

import { checkQuickResponse } from "./commandPatterns";
import { getCachedResponse, setCachedResponse } from "./cacheManager";
import { askGroq } from "../api/groqAgent.api";
import { askAI as askGemini } from "../api/aiAgent.api";
import type { AIResponse } from "../api/aiAgent.api";
import { searchPinecone } from "../scripts/syncToPinecone";
import { AI_CONFIG } from "../config/ai.config";

// ─────────────────────────────────────────────────────────
// ROUTE RESULT - kahan se aaya response
// ─────────────────────────────────────────────────────────
export interface RouteResult {
  response: AIResponse;
  source: "quick" | "cache" | "groq" | "gemini" | "error";
  responseTime: number; // milliseconds
  fallbackUsed: boolean;
}

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const CONFIG = {
  ENABLE_CACHE: AI_CONFIG.enableCache,
  ENABLE_QUICK_MATCH: true,
  ENABLE_LOCAL_ERP: AI_CONFIG.enableLocalERP,
  ENABLE_GROQ: AI_CONFIG.enableGroq,
  ENABLE_GEMINI_FALLBACK: AI_CONFIG.enableGemini,
  ENABLE_PINECONE: AI_CONFIG.enablePinecone,
  LOG_DETAILS: true,
};

// ─────────────────────────────────────────────────────────
// STATS - kitne queries har layer se gaye
// ─────────────────────────────────────────────────────────
let stats = {
  total: 0,
  quick: 0,
  cache: 0,
  groq: 0,
  gemini: 0,
  errors: 0,
  totalTime: 0,
};

function detectLocalIntent(message: string): AIResponse | null {
  const text = message.toLowerCase().trim();
  const hasAny = (...words: string[]) => words.some(w => text.includes(w));
  const chestMatch = text.match(/(?:chest|chest no|chest number|सीना|चेस्ट)\s*#?\s*(\d+)/i) || text.match(/\b(?:no|number)\s*(\d+)\b/i);

  if (chestMatch && hasAny('detail', 'details', 'profile', 'dikhao', 'batao', 'search', 'find', 'kaun')) {
    return { action: 'search', chestNo: chestMatch[1] };
  }

  if (hasAny('vendor due', 'vendor dues', 'vender due', 'vendors due', 'payment pending', 'vendor pending')) {
    return { action: 'get_summary', listType: 'vendor_due', filters: {} } as AIResponse;
  }

  if (hasAny('fund', 'balance', 'mess fund', 'training fund', 'general fund', 'company assets')) {
    const fundKey = text.includes('mess') ? 'mess_fund'
      : text.includes('training') ? 'training_fund'
      : text.includes('asset') ? 'company_assets_fund'
      : text.includes('general') ? 'general_fund'
      : undefined;
    return { action: 'get_summary', listType: 'finance', filters: { category: fundKey } } as AIResponse;
  }

  if (hasAny('fpt', 'physical', 'fitness')) {
    const status = hasAny('fail', 'failed', 'not pass', 'नापास') ? 'fail' : hasAny('pass', 'passed') ? 'pass' : undefined;
    return { action: 'get_list', listType: 'fpt', filters: { status } };
  }

  if (hasAny('weekly test', 'weapon test', 'test fail', 'test pass', 'wt ', 'exam')) {
    const status = hasAny('fail', 'failed', 'नापास') ? 'fail' : hasAny('pass', 'passed') ? 'pass' : undefined;
    return { action: 'get_list', listType: 'weekly', filters: { status } };
  }

  if (hasAny('hospital', 'admit')) {
    return { action: 'get_summary', listType: 'attendance', filters: { status: 'H' } } as AIResponse;
  }
  if (hasAny('sick', 'mi room', 'medical case')) {
    return { action: 'get_summary', listType: 'attendance', filters: { status: 'S' } } as AIResponse;
  }
  if (hasAny('rest', 'b rest', 'c rest', 'light duty')) {
    return { action: 'get_summary', listType: 'attendance', filters: { status: 'R' } } as AIResponse;
  }
  if (hasAny('absent', 'away', 'not on field', 'field par nahi')) {
    return { action: 'get_summary', listType: 'attendance', filters: { status: 'not_present' } } as AIResponse;
  }
  if (hasAny('present', 'strength', 'attendance')) {
    return { action: 'get_summary', listType: 'attendance', filters: {} } as AIResponse;
  }

  if (hasAny('trainee list', 'trainees list', 'all trainees', 'list dikhao', 'sare trainee')) {
    return { action: 'get_list', listType: 'trainees', filters: {} };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION - smart routing logic
// ═══════════════════════════════════════════════════════════
export async function smartRoute(userMessage: string): Promise<RouteResult> {
  const startTime = Date.now();
  stats.total++;

  if (CONFIG.LOG_DETAILS) {
    console.log(`\n┌─────────────────────────────────────`);
    console.log(`│ 🎯 SMART ROUTER: "${userMessage}"`);
    console.log(`└─────────────────────────────────────`);
  }

  // ═══════════════════════════════════════════════
  // LAYER 1: QUICK MATCH (Greetings, Help, etc.)
  // ═══════════════════════════════════════════════
  if (CONFIG.ENABLE_QUICK_MATCH) {
    const quickResult = checkQuickResponse(userMessage);
    
    if (quickResult.matched) {
      const responseTime = Date.now() - startTime;
      stats.quick++;
      stats.totalTime += responseTime;
      
      if (CONFIG.LOG_DETAILS) {
        console.log(`✅ LAYER 1 HIT: Quick Match (${responseTime}ms)`);
      }
      
      return {
        response: {
          action: quickResult.action || "greeting",
          reply: quickResult.reply,
        },
        source: "quick",
        responseTime,
        fallbackUsed: false,
      };
    }
  }

  // ═══════════════════════════════════════════════
  // LAYER 1.5: LOCAL ERP INTENT (exact Firebase queries, no API needed)
  // ═══════════════════════════════════════════════
  const localIntent = CONFIG.ENABLE_LOCAL_ERP ? detectLocalIntent(userMessage) : null;
  if (localIntent) {
    const responseTime = Date.now() - startTime;
    stats.quick++;
    stats.totalTime += responseTime;
    if (CONFIG.LOG_DETAILS) console.log(`✅ LAYER 1.5 HIT: Local ERP Intent (${responseTime}ms)`, localIntent);
    return {
      response: localIntent,
      source: "quick",
      responseTime,
      fallbackUsed: false,
    };
  }

  // ═══════════════════════════════════════════════
  // LAYER 2: CACHE CHECK
  // ═══════════════════════════════════════════════
  if (CONFIG.ENABLE_CACHE) {
    const cached = getCachedResponse(userMessage);
    
    if (cached) {
      const responseTime = Date.now() - startTime;
      stats.cache++;
      stats.totalTime += responseTime;
      
      if (CONFIG.LOG_DETAILS) {
        console.log(`✅ LAYER 2 HIT: Cache (${responseTime}ms)`);
      }
      
      return {
        response: cached,
        source: "cache",
        responseTime,
        fallbackUsed: false,
      };
    }
  }

 // ═══════════════════════════════════════════════
  // LAYER 3: GROQ AI (Primary)
  // ═══════════════════════════════════════════════
  if (CONFIG.ENABLE_GROQ && AI_CONFIG.groqKeys.length > 0) {
    try {
      if (CONFIG.LOG_DETAILS) {
        console.log(`🧠 LAYER 3: Trying Groq...`);
      }
      
      // Optional RAG: Pinecone configured ho to relevant data lao, warna direct Groq chalao
      const relevantData = CONFIG.ENABLE_PINECONE ? await searchPinecone(userMessage) : "";
      if (CONFIG.LOG_DETAILS) {
        console.log("🔍 Pinecone se ye data mila:", relevantData);
      }

      const groqResponse = await askGroq(userMessage, relevantData);
      const responseTime = Date.now() - startTime;
      stats.groq++;
      stats.totalTime += responseTime;
      
      // Cache mein save karo (sirf safe actions)
      if (CONFIG.ENABLE_CACHE) {
        setCachedResponse(userMessage, groqResponse);
      }
      
      if (CONFIG.LOG_DETAILS) {
        console.log(`✅ LAYER 3 HIT: Groq (${responseTime}ms)`);
      }
      
      return {
        response: groqResponse,
        source: "groq",
        responseTime,
        fallbackUsed: false,
      };
    } catch (groqError: any) {
      if (CONFIG.LOG_DETAILS) {
        console.warn(`⚠️ LAYER 3 FAIL: Groq error - ${groqError.message}`);
        console.log(`🔄 Falling back to Gemini...`);
      }
      
      // Groq fail ho gaya - Gemini try karo
      if (!CONFIG.ENABLE_GEMINI_FALLBACK) {
        stats.errors++;
        throw groqError;
      }
    }
  }

  // ═══════════════════════════════════════════════
  // LAYER 4: GEMINI AI (Fallback)
  // ═══════════════════════════════════════════════
  if (CONFIG.ENABLE_GEMINI_FALLBACK && AI_CONFIG.geminiKeys.length > 0) {
    try {
      if (CONFIG.LOG_DETAILS) {
        console.log(`🔄 LAYER 4: Trying Gemini fallback...`);
      }
      
      const geminiResponse = await askGemini(userMessage);
      const responseTime = Date.now() - startTime;
      stats.gemini++;
      stats.totalTime += responseTime;
      
      // Cache mein save karo
      if (CONFIG.ENABLE_CACHE) {
        setCachedResponse(userMessage, geminiResponse);
      }
      
      if (CONFIG.LOG_DETAILS) {
        console.log(`✅ LAYER 4 HIT: Gemini (${responseTime}ms)`);
      }
      
      return {
        response: geminiResponse,
        source: "gemini",
        responseTime,
        fallbackUsed: true,
      };
    } catch (geminiError: any) {
      const responseTime = Date.now() - startTime;
      stats.errors++;
      
      if (CONFIG.LOG_DETAILS) {
        console.error(`❌ LAYER 4 FAIL: Gemini error - ${geminiError.message}`);
      }
      
      // Dono fail ho gaye - friendly error return karo
      return {
        response: {
          action: "unknown",
          reply: `❌ AI abhi busy hai. Thoda wait karke try karo.\n\n💡 Tips:\n• 1 minute baad try karein\n• Simple command use karein\n• Internet check karein`,
        },
        source: "error",
        responseTime,
        fallbackUsed: true,
      };
    }
  }

  // Ye case kabhi nahi aana chahiye
  stats.errors++;
  return {
    response: {
      action: "unknown",
      reply: "❌ Koi AI service available nahi hai. Configuration check karein.",
    },
    source: "error",
    responseTime: Date.now() - startTime,
    fallbackUsed: false,
  };
}

// ═══════════════════════════════════════════════════════════
// HELPER: Router stats dekho
// ═══════════════════════════════════════════════════════════
export function getRouterStats() {
  const avgTime = stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0;
  const cacheHitRate = stats.total > 0 
    ? Math.round(((stats.quick + stats.cache) / stats.total) * 100) 
    : 0;
  
  return {
    total: stats.total,
    breakdown: {
      quick: stats.quick,
      cache: stats.cache,
      groq: stats.groq,
      gemini: stats.gemini,
      errors: stats.errors,
    },
    percentages: {
      quick: stats.total ? Math.round((stats.quick / stats.total) * 100) : 0,
      cache: stats.total ? Math.round((stats.cache / stats.total) * 100) : 0,
      groq: stats.total ? Math.round((stats.groq / stats.total) * 100) : 0,
      gemini: stats.total ? Math.round((stats.gemini / stats.total) * 100) : 0,
    },
    avgResponseTime: avgTime,
    cacheHitRate: cacheHitRate + "%",
    apiCallsSaved: stats.quick + stats.cache, // free requests
  };
}

// ═══════════════════════════════════════════════════════════
// HELPER: Stats reset karo (testing ke liye)
// ═══════════════════════════════════════════════════════════
export function resetStats() {
  stats = {
    total: 0,
    quick: 0,
    cache: 0,
    groq: 0,
    gemini: 0,
    errors: 0,
    totalTime: 0,
  };
  console.log("📊 Router stats reset");
}

// ═══════════════════════════════════════════════════════════
// HELPER: Stats nicely print karo
// ═══════════════════════════════════════════════════════════
export function printStats() {
  const s = getRouterStats();
  
  console.log("\n═══════════════════════════════════════");
  console.log("📊 SMART ROUTER STATISTICS");
  console.log("═══════════════════════════════════════");
  console.log(`Total Queries: ${s.total}`);
  console.log(`\nBreakdown:`);
  console.log(`  ⚡ Quick Match: ${s.breakdown.quick} (${s.percentages.quick}%)`);
  console.log(`  💾 Cache Hit:   ${s.breakdown.cache} (${s.percentages.cache}%)`);
  console.log(`  🧠 Groq AI:     ${s.breakdown.groq} (${s.percentages.groq}%)`);
  console.log(`  🔄 Gemini:      ${s.breakdown.gemini} (${s.percentages.gemini}%)`);
  console.log(`  ❌ Errors:      ${s.breakdown.errors}`);
  console.log(`\nPerformance:`);
  console.log(`  ⚡ Avg Time: ${s.avgResponseTime}ms`);
  console.log(`  💰 Free Queries: ${s.apiCallsSaved}/${s.total} (${s.cacheHitRate})`);
  console.log("═══════════════════════════════════════\n");
}

// ═══════════════════════════════════════════════════════════
// HELPER: Configuration change karo runtime mein
// ═══════════════════════════════════════════════════════════
export function configureRouter(options: Partial<typeof CONFIG>) {
  Object.assign(CONFIG, options);
  console.log("⚙️ Router config updated:", CONFIG);
}