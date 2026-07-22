// Ye component text aur voice input leta hai

import React, { useState, useRef } from "react";
import { Send, Mic, MicOff } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Message send karo
  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };

  // Enter press karo toh send ho
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mic button - voice input
  const toggleMic = () => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      alert("Aapka browser voice support nahi karta. Chrome use karein.");
      return;
    }

    // Recording chal rahi hai toh band karo
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Nai recording shuru karo
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN"; // Hindi
    recognition.continuous = false;
    recognition.interimResults = false;

    // Jab bolna khatam ho
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText(transcript);

      // Thoda wait karke auto send karo
      setTimeout(() => {
        onSend(transcript);
        setText("");
      }, 300);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  return (
    <div className="bg-white border-t border-slate-200 p-3">
      <div className="flex items-center gap-2">

        {/* Mic Button */}
        <button
          onClick={toggleMic}
          disabled={disabled}
          title={isRecording ? "Stop Recording" : "Voice Command"}
          className={`w-10 h-10 flex items-center justify-center rounded-sm border transition-colors ${
            isRecording
              ? "bg-red-600 text-white border-red-700 animate-pulse"
              : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
          } disabled:opacity-50`}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder='Command likhein... (e.g. "Rahul ko add karo")'
          disabled={disabled}
          className="flex-1 border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-500 bg-slate-50 focus:bg-white transition-colors disabled:opacity-50 rounded-sm"
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="w-10 h-10 flex items-center justify-center bg-military-800 text-white hover:bg-military-900 transition-colors disabled:opacity-50 rounded-sm"
        >
          <Send size={16} />
        </button>
      </div>

      <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider text-center">
        AI Agent • Powered by Gemini
      </p>
    </div>
  );
};