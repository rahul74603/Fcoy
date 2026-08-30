// Ye hai main screen
// Yahan saara chat ka logic hai
// Now using Smart Router (Quick → Cache → Groq → Gemini)

import React, { useState, useRef, useEffect } from "react";
import { Bot, Trash2, AlertCircle, Sparkles, Loader2, Database } from "lucide-react";
import { ChatInput } from "./ChatInput";
import { ChatMessage, type Message } from "./ChatMessage";
import { extractWeeklyProgramFromImage } from "../api/aiAgent.api";
import { getAIHealth, hasAnyCloudAI } from "../config/ai.config";
import { saveWeeklyProgramFromAI } from "../utils/actionHandler";
import { useAuth } from "../../../contexts/AuthContext";
import { checkQuickResponse } from "../utils/commandPatterns";
// 🆕 NAYA AGENT ENGINE — tool calling + live Firebase reads
import { runAgent, type AgentStep } from "../engine/agentLoop";
import { tryFastPath } from "../engine/fastPath";
import { COLLECTIONS } from "../knowledge/collectionRegistry";
import { buildAgentContext } from "../engine/agentContext";
import { useBatch } from "../../../contexts/BatchContext";

// A pending write awaiting the user's "haan confirm".
interface PendingWrite {
  token: string;
  action: string;
  preview: any;
  toolName: string;
}
const CONFIRM_WORDS = /^(haan?|yes|confirm|confirm karo|haan confirm|ji haan|ok|theek hai|karo|do it)\b/i;

// Unique ID banane ka simple function
const makeId = () => Math.random().toString(36).slice(2);

// Pehla welcome message
const WELCOME_MESSAGE: Message = {
  id: makeId(),
  type: "ai",
  text:
    `Namaste! 🙏 Main **F Coy ERP Assistant** hoon.\n\n` +
    `Main poore database ki **${COLLECTIONS.length} collections** live padh sakta hoon — ` +
    `trainee, staff, finance, inventory, training sab kuch.\n\n` +
    `**Aise sawaal poochein:**\n` +
    `• "state wise trainees ka breakdown do"\n` +
    `• "Bihar ke kitne trainees hain"\n` +
    `• "aaj kitne absent hain aur kyun"\n` +
    `• "mess fund me kitna kharcha hua"\n` +
    `• "vendor ka kitna paisa baaki hai"\n` +
    `• "Bengal ke trainees jo FPT me fail hue"\n` +
    `• "sabse zyada chhutti kisne li"\n` +
    `• "Rahul ka poora detail batao"\n\n` +
    `Jo bhi poochoge, main **asli data** dhoond kar jawab dunga. 🎯`,
  status: "info",
  timestamp: new Date(),
};

// Agent ke steps ko padhne layak banao
const formatSteps = (steps: AgentStep[]): string => {
  if (!steps.length) return "";
  return steps
    .map((s, i) => `${s.ok ? "✅" : "⚠️"} ${i + 1}. ${s.tool} → ${s.summary}`)
    .join("\n");
};

const AIAgentScreen: React.FC = () => {
  // Messages ki list
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  
  // AI kaam kar raha hai?
  const [isLoading, setIsLoading] = useState(false);

  // Image upload chal raha hai?
  const [imageLoading, setImageLoading] = useState(false);
  
  // Cloud AI key hai ya nahi (local ERP commands still work)
  const [cloudAIMissing, setCloudAIMissing] = useState(false);
  const [aiHealth, setAIHealth] = useState(getAIHealth());

  // Current logged in user + selected batch (SAME state as the whole app)
  const { user } = useAuth();
  const { selectedBatchId, allBatches } = useBatch();
  const userEmail = user?.email || "unknown";

  // Write awaiting explicit user confirmation.
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null);

  // Chat ka neeche wala hissa - auto scroll ke liye
  const bottomRef = useRef<HTMLDivElement>(null);

  // Naya message aaye toh neeche scroll karo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // AI config check karo. Local ERP layer works even without cloud keys.
  useEffect(() => {
    setAIHealth(getAIHealth());
    setCloudAIMissing(!hasAnyCloudAI());
  }, []);

  // Naya message add karo list mein
  const addMessage = (msg: Omit<Message, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: makeId(), timestamp: new Date() },
    ]);
  };

  // Jab user message bheje
  // src/components/AIAgent/AIAgentScreen.tsx

const handleSend = async (userText: string) => {
  if (isLoading) return;

  addMessage({ type: "user", text: userText });
  setIsLoading(true);

  try {
    // ── Layer 1: Greeting / thanks / bye — bina API ke, 0ms ──
    const quick = checkQuickResponse(userText);
    if (quick.matched && quick.action !== "help") {
      addMessage({
        type: "ai",
        text: quick.reply || "👍",
        details: "⚡ Instant (no API used)",
        status: "success",
      });
      setIsLoading(false);
      return;
    }

    // ── Layer 2: Fast path — aam sawaal bina AI ke (0 token, instant) ──
    // Agar pattern match na ho to null aata hai aur poora AI agent chalta hai.
    try {
      const fast = await tryFastPath(userText);
      if (fast) {
        addMessage({
          type: "ai",
          text: fast.reply,
          details: `✅ ${fast.toolSummary}\n\n━━━━━━━━━━\n⚡ Direct DB query • 0 AI tokens used`,
          status: "success",
        });
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.warn("Fast path fail, AI agent chala rahe hain:", e);
    }

    // ── Confirmation handshake: user said "haan" after a pending write ──
    let confirmToken: string | undefined;
    if (pendingWrite && CONFIRM_WORDS.test(userText.trim())) {
      confirmToken = pendingWrite.token;
    }

    // ── Layer 3: Asli AI Agent — tools ke saath live database ──
    // Trusted context: authenticated user + selected batch (same as the app).
    const agentCtx = await buildAgentContext(
      {
        uid: user?.uid,
        email: user?.email,
        name: user?.name ?? user?.displayName,
        role: user?.role,
        assignedBatchIds: (user as any)?.assignedBatchIds,
      },
      { allBatchesMode: !selectedBatchId },
    );
    void allBatches;

    const answer = await runAgent(
      userText,
      {
        userEmail,
        userRole: user?.role || "Unknown",
        // Writes follow role policy: CC broad; Clerk staff-admin; QM finance;
        // SO inspections. Defense in depth — Firestore rules are the boundary.
        allowWrites:
          user?.role === "Company Commander" ||
          user?.role === "Clerk" ||
          user?.role === "Quarter Master" ||
          user?.role === "Senior Officer / Inspector",
        agentCtx,
      },
      // pichhle exchanges ka context (follow-up sawaal ke liye)
      messages
        .filter((m) => m.type === "user" || m.type === "ai")
        .slice(-6)
        .map((m) => ({
          role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.text,
        })),
      { confirmationToken: confirmToken },
    );

    // Track a write awaiting confirmation, or clear once executed.
    if (answer.pendingConfirmation) {
      setPendingWrite({
        token: answer.pendingConfirmation.token,
        action: answer.pendingConfirmation.action,
        preview: answer.pendingConfirmation.preview,
        toolName: answer.pendingConfirmation.action,
      });
    } else if (confirmToken) {
      setPendingWrite(null);
    }

    console.log("🤖 Agent:", answer);

    const stepText = formatSteps(answer.steps);
    const meta =
      `🧠 ${answer.provider === "groq" ? "Groq" : answer.provider === "gemini" ? "Gemini" : "—"}` +
      ` • ${answer.steps.length} data lookup${answer.steps.length === 1 ? "" : "s"}` +
      ` • ${(answer.elapsedMs / 1000).toFixed(1)}s`;

    addMessage({
      type: "ai",
      text: answer.reply,
      details: stepText ? `${stepText}\n\n━━━━━━━━━━\n${meta}` : meta,
      status: answer.error ? "error" : "success",
    });
  } catch (error: any) {
    addMessage({
      type: "ai",
      text: "❌ Kuch gadbad ho gayi",
      details: error?.message ?? String(error),
      status: "error",
    });
  } finally {
    setIsLoading(false);
  }
};

  // ═══════════════════════════════════════════
  // 📸 Image upload karne wala handler
  // ═══════════════════════════════════════════
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageLoading || isLoading) return;

    setImageLoading(true);

    // User ko dikhao ki image upload hui
    addMessage({
      type: "user",
      text: `📸 Weekly Program image bheji: ${file.name}`,
    });

    addMessage({
      type: "ai",
      text: "🔍 Image padh raha hu, thoda time lagega...",
      status: "info",
    });

    try {
      // Step 1: Image se data nikaalo (Gemini se - kyunki Groq image nahi padhta)
      const extractedData = await extractWeeklyProgramFromImage(file);

      // Step 2: Firestore mein save karo
      const result = await saveWeeklyProgramFromAI(extractedData, userEmail);

      // Step 3: Result dikhao
      addMessage({
        type: "ai",
        text: result.message,
        details: result.details,
        status: result.success ? "success" : "error",
      });
    } catch (error: any) {
      addMessage({
        type: "ai",
        text: "❌ Image process nahi hui",
        details: error.message,
        status: "error",
      });
    } finally {
      setImageLoading(false);
      e.target.value = "";
    }
  };

  // Chat clear karo
  const handleClear = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  // AI kya kya padh sakta hai — capability list
  const handleShowStats = () => {
    const byDomain = COLLECTIONS.reduce<Record<string, string[]>>((acc, c) => {
      (acc[c.domain] ??= []).push(c.name);
      return acc;
    }, {});

    const lines = Object.entries(byDomain)
      .map(([d, names]) => `**${d.toUpperCase()}** (${names.length})\n${names.join(", ")}`)
      .join("\n\n");

    addMessage({
      type: "ai",
      text:
        `🗄️ **Main ye poora database padh sakta hoon**\n\n${lines}\n\n` +
        `Total: **${COLLECTIONS.length} collections**\n\n` +
        `Kisi bhi collection ke baare me poochein — filter, ginti, total, ` +
        `ya do collections ko jodkar bhi. Bas normal Hinglish me poochein. 🎯`,
      status: "info",
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-military-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <div>
            <h2 className="font-bold text-sm uppercase tracking-wider">
              AI Agent
            </h2>
            <p className="text-[10px] text-military-200 uppercase tracking-wider">
              Live Database Agent • {COLLECTIONS.length} Collections • Tool Calling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          {/* Capabilities — AI kya padh sakta hai */}
          <button
            onClick={handleShowStats}
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-blue-600 hover:bg-blue-500 transition-colors"
            title="AI kaunsa data padh sakta hai"
          >
            <Database size={14} />
          </button>

          {/* Image Upload Button */}
          <label
            className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors cursor-pointer ${
              imageLoading || isLoading
                ? "bg-purple-900 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
            title="Weekly Program ki image upload karo"
          >
            {imageLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={imageLoading || isLoading || cloudAIMissing}
              onChange={handleImageUpload}
            />
          </label>

          {/* Clear button */}
          <button
            onClick={handleClear}
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-military-700 hover:bg-military-600 transition-colors"
            title="Chat clear karo"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── AI Status / API Key Warning ── */}
      {cloudAIMissing && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-xs flex-shrink-0">
          <AlertCircle size={14} />
          <span>
            Local ERP AI active hai. Natural-language cloud AI ke liye backend AI functions deploy karo (secrets server-side rehte hain).
          </span>
        </div>
      )}
      {!cloudAIMissing && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-1.5 text-[10px] text-green-800 font-bold flex-shrink-0">
          🟢 Live DB Agent · {COLLECTIONS.length} collections readable ·
          Groq keys {aiHealth.groqKeys} · Gemini keys {aiHealth.geminiKeys} ·
          {(user?.role === 'Company Commander' || user?.role === 'Clerk')
            ? ' Read+Write' : ' Read-only'}
        </div>
      )}

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto p-4">
        
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Loading indicator */}
        {(isLoading || imageLoading) && (
          <div className="flex justify-start mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-sm bg-slate-100 border border-slate-300">
                <Bot size={16} className="text-slate-600" />
              </div>
              <div className="bg-white border border-slate-200 px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto scroll ke liye invisible div */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="flex-shrink-0">
        <ChatInput onSend={handleSend} disabled={isLoading || imageLoading} />
      </div>
    </div>
  );
};

export default AIAgentScreen;