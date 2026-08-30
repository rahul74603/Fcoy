// ═══════════════════════════════════════════════════
// gemini.service.ts
// Ye file Gemini AI se baat karti hai
// User ka message bhejti hai aur JSON action wapas leti hai
// ═══════════════════════════════════════════════════

import { getSchemaForAI } from "../schemas/collections.schema";
import { db } from "../../../config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { AI_CONFIG } from "../config/ai.config";
import { callGemini, browserKeysAllowed } from "./aiBackend.client";

// ─────────────────────────────────────────
// ACTION RESULT TYPE — har action ka result
// ─────────────────────────────────────────
export interface ActionResult {
  success: boolean;
  message: string;
  details?: string;
}

// ─────────────────────────────────────────
// AI RESPONSE TYPE — Gemini kya return karta hai
// ─────────────────────────────────────────
export interface AIResponse {
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

  // ✅ LIST FILTERS
  listType?: string;        // "trainees" | "fpt" | "absent" | "leave" | "weekly" | "medical"
  filters?: {
    status?: string;        // "fail" | "pass"
    leaveType?: string;     // "medical" | "casual" | "emergency"
    testType?: string;      // "fpt" | "weekly"
    subject?: string;
    date?: string;          // YYYY-MM-DD | "TODAY"
    fromDate?: string;
    toDate?: string;
    category?: string;
    gender?: string;
    bloodGroup?: string;
    [key: string]: any;
  };
  multiple?: any[];
}

// ═══════════════════════════════════════════════════
// MULTIPLE API KEYS — har key ki apni quota hoti hai
// .env mein aise daalo:
// VITE_GEMINI_API_KEY=key1
// VITE_GEMINI_API_KEY_2=key2
// VITE_GEMINI_API_KEY_3=key3
// VITE_GEMINI_API_KEY_4=key4
// VITE_GEMINI_API_KEY_5=key5
// ═══════════════════════════════════════════════════
const API_KEYS: string[] = AI_CONFIG.geminiKeys;

const MODEL = AI_CONFIG.geminiModel;

const buildUrl = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// Last use hui key yaad rakho
let lastUsedKeyIndex = -1;

// ─────────────────────────────────────────
// RANDOM KEY PICKER — last wali key avoid karo
// ─────────────────────────────────────────
function pickKeyIndex(): number {
  if (API_KEYS.length === 1) return 0;
  let idx: number;
  do {
    idx = Math.floor(Math.random() * API_KEYS.length);
  } while (idx === lastUsedKeyIndex);
  lastUsedKeyIndex = idx;
  return idx;
}

// ═══════════════════════════════════════════════════
// SMART FETCH — 429 aaye to dusri key try karo
// ═══════════════════════════════════════════════════
async function geminiFetch(body: any): Promise<any> {
  // 🔒 PRODUCTION PATH: Firebase Callable Function holds the key server-side.
  try {
    return await callGemini({
      contents: body?.contents,
      generationConfig: body?.generationConfig,
      systemInstruction: body?.systemInstruction,
    });
  } catch (e: any) {
    const code = e?.code || '';
    if (code === 'functions/permission-denied' || code === 'functions/unauthenticated'
        || /permission-denied|unauthenticated/i.test(String(e?.message))) {
      throw new Error('Authorization: AI sirf Company Commander use kar sakta hai.');
    }
    console.warn('Backend Gemini call unavailable:', e?.message ?? e);
  }

  // DEV-ONLY PATH: bundled browser key only with explicit local-dev opt-in.
  if (browserKeysAllowed() && AI_CONFIG.proxyUrl) {
    const response = await fetch(`${AI_CONFIG.proxyUrl.replace(/\/$/, "")}/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, ...body }),
    });
    if (!response.ok) throw new Error(`Gemini proxy error ${response.status}`);
    return response.json();
  }

  if (browserKeysAllowed() && API_KEYS.length > 0) {
    return geminiFetchWithBrowserKey(body);
  }

  throw new Error(
    "Cloud AI configured nahi hai. Backend functions deploy karein " +
    "(local ERP commands bina cloud AI ke chalti hain).",
  );
}

async function geminiFetchWithBrowserKey(body: any): Promise<any> {
  const triedKeys = new Set<number>();

  while (triedKeys.size < API_KEYS.length) {
    const idx = pickKeyIndex();
    if (triedKeys.has(idx)) continue;
    triedKeys.add(idx);

    try {
      const response = await fetch(buildUrl(API_KEYS[idx]), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // 429 = rate limit → agli key try karo
      if (response.status === 429) {
        console.warn(
          `⚠️ Key #${idx + 1} ki limit khatam — dusri key try kar rahe hain...`
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status}`);
      }

      return await response.json();

    } catch (err: any) {
      if (triedKeys.size >= API_KEYS.length) throw err;
      console.warn(`⚠️ Key #${idx + 1} fail (${err.message}) — agli try...`);
    }
  }

  throw new Error("Sab API keys ki limit khatam! Thodi der baad try karo. 🕐");
}

// ═══════════════════════════════════════════════════
// MAIN AI FUNCTION — user ka message lo, action wapas do
// ═══════════════════════════════════════════════════
export async function askAI(userMessage: string): Promise<AIResponse> {
  const schemaInfo = getSchemaForAI();

  const prompt = `
Tu ek Training Center Management AI hai.
Tu sirf JSON return karega, kuch aur nahi.

${schemaInfo}

=== TU YE ACTIONS LE SAKTA HAI ===

1. Trainee add karna:
{"action": "add_trainee", "names": ["Rahul", "Ravi"]}

2. Trainee update karna:
{"action": "update_trainee", "chestNo": "5", "updates": {"age": "25", "bloodGroup": "B+"}}

3. Leave lagana:
{"action": "apply_leave", "chestNo": "30", "reason": "hospital", "leaveType": "medical"}

4. List dekhna:
{"action": "get_list"}

5. Kisi bhi collection mein data add karna:
{"action": "add_document", "collectionName": "weeklyPrograms", "data": {"weekNumber": 1, "subject": "PT"}}

6. Agar kuch samajh na aaye:
{"action": "unknown", "reply": "Samajh nahi aaya, please dobara likhein"}

=== USER NE LIKHA ===
"${userMessage}"

=== RULES ===
- Sirf JSON return karo
- Hindi aur English dono samjho
- Chest number hamesha string mein rakho jaise "5" na ki 5
- Koi extra text mat likho, sirf JSON

JSON:
`;

  const data = await geminiFetch({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1000,
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI ne sahi format mein reply nahi diya");
  }

  return JSON.parse(jsonMatch[0]);
}

// ═══════════════════════════════════════════════════
// IMAGE SE WEEKLY PROGRAM EXTRACT KARNE WALA FUNCTION
// ═══════════════════════════════════════════════════
export async function extractWeeklyProgramFromImage(
  imageFile: File
): Promise<any> {
  // ── Image ko base64 me convert karo ──
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.readAsDataURL(imageFile);
  });

  const prompt = `
You are reading a BSF Weekly Training Programme table from an image.
Table ko DHYAAN se padho. Galat data mat banao.

=== TABLE STRUCTURE ===
Image me ek table hai jisme ye columns hain (left to right):
1. DAY & DATE      → Konsa din aur date
2. TIME            → Period ka time (jaise 0530-0650)
3. CODE            → Subject ka short code (PT-2, D-14, LMG-3, etc.)
4. PERIODS         → Kitne period (number)
5. SUBJECT         → Pura subject name
6. METHOD          → LEC / PRAC / LEC+PRAC
7. AREA            → Location (Trg Area, CLP, MT Area, etc.)
8. RESPONSIBILITY  → Kaun lega (Instructor ka rank+name)

=== ZAROORI RULES ===
⚠️ Time ko DAY ke saath SAHI match karo. Galti mat karo.
⚠️ Har row me jo TIME likha hai, WAHI time us session ka hai.
⚠️ Subject ko CODE column dekh ke decide karo:
   - PT-X        → "PT (Physical Training)"
   - D-X         → "Drill"
   - LMG, BC, IT, OSM, MR, RC, INSAS, FE → "WT (Weapon Training)"
   - MISC, FE-5  → check subject text
   - TEST        → "Theory Class"
   - PT-7        → "PT (Physical Training)"

=== OUTPUT FORMAT (EXACT) ===
{
  "weekName": "Week XX BBT Batch YYY",
  "fromDate": "YYYY-MM-DD",
  "toDate": "YYYY-MM-DD",
  "remarks": "Tea Break: XXXX-XXXX | Games: XXXX-XXXX | Kill Call: XXXX",
  "schedule": [
    {
      "day": "Monday",
      "sessions": [
        {
          "time": "05:30 - 06:50",
          "subject": "PT (Physical Training)",
          "customSubject": "",
          "platoon": "All Platoons",
          "location": "Trg Area",
          "assignedPersons": [
            { "rank": "PT Ustad", "name": "PT Instr" }
          ]
        }
      ]
    }
  ]
}

=== TIME FORMAT ===
- Image me time hota hai: 0530-0650
- Convert karo: "05:30 - 06:50"
- Hamesha 24-hour format
- Hamesha "HH:MM - HH:MM" format

=== DATE FORMAT ===
- Image me: 13/01/2026
- Convert karo: "2026-01-13"
- YYYY-MM-DD format

=== DAY EXTRACT KARNE KA TARIKA ===
Table me "DAY & DATE" column dekho:
- "MONDAY 13/01/2026"   → day: "Monday"
- "TUESDAY 14/01/2026"  → day: "Tuesday"
- Aise hi Wednesday, Thursday, Friday, Saturday

Har din ke neeche jitne rows hain, wo SAARE sessions us din ke hain.
Jab tak agla din na aaye, sab pehle din ke sessions hain.

=== SUBJECT MAPPING (STRICT) ===
Code dekh ke EXACT ye subject use karo:
- PT-2, PT-7, PT-11, PT-X → "PT (Physical Training)"
- D-14, D-11, D-X         → "Drill"
- LMG-3, LMG-4, BC-3, BC-5, BC-16, IT-4, IT-5,
  OSM-3, OSM-4, OSM-11, MR-10, INSAS, FE-5      → "WT (Weapon Training)"
- TEST, OHD-11            → "Theory Class"
- MISC                    → "Theory Class" (customSubject = actual subject text)
- Kuch aur                → subject: "Other (Manual)", customSubject: "actual text"

=== RESPONSIBILITY COLUMN ===
- "PT INSTR"        → rank: "PT Ustad",     name: "PT Instr"
- "WEAPON INSTR"    → rank: "Weapon Ustad", name: "Weapon Instr"
- "INSP NEERAJ KR"  → rank: "Inspector",    name: "Neeraj Kr"
- "MEDICAL AC"      → rank: "AC",           name: "Medical"
- "ALL STAFF"       → rank: "",             name: "All Staff"

=== AGAR CONFUSION HO ===
- Time clear na ho     → "00:00 - 00:00" daal do
- Subject clear na ho  → "Other (Manual)" use karo
- Person clear na ho   → rank: "", name: "TBD"

Sirf valid JSON return karo. Markdown nahi, explanation nahi, kuch nahi.
`;

  const data = await geminiFetch({
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: imageFile.type,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI ne image se sahi format mein data nahi diya");
  }

  return JSON.parse(jsonMatch[0]);
}

// ═══════════════════════════════════════════════════
// FPT LIST FETCH — Firebase se FPT records lao
// ═══════════════════════════════════════════════════
export async function fetchFPTList(
  batchId: string,
  filters: { status?: string; subject?: string }
): Promise<ActionResult> {
  try {
    // ── Step 1: Saare FPT records is batch ke ──
    const fptQuery = query(
      collection(db, "fptRecords"),
      where("batchId", "==", batchId)
    );
    const fptSnap = await getDocs(fptQuery);

    if (fptSnap.empty) {
      return {
        success: true,
        message: "📭 Koi FPT record nahi mila",
        details: "Pehle FPT Tracker mein records add karo",
      };
    }

    // ── Step 2: Records collect karo ──
    let records = fptSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[];

    console.log("📊 Total FPT records:", records.length);
    console.log("🔍 Filters applied:", filters);
    console.log("📄 Sample record:", records[0]);

    // ── Step 3: Status filter — "result" field: "Pass" / "Fail" ──
    if (filters.status === "fail") {
      records = records.filter((r) => {
        const result = String(r.result || "").toLowerCase();
        return result === "fail";
      });
    } else if (filters.status === "pass") {
      records = records.filter((r) => {
        const result = String(r.result || "").toLowerCase();
        return result === "pass";
      });
    }

    // ── Step 4: Koi record nahi mila filter ke baad ──
    if (records.length === 0) {
      const statusText = filters.status === "fail" ? "Fail" : "Pass";
      return {
        success: true,
        message: `✅ Koi FPT ${statusText} record nahi mila!`,
        details:
          filters.status === "fail"
            ? "Sab trainees pass hain 🎉"
            : "Koi pass nahi hua abhi",
      };
    }

    // ── Step 5: Chest number se sort karo ──
    records.sort((a, b) => {
      const aNum = parseInt(a.chestNo) || 0;
      const bNum = parseInt(b.chestNo) || 0;
      return aNum - bNum;
    });

    // ── Step 6: Display format banao ──
    const statusEmoji =
      filters.status === "fail"
        ? "❌"
        : filters.status === "pass"
        ? "✅"
        : "📋";

    const statusLabel = filters.status
      ? filters.status.toUpperCase()
      : "ALL";

    const list = records.map((r, i) => {
      const name       = r.traineeName   || r.name          || `Chest #${r.chestNo}`;
      const chest      = r.chestNo       || "?";
      const percentage = r.percentage    ?? "—";
      const marks      = r.obtainedMarks ?? "—";
      const total      = r.totalMarks    ?? "—";
      const events     = r.eventsPassed  ?? "—";
      const week       = r.weekNumber    ? `W${r.weekNumber}` : "";

      return (
        `${statusEmoji} #${i + 1} | Chest ${chest} - ${name}\n` +
        `    📊 ${marks}/${total} (${percentage}%) | Events: ${events} ${week}`
      );
    });

    return {
      success: true,
      message: `${statusEmoji} FPT ${statusLabel} List — ${records.length} Trainees`,
      details: list.join("\n\n"),
    };

  } catch (err: any) {
    console.error("❌ FPT fetch error:", err);
    return {
      success: false,
      message: "❌ FPT records fetch nahi ho sake",
      details: err.message,
    };
  }
}