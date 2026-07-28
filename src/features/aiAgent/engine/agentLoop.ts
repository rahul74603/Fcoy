// ═══════════════════════════════════════════════════════════
// AGENT LOOP — Asli AI Agent ka dil ❤️
// ───────────────────────────────────────────────────────────
// Purana system: 1 API call → ek JSON intent → hardcoded if-else
// Naya system:   AI sochta hai → tool chalata hai → result dekhta hai
//                → phir sochta hai → zaroorat pade to aur tool
//                → jab data poora ho, tab final jawab deta hai
//
// Isse "Bengal ke kitne trainees FPT me fail hue" jaise
// multi-step sawaal bhi sahi jawab dete hain.
// ═══════════════════════════════════════════════════════════

import { AI_CONFIG } from '../config/ai.config';
import { TOOL_SCHEMAS, executeTool, type ToolContext } from './tools';
import { buildSchemaDigest } from '../knowledge/collectionRegistry';
import { clearQueryCache } from './queryEngine';

export interface AgentStep {
  tool: string;
  args: any;
  summary: string;
  ok: boolean;
}

export interface AgentAnswer {
  reply: string;
  steps: AgentStep[];
  provider: 'groq' | 'gemini' | 'none';
  model: string;
  iterations: number;
  elapsedMs: number;
  error?: string;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_ITERATIONS = 6;

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────
function buildSystemPrompt(ctx: ToolContext): string {
  const today = new Date();
  return `Tu "F Coy ERP Assistant" hai — BSF Training Company ka data analyst.

AAJ KI TAREEKH: ${today.toISOString().split('T')[0]} (${today.toLocaleDateString('en-IN', { weekday: 'long' })})
USER: ${ctx.userEmail} | ROLE: ${ctx.userRole}
MODE: ${ctx.allowWrites ? 'READ + WRITE' : 'READ-ONLY (add/update mat karo)'}

═══════════════════════════════════════════
DATABASE MAP
═══════════════════════════════════════════
${buildSchemaDigest()}

═══════════════════════════════════════════
KAAM KARNE KA TAREEKA
═══════════════════════════════════════════
1. Tere paas TOOLS hain. Data ka koi bhi sawaal ho — TOOL CHALA.
   Kabhi bhi apne mann se number mat banana. Har aankda tool se aana chahiye.

2. Agar field ka naam ya value pakka nahi pata:
   → pehle "describe_schema" ya "sample_values" chala
   → phir sahi filter ke saath "query_data" chala
   Ye 2-3 step lena BILKUL THEEK hai. Galat jawab dene se behtar hai.

3. Ginti ke sawaal → query_data + aggregate:{fn:"count"} ya groupBy
   Paise ke sawaal → query_data + aggregate:{fn:"sum", field:"amount"}
   Do shart wale sawaal → join_data
   Kisi vyakti ka sawaal → find_entity

4. Filter lagate waqt dhyan rakh:
   - Text match ke liye "contains" behtar hai "eq" se (spelling farq ho sakta hai)
   - "West Bengal" ko log "Bengal", "WB", "bangal" bhi likhte hain →
     pehle sample_values se dekh ki asal me kya likha hai
   - attn field: P=Present, A=Absent, L=Leave, S=Sick, H=Hospital, R=Rest, M=Medical

5. Jab data mil jaye, JAWAB DE:
   - Hinglish me, saaf aur seedha
   - ASLI NUMBER de jo tool se aaya
   - Chhoti list ho to naam/chest number bhi likh de
   - Table jaisa format use kar jab 3+ rows ho
   - Emoji thoda use kar, par overload mat kar

6. Agar data hi nahi mila → saaf bol "record nahi mila", jhooth mat bol.
   Agar collection khaali hai → bata ki kahan se data bharna hai.

7. Agar sawaal data se related NAHI hai (general baat-cheet) → seedha jawab de, tool mat chala.

═══════════════════════════════════════════
UDAHARAN
═══════════════════════════════════════════
Q: "kitne trainees hain"
→ query_data{collection:"trainees", aggregate:{field:"chestNo", fn:"count"}}

Q: "state wise trainees batao"
→ query_data{collection:"trainees", groupBy:"state"}

Q: "Bengal ke kitne trainees hain"
→ query_data{collection:"trainees", filters:[{field:"state", op:"contains", value:"bengal"}], aggregate:{field:"chestNo", fn:"count"}}

Q: "aaj kitne absent hain"
→ query_data{collection:"trainees", filters:[{field:"attn", op:"in", value:["A","L","S","H"]}], groupBy:"attn"}

Q: "mess fund me kitna kharcha hua"
→ query_data{collection:"mess_fund_expenses", aggregate:{field:"amount", fn:"sum"}, useActiveBatch:false}

Q: "vendor ka kitna baaki hai"
→ query_data{collection:"vendor_entries", aggregate:{field:"dueAmount", fn:"sum"}, useActiveBatch:false}

Q: "Bihar ke trainees jo FPT me fail hue"
→ join_data{left:{collection:"trainees", filters:[{field:"state", op:"contains", value:"bihar"}]},
            right:{collection:"fptRecords", filters:[{field:"overallStatus", op:"contains", value:"fail"}]},
            on:"chestNo"}

Q: "Rahul ka detail"
→ find_entity{term:"Rahul"}

YAAD RAKH: Tool se data lo, phir INSAAN ki tarah jawab do. 🎯`;
}

// ─────────────────────────────────────────────
// GROQ CALL (with key rotation)
// ─────────────────────────────────────────────
let groqKeyIdx = 0;

async function callGroq(messages: any[], useTools: boolean): Promise<any> {
  const keys = AI_CONFIG.groqKeys;
  if (!keys.length) throw new Error('Koi Groq key nahi hai');

  let lastErr: any = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[groqKeyIdx % keys.length];
    groqKeyIdx++;

    try {
      const body: any = {
        model: AI_CONFIG.groqModel,
        messages,
        temperature: 0.1,
        max_tokens: 2000,
      };
      if (useTools) {
        body.tools = TOOL_SCHEMAS;
        body.tool_choice = 'auto';
      }

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });

      if (res.status === 429) { lastErr = new Error('rate limited'); continue; }
      if (res.status === 401) { lastErr = new Error('invalid key'); continue; }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        lastErr = new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`);
        continue;
      }

      return await res.json();
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Groq fail');
}

// ─────────────────────────────────────────────
// GEMINI FALLBACK (function calling)
// ─────────────────────────────────────────────
function toGeminiTools() {
  return [{
    functionDeclarations: TOOL_SCHEMAS.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: sanitizeForGemini(t.function.parameters),
    })),
  }];
}

/** Gemini strict hai — unsupported keys hata do */
function sanitizeForGemini(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeForGemini);
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties' || k === '$schema') continue;
    // property without type → Gemini reject karta hai
    if (k === 'properties' && v && typeof v === 'object') {
      const props: any = {};
      for (const [pk, pv] of Object.entries(v as any)) {
        const cleaned = sanitizeForGemini(pv);
        if (!cleaned.type) cleaned.type = 'string';
        props[pk] = cleaned;
      }
      out[k] = props;
      continue;
    }
    out[k] = sanitizeForGemini(v);
  }
  return out;
}

async function callGemini(contents: any[], systemPrompt: string): Promise<any> {
  const keys = AI_CONFIG.geminiKeys;
  if (!keys.length) throw new Error('Koi Gemini key nahi hai');

  let lastErr: any = null;
  for (const key of keys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.geminiModel}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: toGeminiTools(),
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        lastErr = new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`);
        continue;
      }
      return await res.json();
    } catch (e: any) { lastErr = e; }
  }
  throw lastErr ?? new Error('Gemini fail');
}

// ═══════════════════════════════════════════════════════════
// MAIN: runAgent
// ═══════════════════════════════════════════════════════════
export async function runAgent(
  userMessage: string,
  ctx: ToolContext,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<AgentAnswer> {
  const started = Date.now();
  const steps: AgentStep[] = [];
  clearQueryCache();                      // har naye sawaal par fresh data

  const systemPrompt = buildSystemPrompt(ctx);

  // ══════════ GROQ PATH (primary) ══════════
  if (AI_CONFIG.enableGroq && AI_CONFIG.groqKeys.length) {
    try {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: userMessage },
      ];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const data = await callGroq(messages, true);
        const msg = data?.choices?.[0]?.message;
        if (!msg) throw new Error('Groq se khaali response');

        const calls = msg.tool_calls ?? [];

        // Koi tool nahi → final jawab
        if (!calls.length) {
          return {
            reply: msg.content?.trim() || 'Jawab nahi bana paaya.',
            steps, provider: 'groq', model: AI_CONFIG.groqModel,
            iterations: i + 1, elapsedMs: Date.now() - started,
          };
        }

        messages.push(msg);

        // Saare tool calls parallel chalao
        const results = await Promise.all(calls.map(async (c: any) => {
          let args: any = {};
          try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* ignore */ }
          const r = await executeTool(c.function.name, args, ctx);
          steps.push({ tool: c.function.name, args, summary: r.summary, ok: r.ok });
          return { c, r };
        }));

        for (const { c, r } of results) {
          messages.push({
            role: 'tool',
            tool_call_id: c.id,
            name: c.function.name,
            content: JSON.stringify({ ok: r.ok, summary: r.summary, data: r.data }).slice(0, 12000),
          });
        }
      }

      // Iterations khatam — jo mila usi se jawab banwao
      messages.push({
        role: 'user',
        content: 'Ab tak jo data mila hai usi se final jawab do. Aur tool mat chalao.',
      });
      const finalData = await callGroq(messages, false);
      return {
        reply: finalData?.choices?.[0]?.message?.content?.trim() || 'Data mila par jawab nahi ban paaya.',
        steps, provider: 'groq', model: AI_CONFIG.groqModel,
        iterations: MAX_ITERATIONS, elapsedMs: Date.now() - started,
      };

    } catch (groqErr: any) {
      console.warn('Groq agent fail, Gemini try kar raha hoon:', groqErr?.message);
    }
  }

  // ══════════ GEMINI PATH (fallback) ══════════
  if (AI_CONFIG.enableGemini && AI_CONFIG.geminiKeys.length) {
    try {
      const contents: any[] = [
        ...history.slice(-6).map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: userMessage }] },
      ];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const data = await callGemini(contents, systemPrompt);
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const fnCalls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

        if (!fnCalls.length) {
          const text = parts.map((p: any) => p.text ?? '').join('').trim();
          return {
            reply: text || 'Jawab nahi bana paaya.',
            steps, provider: 'gemini', model: AI_CONFIG.geminiModel,
            iterations: i + 1, elapsedMs: Date.now() - started,
          };
        }

        contents.push({ role: 'model', parts: fnCalls.map((fc: any) => ({ functionCall: fc })) });

        const responseParts: any[] = [];
        for (const fc of fnCalls) {
          const r = await executeTool(fc.name, fc.args ?? {}, ctx);
          steps.push({ tool: fc.name, args: fc.args, summary: r.summary, ok: r.ok });
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: { ok: r.ok, summary: r.summary, data: r.data },
            },
          });
        }
        contents.push({ role: 'user', parts: responseParts });
      }

      return {
        reply: 'Bahut steps lag gaye. Sawaal thoda simple karke poochein.',
        steps, provider: 'gemini', model: AI_CONFIG.geminiModel,
        iterations: MAX_ITERATIONS, elapsedMs: Date.now() - started,
      };

    } catch (gemErr: any) {
      return {
        reply: `❌ AI abhi jawab nahi de paa raha.\n\n${gemErr?.message ?? ''}\n\n` +
               `💡 Thodi der baad try karein, ya sawaal simple karke poochein.`,
        steps, provider: 'none', model: '-', iterations: 0,
        elapsedMs: Date.now() - started, error: gemErr?.message,
      };
    }
  }

  return {
    reply: '❌ Koi AI key configured nahi hai. .env me VITE_GROQ_API_KEY ya VITE_GEMINI_API_KEY daalein.',
    steps, provider: 'none', model: '-', iterations: 0,
    elapsedMs: Date.now() - started, error: 'no keys',
  };
}
