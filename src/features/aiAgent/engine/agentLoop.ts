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
import { buildFocusedDigest } from '../knowledge/collectionRegistry';
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
function buildSystemPrompt(ctx: ToolContext, userMessage: string): string {
  const today = new Date();
  // Focused digest = sirf sawaal se jude collections ke poore fields.
  // Isse har call ~1,270 → ~500 token ho jaata hai (Groq TPM bachta hai).
  return `Tu "F Coy ERP Assistant" hai — BSF Training Company ka data analyst.

DATE: ${today.toISOString().split('T')[0]} | USER: ${ctx.userRole}
MODE: ${ctx.allowWrites ? 'READ+WRITE' : 'READ-ONLY (add/update mat karo)'}

${buildFocusedDigest(userMessage)}

⚠️ STOCK/INVENTORY — SABSE ZAROORI:
  Is ERP me stock kahin store NAHI hota. \`item_master\` collection KHAALI hai.
  Kisi bhi stock/inventory/"kitni hai"/"kitne bache" sawaal par SIRF get_stock chala.
  get_stock khud hisaab karta hai: kharida (expenses) − baanta (issue_records).
  • Training items (t-shirt, shoes, bucket, plate) → get_stock
  • Company assets (CHAIR, table, fan, furniture) → get_stock
  Agar get_stock me item na mile, wo available items ki list de deta hai — user ko wahi dikhao.

RULES:
1. Har aankda TOOL se aana chahiye. Apne mann se number mat banana.
2. Field/value pakka na ho → pehle describe_schema ya sample_values chala.
3. Text filter me "contains" use kar, "eq" nahi (spelling alag ho sakti hai).
   "West Bengal" = "Bengal"/"WB"/"bangal" bhi ho sakta hai.
4. attn: P=Present A=Absent L=Leave S=Sick H=Hospital R=Rest M=Medical
5. Ginti → aggregate{fn:"count"} | Paisa → aggregate{fn:"sum",field:"amount"}
   2 collection wala sawaal → join_data | Vyakti → find_entity | Stock → get_stock
6. Finance collections batch-scoped NAHI hain → useActiveBatch:false bhej.
7. Data na mile → saaf bol "record nahi mila" aur bata kahan se bhara jaata hai.
8. General baat-cheet → seedha jawab, tool mat chala.
9. EFFICIENT rah: ek hi call me groupBy+aggregate kar lo. Faltu tool call mat kar.
${ctx.allowWrites ? `10. WRITE: add_record/update_record/delete_record se kisi bhi collection me
   likh sakte ho. Update/delete se PEHLE query_data ya find_entity se docId nikalo.
   Delete sirf tab jab user saaf bole. Har write ke baad confirm karo kya badla.` : ''}

JAWAB: Hinglish, chhota aur saaf. Asli number. 3+ rows ho to list/table. Thoda emoji.

EXAMPLES:
"kitne trainees" → query_data{collection:"trainees",aggregate:{field:"chestNo",fn:"count"}}
"state wise" → query_data{collection:"trainees",groupBy:"state"}
"rajasthan ke kitne" → query_data{collection:"trainees",filters:[{field:"state",op:"contains",value:"rajasthan"}],aggregate:{field:"chestNo",fn:"count"}}
"mess kharcha" → query_data{collection:"mess_fund_expenses",aggregate:{field:"amount",fn:"sum"},useActiveBatch:false}
"chair kitni hai" → get_stock{item:"chair"}
"M size t-shirt kitni hai" → get_stock{item:"t-shirt",size:"M"}
"stock dikhao" → get_stock{}
"Bihar ke jo FPT fail" → join_data{left:{collection:"trainees",filters:[{field:"state",op:"contains",value:"bihar"}]},right:{collection:"fptRecords",filters:[{field:"overallStatus",op:"contains",value:"fail"}]}}`;
}

// ─────────────────────────────────────────────
// GROQ CALL (with key rotation)
// ─────────────────────────────────────────────
let groqKeyIdx = 0;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Rate-limit ki jaankari UI tak pahunchane ke liye */
export class RateLimitError extends Error {
  constructor(public waitSeconds: number, msg: string) { super(msg); }
}

async function callGroq(messages: any[], useTools: boolean): Promise<any> {
  const keys = AI_CONFIG.groqKeys;
  if (!keys.length) throw new Error('Koi Groq key nahi hai');

  let lastErr: any = null;
  let rateLimitWait = 0;

  // Har key try karo; agar SAARI keys rate-limited hain to
  // ek baar thoda ruk kar dobara try karo (Groq ka limit rolling window hai).
  for (let round = 0; round < 2; round++) {
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[groqKeyIdx % keys.length];
      groqKeyIdx++;

      try {
        const body: any = {
          model: AI_CONFIG.groqModel,
          messages,
          temperature: 0.1,
          max_tokens: 1200,          // 2000 → 1200: TPM bachta hai
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

        if (res.status === 429) {
          // Groq batata hai kitni der rukna hai — usko padho
          const retryAfter = parseFloat(res.headers.get('retry-after') ?? '0');
          const txt = await res.text().catch(() => '');
          const m = txt.match(/try again in ([\d.]+)([ms])/i);
          const parsed = m ? (m[2] === 'm' ? parseFloat(m[1]) * 60 : parseFloat(m[1])) : 0;
          const wait = retryAfter || parsed || 8;
          rateLimitWait = Math.max(rateLimitWait, wait);
          lastErr = new RateLimitError(wait, `Rate limit — ${Math.ceil(wait)}s`);
          console.warn(`⏳ Groq key #${attempt + 1} rate limited (${wait}s)`);
          continue;
        }
        if (res.status === 401) {
          lastErr = new Error('Groq key invalid');
          continue;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          lastErr = new Error(`Groq ${res.status}: ${txt.slice(0, 160)}`);
          continue;
        }

        return await res.json();
      } catch (e: any) {
        lastErr = e;
      }
    }

    // Saari keys rate-limited — chhota wait karke ek aur round
    if (round === 0 && lastErr instanceof RateLimitError && rateLimitWait <= 12) {
      console.warn(`⏳ Saari keys busy, ${Math.ceil(rateLimitWait)}s wait...`);
      await sleep(Math.min(rateLimitWait * 1000 + 500, 12000));
      continue;
    }
    break;
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

/**
 * Gemini models retire hote rehte hain (gemini-2.0-flash June 2026 me band ho gaya,
 * 2.5-flash-lite naye users ko nahi milta). Isliye ek fallback ladder rakhi hai —
 * 404/400 aane par apne aap agla model try hota hai.
 */
const GEMINI_FALLBACKS = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

/** Jo model chal gaya usko yaad rakho — baar baar 404 na kha'ein */
let workingGeminiModel: string | null = null;

async function callGemini(contents: any[], systemPrompt: string): Promise<any> {
  const keys = AI_CONFIG.geminiKeys;
  if (!keys.length) throw new Error('Koi Gemini key nahi hai');

  const models = workingGeminiModel
    ? [workingGeminiModel]
    : [AI_CONFIG.geminiModel, ...GEMINI_FALLBACKS.filter(m => m !== AI_CONFIG.geminiModel)];

  let lastErr: any = null;

  for (const model of models) {
    for (const key of keys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: toGeminiTools(),
            generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
          }),
        });

        if (res.status === 404 || res.status === 400) {
          const txt = await res.text().catch(() => '');
          lastErr = new Error(`Gemini ${res.status} (${model}): ${txt.slice(0, 140)}`);
          console.warn(`⚠️ Gemini model "${model}" nahi chala, agla try...`);
          break;                     // is model ko chhodo, agla model
        }
        if (res.status === 429) {
          lastErr = new RateLimitError(20, 'Gemini rate limit');
          continue;                  // agli key
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          lastErr = new Error(`Gemini ${res.status}: ${txt.slice(0, 140)}`);
          continue;
        }

        if (workingGeminiModel !== model) {
          workingGeminiModel = model;
          console.log(`✅ Gemini model locked: ${model}`);
        }
        return await res.json();
      } catch (e: any) { lastErr = e; }
    }
  }
  throw lastErr ?? new Error('Gemini fail');
}

// ─────────────────────────────────────────────
// FRIENDLY ERROR — user ko technical dump nahi,
// saaf batao kya hua aur kya karna hai
// ─────────────────────────────────────────────
function friendlyError(groqErr: any, gemErr: any): string {
  const isRL = (e: any) =>
    e instanceof RateLimitError ||
    /rate.?limit|429|too many/i.test(String(e?.message ?? ''));

  if (isRL(groqErr) || isRL(gemErr)) {
    const wait = groqErr instanceof RateLimitError ? Math.ceil(groqErr.waitSeconds) : 30;
    return (
      `⏳ **AI ka free quota abhi bhar gaya hai**\n\n` +
      `Groq free tier: 12,000 token/minute. Aapne jaldi-jaldi sawaal poochhe ` +
      `isliye limit lag gayi.\n\n` +
      `**Kya karein:**\n` +
      `• ~${wait} second ruk kar dobara poochein\n` +
      `• Ya sawaal thoda simple rakhein (kam data = kam token)\n\n` +
      `💡 Permanent hal: Groq console me **alag-alag account** ki keys lagayein ` +
      `(ek hi account ki 3 keys ek hi limit share karti hain), ya Dev tier lein.`
    );
  }

  const msg = String(gemErr?.message ?? groqErr?.message ?? '');

  if (/404|no longer available|not found/i.test(msg)) {
    return (
      `❌ **AI model ab available nahi hai**\n\n` +
      `Google/Groq ne purana model band kar diya hai.\n\n` +
      `**Fix:** \`.env\` me ye daalein aur dev server restart karein:\n` +
      `\`\`\`\nVITE_GEMINI_MODEL=gemini-flash-latest\n\`\`\`\n\n` +
      `_Technical: ${msg.slice(0, 120)}_`
    );
  }

  if (/401|invalid|api key/i.test(msg)) {
    return (
      `🔑 **Cloud AI credentials issue**\n\n` +
      `Secrets server-side (Cloud Functions) me hote hain. Admin se confirm karein ` +
      `ki AI functions deployed hain aur GROQ_API_KEY/GEMINI_API_KEY Secret Manager me set hain.\n\n` +
      `_Technical: ${msg.slice(0, 120)}_`
    );
  }

  if (/failed to fetch|network|econn/i.test(msg)) {
    return `🌐 **Internet connection ka issue lag raha hai**\n\nConnection check karke dobara try karein.`;
  }

  return (
    `❌ AI abhi jawab nahi de paa raha.\n\n` +
    `_${msg.slice(0, 200)}_\n\n` +
    `💡 Thodi der baad try karein, ya sawaal simple karke poochein.`
  );
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
  /** Groq ki error yaad rakho — Gemini bhi fail ho to dono ka context chahiye */
  let groqError: any = null;
  const steps: AgentStep[] = [];
  clearQueryCache();                      // har naye sawaal par fresh data

  const systemPrompt = buildSystemPrompt(ctx, userMessage);

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

    } catch (err: any) {
      groqError = err;
      console.warn('Groq agent fail, Gemini try kar raha hoon:', err?.message);
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
        reply: friendlyError(groqError, gemErr),
        steps, provider: 'none', model: '-', iterations: 0,
        elapsedMs: Date.now() - started, error: gemErr?.message,
      };
    }
  }

  // Groq fail hua aur Gemini configured hi nahi hai
  if (groqError) {
    return {
      reply: friendlyError(groqError, null),
      steps, provider: 'none', model: '-', iterations: 0,
      elapsedMs: Date.now() - started, error: groqError?.message,
    };
  }

  return {
    reply: '❌ Cloud AI available nahi hai. Local ERP commands chal rahi hain; natural-language AI ke liye backend AI functions deploy karna hoga (secrets server-side).',
    steps, provider: 'none', model: '-', iterations: 0,
    elapsedMs: Date.now() - started, error: 'no keys',
  };
}
