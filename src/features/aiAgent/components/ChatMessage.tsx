// Ye component ek message bubble dikhata hai
// User ka message right side, AI ka message left side

import React from "react";
import { Bot, User, CheckCircle, XCircle, Info } from "lucide-react";

// Message ka structure
export interface Message {
  id: string;
  type: "user" | "ai";
  text: string;
  details?: string;
  status?: "success" | "error" | "info";
  timestamp: Date;
}

interface Props {
  message: Message;
}

export const ChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.type === "user";

  // AI message ka color status ke hisab se
  const aiBubbleStyle = () => {
    if (message.status === "success")
      return "bg-green-50 border-l-4 border-green-500 text-slate-800";
    if (message.status === "error")
      return "bg-red-50 border-l-4 border-red-500 text-slate-800";
    return "bg-white border border-slate-200 text-slate-800";
  };

  // AI icon ka color status ke hisab se
  const aiIconStyle = () => {
    if (message.status === "success")
      return "bg-green-100 text-green-700 border border-green-300";
    if (message.status === "error")
      return "bg-red-100 text-red-700 border border-red-300";
    return "bg-slate-100 text-slate-700 border border-slate-300";
  };

  // AI icon kaun sa dikhao
  const AiIcon = () => {
    if (message.status === "success") return <CheckCircle size={16} />;
    if (message.status === "error") return <XCircle size={16} />;
    return <Bot size={16} />;
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`flex ${
          isUser ? "flex-row-reverse" : "flex-row"
        } items-start gap-2 max-w-[85%]`}
      >
        {/* Icon - User ya AI */}
        <div
          className={`w-8 h-8 flex items-center justify-center rounded-sm flex-shrink-0 ${
            isUser
              ? "bg-military-800 text-white"
              : aiIconStyle()
          }`}
        >
          {isUser ? <User size={16} /> : <AiIcon />}
        </div>

        {/* Message bubble */}
        <div
          className={`px-4 py-2.5 shadow-sm ${
            isUser
              ? "bg-military-800 text-white"
              : aiBubbleStyle()
          }`}
        >
          {/* Main text */}
          <p className="text-sm font-medium whitespace-pre-wrap">
            {message.text}
          </p>

          {/* Details section - agar koi details hain */}
          {message.details && (
            <pre className="mt-2 text-xs font-mono bg-black/5 p-2 rounded-sm whitespace-pre-wrap overflow-auto max-h-48">
              {message.details}
            </pre>
          )}

          {/* Time */}
          <span
            className={`text-[10px] uppercase tracking-wider mt-1 block ${
              isUser ? "text-military-200" : "text-slate-400"
            }`}
          >
            {message.timestamp.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
};