// Ye hai main screen
// Yahan saara chat ka logic hai
// Now using Smart Router (Quick → Cache → Groq → Gemini)

import React, { useState, useRef, useEffect } from "react";
import { Bot, Trash2, AlertCircle, Sparkles, Loader2, Database } from "lucide-react";
import { ChatInput } from "./ChatInput";
import { ChatMessage, type Message } from "./ChatMessage";
import { extractWeeklyProgramFromImage } from "../api/aiAgent.api";
import { smartRoute, printStats, getRouterStats } from "../utils/smartRouter";
import { getAIHealth, hasAnyCloudAI } from "../config/ai.config";
import { executeAction, saveWeeklyProgramFromAI } from "../utils/actionHandler";
import { useAuth } from "../../../contexts/AuthContext";
import { syncFirebaseToPinecone } from "../scripts/syncToPinecone"; // ✅ NAYA IMPORT

// Unique ID banane ka simple function
const makeId = () => Math.random().toString(36).slice(2);

// Pehla welcome message
const WELCOME_MESSAGE: Message = {
  id: makeId(),
  type: "ai",
  text: "Namaste! 🙏 Main aapka Smart Training Center AI Assistant hoon.\n\n⚡ Quick commands (greetings, help) - instant!\n💾 Repeated queries - cached for speed\n🧠 Smart AI for complex commands\n\nTry karein:\n• \"Rahul ko add karo\"\n• \"Chest 5 ki age 25\"\n• \"Chest 30 ko medical leave\"\n• \"List dikhao\"\n• 📸 Weekly Program image (purple button)",
  status: "info",
  timestamp: new Date(),
};

// Source ka label
const getSourceLabel = (source?: string) => {
  switch (source) {
    case "quick": return "Quick ⚡";
    case "cache": return "Cache 💾";
    case "groq": return "Groq AI 🧠";
    case "gemini": return "Gemini 🔄";
    default: return "";
  }
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

  // Current logged in user
  const { user } = useAuth();
  const userEmail = user?.email || "unknown";

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
    const routerResult = await smartRoute(userText);
    const aiResponse = routerResult.response;

    console.log("🤖 AI Response:", JSON.stringify(aiResponse, null, 2));
    // ↑ Ye console mein dekho - kya Groq sahi JSON de raha hai?

    if (
      aiResponse.reply &&
      (aiResponse.action === "greeting" || aiResponse.action === "help")
    ) {
      addMessage({
        type: "ai",
        text: aiResponse.reply,
        details: `📊 ${getSourceLabel(routerResult.source)} • ${routerResult.responseTime}ms`,
        status: "success",
      });
    } else {
      // ✅ Debug: AI ka raw response bhi dikha do temporarily
      const debugInfo = `🔍 Debug: action=${aiResponse.action}, listType=${aiResponse.listType || "none"}, filters=${JSON.stringify(aiResponse.filters || {})}`;
      
      const result = await executeAction(aiResponse, userEmail);

      addMessage({
        type: "ai",
        text: result.message,
        details: result.details
          ? `${result.details}\n\n━━━━━━━━━━\n📊 ${getSourceLabel(routerResult.source)} • ${routerResult.responseTime}ms\n${debugInfo}`
          : `📊 ${getSourceLabel(routerResult.source)} • ${routerResult.responseTime}ms\n${debugInfo}`,
        status: result.success ? "success" : "error",
      });
    }
  } catch (error: any) {
    addMessage({
      type: "ai",
      text: "❌ Kuch gadbad ho gayi",
      details: error.message,
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

  // Stats dikhao
  const handleShowStats = () => {
    const stats = getRouterStats();
    printStats(); // Console mein bhi
    
    const statsMessage = `📊 **AI Router Statistics**

Total Queries: ${stats.total}

**Layer Breakdown:**
⚡ Quick Match: ${stats.breakdown.quick} (${stats.percentages.quick}%)
💾 Cache Hits: ${stats.breakdown.cache} (${stats.percentages.cache}%)
🧠 Groq AI: ${stats.breakdown.groq} (${stats.percentages.groq}%)
🔄 Gemini: ${stats.breakdown.gemini} (${stats.percentages.gemini}%)
❌ Errors: ${stats.breakdown.errors}

**Performance:**
⚡ Avg Response Time: ${stats.avgResponseTime}ms
💰 Free Queries: ${stats.apiCallsSaved}/${stats.total} (${stats.cacheHitRate})

🎯 ${stats.apiCallsSaved} API calls saved!`;

    addMessage({
      type: "ai",
      text: statsMessage,
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
              Smart Routing • Quick + Cache + Groq + Gemini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          {/* 🔄 NAYA: Sync Button */}
          <button
            onClick={async () => {
              addMessage({ type: "ai", text: "🔄 Database Sync Start ho gaya hai...", status: "info" });
              // Yahan wo collections likhein jinka data aapko AI ko sikhana hai
              await syncFirebaseToPinecone(["messFund", "trainees", "leaves"]);
              addMessage({ type: "ai", text: "✅ Pinecone Vector DB mein sync pura ho gaya!", status: "success" });
            }}
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-green-600 hover:bg-green-500 transition-colors"
            title="Database Sync Karein (Pinecone)"
          >
            <Database size={14} />
          </button>

          {/* Stats Button */}
          <button
            onClick={handleShowStats}
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-blue-600 hover:bg-blue-500 transition-colors"
            title="AI Stats dekho"
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
            Local ERP AI active hai. Natural language fallback ke liye .env mein VITE_GROQ_API_KEY ya VITE_GEMINI_API_KEY add karo.
          </span>
        </div>
      )}
      {!cloudAIMissing && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-1.5 text-[10px] text-green-800 font-bold flex-shrink-0">
          AI Ready: Local ERP ✅ · Groq keys {aiHealth.groqKeys} · Gemini keys {aiHealth.geminiKeys} · Pinecone {aiHealth.pinecone ? '✅' : 'off'}
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