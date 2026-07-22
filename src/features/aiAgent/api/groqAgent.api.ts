// ═══════════════════════════════════════════════════════════
// GROQ AI INTEGRATION - Main Brain of the System 🧠
// ═══════════════════════════════════════════════════════════

import { getSchemaForAI } from "../schemas/collections.schema";

export interface GroqResponse {
  action: string;
  names?: string[];
  chestNo?: string;
  reason?: string;
  leaveType?: string;
  collectionName?: string;
  data?: any;
  updates?: any;
  reply?: string;
  query?: string;
  // ✅ NAYA: filters ab properly typed hai
  filters?: {
    status?: string;          // "fail" | "pass" | "absent" | "present"
    leaveType?: string;       // "medical" | "casual" | "emergency"
    testType?: string;        // "fpt" | "weekly" | "final"
    subject?: string;         // "running" | "pushups" | "situps" etc
    date?: string;            // YYYY-MM-DD
    fromDate?: string;
    toDate?: string;
    category?: string;        // "GEN" | "OBC" | "SC" | "ST"
    gender?: string;          // "M" | "F"
    bloodGroup?: string;
    [key: string]: any;
  };
  listType?: string;          // ✅ NAYA: "trainees" | "fpt" | "absent" | "leave" | "medical"
  multiple?: any[];
}

// ─────────────────────────────────────────────────────────
// API KEYS
// ─────────────────────────────────────────────────────────
const API_KEYS: string[] = [
  import.meta.env.VITE_GROQ_API_KEY,
  import.meta.env.VITE_GROQ_API_KEY_2,
  import.meta.env.VITE_GROQ_API_KEY_3,
  import.meta.env.VITE_GROQ_API_KEY_4,
  import.meta.env.VITE_GROQ_API_KEY_5,
].filter(Boolean);

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

let lastUsedKeyIndex = -1;

function pickKeyIndex(): number {
  if (API_KEYS.length === 1) return 0;
  let idx: number;
  do {
    idx = Math.floor(Math.random() * API_KEYS.length);
  } while (idx === lastUsedKeyIndex);
  lastUsedKeyIndex = idx;
  return idx;
}

async function groqFetch(messages: any[]): Promise<any> {
  if (API_KEYS.length === 0) {
    throw new Error("Koi Groq API key set nahi hai! .env check karo.");
  }

  const triedKeys = new Set<number>();

  while (triedKeys.size < API_KEYS.length) {
    const idx = pickKeyIndex();
    if (triedKeys.has(idx)) continue;
    triedKeys.add(idx);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEYS[idx]}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.1,
          max_tokens: 1000,
          response_format: { type: "json_object" },
        }),
      });

      if (response.status === 429) {
        console.warn(`🔑 Key #${idx + 1} rate limited - next try...`);
        continue;
      }
      if (response.status === 401) {
        console.error(`❌ Key #${idx + 1} INVALID`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Groq API Error ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Groq via Key #${idx + 1}`);
      return data;
    } catch (err: any) {
      console.warn(`⚠️ Key #${idx + 1} failed: ${err.message}`);
      if (triedKeys.size >= API_KEYS.length) throw err;
    }
  }

  throw new Error("Saari Groq keys ki limit khatam!");
}

// ═══════════════════════════════════════════════════════════
// ✅ UPDATED SYSTEM PROMPT - FPT + Filters properly added
// ═══════════════════════════════════════════════════════════
function buildSystemPrompt(firebaseBlueprint: string = ""): string {
  const schemaInfo = getSchemaForAI();

  return `Tu ek Smart Training Center Management AI Assistant hai (BSF Training Center ke liye).

Tera kaam: User ke commands ko samjho aur SIRF valid JSON return karo. Koi extra text nahi.

${schemaInfo}
${firebaseBlueprint ? `\nDATABASE DATA (Ye tere reference ke liye hai):\n${firebaseBlueprint}\n` : ""}

═══════════════════════════════════════════════════════════
🎯 AVAILABLE ACTIONS
═══════════════════════════════════════════════════════════

1️⃣ ADD TRAINEE
{"action": "add_trainee", "names": ["Rahul", "Ravi"]}

2️⃣ UPDATE TRAINEE
{"action": "update_trainee", "chestNo": "5", "updates": {"age": "25"}}

Field mapping:
- age, height, weight, bloodGroup, fatherName, aadharNo
- emergencyContact, emergencyContactName, district, education
- category, gender, dressSize, attn (P/A/L)

3️⃣ APPLY LEAVE
{"action": "apply_leave", "chestNo": "30", "reason": "hospital", "leaveType": "medical"}

Leave types: medical, casual, emergency, general

4️⃣ GET LIST - ⚠️ ZAROOR listType aur filters daal
{"action": "get_list", "listType": "trainees", "filters": {}}

listType values:
- "trainees"   → saare trainees
- "fpt"        → FPT test records
- "weekly"     → weekly test records  
- "absent"     → absent records
- "leave"      → leave records
- "medical"    → medical/MI room records

filters object ke andar:
- "status": "fail" | "pass" | "absent" | "present"
- "testType": "fpt" | "weekly" | "final"
- "subject": "running" | "pushups" | "situps" | "long_jump" | "high_jump"
- "leaveType": "medical" | "casual" | "emergency"
- "date": "YYYY-MM-DD"
- "fromDate": "YYYY-MM-DD"
- "toDate": "YYYY-MM-DD"

═══════════════════════════════════════════════════════
🔥 GET_LIST EXAMPLES - Dhyan se padho!
═══════════════════════════════════════════════════════

"list dikhao" →
{"action": "get_list", "listType": "trainees", "filters": {}}

"fpt fail list dikhao" →
{"action": "get_list", "listType": "fpt", "filters": {"status": "fail"}}

"fpt pass list" →
{"action": "get_list", "listType": "fpt", "filters": {"status": "pass"}}

"fail wale dikhao" →
{"action": "get_list", "listType": "fpt", "filters": {"status": "fail"}}

"running mein fail kaun" →
{"action": "get_list", "listType": "fpt", "filters": {"status": "fail", "subject": "running"}}

"aaj ke absent" →
{"action": "get_list", "listType": "absent", "filters": {"date": "TODAY"}}

"medical leave wale" →
{"action": "get_list", "listType": "leave", "filters": {"leaveType": "medical"}}

"weekly test fail" →
{"action": "get_list", "listType": "weekly", "filters": {"status": "fail"}}

"pass ho gaye kaun" →
{"action": "get_list", "listType": "fpt", "filters": {"status": "pass"}}

"absent trainees aaj" →
{"action": "get_list", "listType": "absent", "filters": {"date": "TODAY"}}

5️⃣ SEARCH
{"action": "search", "query": "chest 5 detail", "chestNo": "5"}

6️⃣ ADD DOCUMENT
{"action": "add_document", "collectionName": "vendors", "data": {}}

7️⃣ MULTI ACTION
{"action": "multi", "multiple": [...]}

8️⃣ DIRECT DATABASE ANSWER (Agar database blueprint me data hai, jaise Mess Fund, Inventory, etc.)
{"action": "direct_answer", "reply": "Mess fund ka balance 3490 hai."}

9️⃣ UNKNOWN
{"action": "unknown", "reply": "Samajh nahi aaya, try: 'fpt fail list dikhao'"}

═══════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════
⚠️ STRICT RULES
═══════════════════════════════════════════════════════════

1. SIRF JSON return kar
2. chestNo HAMESHA string: "5" not 5
3. get_list mein HAMESHA listType daal
4. get_list mein HAMESHA filters object daal (khali {} bhi theek hai)
5. "fail", "faail", "flop", "nahi pass" → status: "fail"
6. "pass", "clear", "ho gaya" → status: "pass"
7. "fpt", "physical", "fitness test" → listType: "fpt"
8. "absent", "gaayab", "nahi aaya" → listType: "absent"
9. "leave", "chhutti" → listType: "leave"
10. TODAY literal string use karo jab aaj ki date chahiye
11. Agar user aisi cheez puche (jaise mess fund) jo get_list ya add me nahi hai, to DATABASE DATA (blueprint) me check kar aur "direct_answer" action ke sath "reply" me direct answer de.

YAAD RAKH: SIRF VALID JSON! 🎯`;
}

export async function askGroq(userMessage: string, firebaseBlueprint: string = ""): Promise<GroqResponse> {
  console.log(`🧠 Groq: "${userMessage}"`);

  const messages = [
    { role: "system", content: buildSystemPrompt(firebaseBlueprint) },
    { role: "user", content: userMessage },
  ];

  const data = await groqFetch(messages);
  const text = data.choices?.[0]?.message?.content || "";

  if (!text) throw new Error("Groq ne empty response diya");

  console.log("📥 Groq raw:", text);

  try {
    const parsed = JSON.parse(text);
    console.log("✅ Parsed:", parsed);
    return parsed;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Valid JSON nahi mila");
    return JSON.parse(jsonMatch[0]);
  }
}

export async function checkGroqHealth() {
  if (API_KEYS.length === 0) {
    return { status: "error" as const, message: "No API keys", keysCount: 0 };
  }
  try {
    const start = Date.now();
    const response = await askGroq("hello test");
    return {
      status: "healthy" as const,
      message: `Working! ${Date.now() - start}ms`,
      keysCount: API_KEYS.length,
    };
  } catch (err: any) {
    return { status: "error" as const, message: err.message, keysCount: API_KEYS.length };
  }
}

export function getGroqStats() {
  return {
    keysAvailable: API_KEYS.length,
    model: MODEL,
    maxRequestsPerDay: API_KEYS.length * 14400,
    apiUrl: GROQ_API_URL,
  };
}