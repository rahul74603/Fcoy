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
import { chatGroq, chatGemini } from './llmProviders';


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
  /** Set when a write needs the user's explicit YES before it runs. */
  pendingConfirmation?: { token: string; action: string; preview: any; summary: string };
}


const MAX_ITERATIONS = 6;

/** Pending write confirmation carried across turns (in-memory per session). */
export interface PendingConfirmation {
  token: string;
  tool: string;
  args: any;
  preview: any;
  summary: string;
}

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────
function buildSystemPrompt(ctx: ToolContext, userMessage: string): string {
  const a = ctx.agentCtx;
  const batchLine = a
    ? `SELECTED BATCH: ${a.selectedBatch ? `${a.selectedBatch.batchNumber ?? a.selectedBatch.id} (${a.selectedBatch.batchName ?? ''})` : 'NONE'} | BATCH MODE: ${a.batchMode}` +
      (a.isSO ? ` | SO ASSIGNED BATCHES: ${a.user.assignedBatchIds.join(', ') || 'NONE'}` : '') +
      ` | LOCAL DATE: ${a.todayISO}`
    : `DATE: ${new Date().toISOString().split('T')[0]}`;
  // Focused digest = sirf sawaal se jude collections ke poore fields.
  // Isse har call ~1,270 → ~500 token ho jaata hai (Groq TPM bachta hai).
  return `Tu "F Coy ERP Assistant" hai — BSF Training Company ka 360° ERP operator.

${batchLine} | USER ROLE: ${ctx.userRole}
MODE: ${ctx.allowWrites ? 'READ+WRITE' : 'READ-ONLY (add/update mat karo)'}

⚠️ BATCH KANUN (sabse zaroori):
  • Trainee/attendance/schedule ke sawaal HAMESHA current SELECTED batch ke hain.
  • Batch A me 0 records ho to 0 hi bolo — DOOSRI batch ka data KABHI mat dikhao.
  • Tu khud koi batchId nahi bana sakta. SO sirf apni assigned batches dekh sakta hai.
  • "aaj/kal/parso/Monday" jaise dates ke liye pehle resolve_date chala, phir us date se filter kar.

⚠️ LOG:
  • Trainee dhoondhne ke liye get_trainee / get_trainee_360 use kar (chest number ya naam).
    "chest 23" = chestNo 23. Multiple matches mile to options dikha kar poochho — guess mat karo.
  • Stock/inventory sawaal par get_stock; issue ke liye issue_inventory (wo khud atomic transaction chalata hai).
  • Inspections/findings ke liye get_inspections; verify/rework ke liye verify_finding (SO/CC only).
  • Finance ke liye get_finance_summary / get_fund_balance (global, batch-scoped nahi);
    expense likhne ke liye record_expense (QM/CC, confirm ke baad).
  • Naye trainees ke liye create_trainees (naam user se lo — kabhi khud naam/number mat banao),
    chest number badalne ke liye assign_chest (occupied chest = report holder, overwrite nahi).
  • Inspection/finding likhne ke liye create_inspection / create_finding (SO/CC, assigned batch);
    responsible staff apna kaam poora kare to submit_corrective_action.
  • Staff directory / pending leave → get_staff_info; high-level dashboard → get_company_operational_summary.
  • Pehle get_context chala kar role/batch/date confirm kar liya karo jab sawaal me batch/date/role ho.

⚠️ WRITES (zaroori):
  • Har write pe tool khud confirmation maangta hai — uska preview user ko dikha kar "haan confirm" ka intezaar karo.
  • Inventory RETURN/waapsi ka koi system nahi hai — user bole to saaf bolo "abhi supported nahi", fake entry mat banao.
  • Leave approve/reject SIRF Company Commander karta hai — kisi aur role se likhne ki koshish mat karo.
  • Attendance MARK karne ka AI tool nahi hai (sirf reads) — mark karna ho to user ko Attendance screen pe bhejo.

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

/** Rate-limit ki jaankari UI tak pahunchane ke liye */
export class RateLimitError extends Error {
  constructor(public waitSeconds: number, msg: string) { super(msg); }
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
  opts: { confirmationToken?: string; provider?: 'groq' | 'gemini' } = {},
): Promise<AgentAnswer> {
  const started = Date.now();
  let groqError: any = null;
  const steps: AgentStep[] = [];
  clearQueryCache();                      // har naye sawaal par fresh data

  // If the user is confirming a write, inject the token into tool context.
  const toolCtx: ToolContext = { ...ctx, confirmToken: opts.confirmationToken };

  const systemPrompt = buildSystemPrompt(toolCtx, userMessage);

  // Whether a cloud LLM is reachable at all (backend callable OR dev keys).
  const cloudAvailable = AI_CONFIG.enableGroq || AI_CONFIG.enableGemini;

  // ══════════ GROQ PATH (primary) ══════════
  if (cloudAvailable) {
    try {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: userMessage },
      ];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        let data: any;
        try {
          data = await chatGroq({ messages, tools: TOOL_SCHEMAS, temperature: 0.1, maxTokens: 1200 });
        } catch (gErr) {
          // Groq unavailable → bounded failover to Gemini for this turn.
          console.warn('Groq fail, Gemini failover:', (gErr as any)?.message);
          groqError = gErr;
          throw gErr;
        }
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
          const r = await executeTool(c.function.name, args, toolCtx);
          steps.push({ tool: c.function.name, args, summary: r.summary, ok: r.ok });
          return { c, r };
        }));

        // If any tool requested confirmation, surface that and STOP (no write).
        const confirmReq = results.find(({ r }) => r.data?.needsConfirmation);
        if (confirmReq && !opts.confirmationToken) {
          const { r } = confirmReq;
          return {
            reply:
              `⚠️ **Confirm karein — ye action data badlega:**\n\n` +
              `🔧 ${r.data.action}\n` +
              '```\n' + JSON.stringify(r.data.preview, null, 2) + '\n```\n\n' +
              `Sahi hai to **"haan confirm"** likhein — tabhi action hoga.`,
            steps, provider: 'groq', model: AI_CONFIG.groqModel,
            iterations: i + 1, elapsedMs: Date.now() - started,
            pendingConfirmation: {
              token: r.data.confirmToken, action: r.data.action,
              preview: r.data.preview, summary: r.summary,
            },
          };
        }

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
      const finalData = await chatGroq({ messages, temperature: 0.1, maxTokens: 1200 });
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

  // ══════════ GEMINI PATH (fallback — backend callable in production) ══════════
  if (AI_CONFIG.enableGemini) {
    try {
      const contents: any[] = [
        ...history.slice(-6).map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: userMessage }] },
      ];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const data = await chatGemini(contents, systemPrompt, TOOL_SCHEMAS);
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
        let confirmReq: any = null;
        for (const fc of fnCalls) {
          const r = await executeTool(fc.name, fc.args ?? {}, toolCtx);
          steps.push({ tool: fc.name, args: fc.args, summary: r.summary, ok: r.ok });
          if (r.data?.needsConfirmation && !opts.confirmationToken) confirmReq = r;
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: { ok: r.ok, summary: r.summary, data: r.data },
            },
          });
        }
        if (confirmReq) {
          const r = confirmReq;
          return {
            reply:
              `⚠️ **Confirm karein — ye action data badlega:**\n\n` +
              `🔧 ${r.data.action}\n` +
              '```\n' + JSON.stringify(r.data.preview, null, 2) + '\n```\n\n' +
              `Sahi hai to **"haan confirm"** likhein.`,
            steps, provider: 'gemini', model: AI_CONFIG.geminiModel,
            iterations: i + 1, elapsedMs: Date.now() - started,
            pendingConfirmation: {
              token: r.data.confirmToken, action: r.data.action,
              preview: r.data.preview, summary: r.summary,
            },
          };
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
