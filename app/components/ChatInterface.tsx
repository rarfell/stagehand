/**
 * ChatInterface Component
 * 
 * A real-time chat interface that allows users to interact with an AI assistant.
 * Features include:
 * - Real-time message streaming
 * - Message history display
 * - Loading states
 * - Auto-scrolling to latest messages
 * - Support for both user and assistant messages
 */

"use client";

import { motion } from "framer-motion";
import { useRef, useEffect } from "react";
import { Message } from "../types/message";

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatInterface({ messages, isLoading }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[#1A1A1A] rounded-2xl overflow-hidden border-[3px] border-[#404040] min-w-[400px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`p-4 rounded-2xl max-w-[80%] space-y-2 ${
              message.role === "user" 
                ? "bg-white" 
                : message.tool === "SUMMARIZE"
                ? "bg-[#3A3A3A] border-2 border-[#4A4A4A]"
                : "bg-[#2A2A2A]"
            }`}>
              {message.role === "agent" && (
                <div className="flex justify-between items-center">
                  {message.stepNumber && (
                    <span className="text-sm text-gray-400">
                      Step {message.stepNumber}
                    </span>
                  )}
                  {message.tool && (
                    <span className={`px-2 py-1 rounded text-xs ${
                      message.tool === "SUMMARIZE"
                        ? "bg-[#4A4A4A] text-white font-bold"
                        : "bg-[#404040] text-white"
                    }`}>
                      {message.tool}
                    </span>
                  )}
                </div>
              )}
              <p className={`font-medium whitespace-pre-wrap ${
                message.role === "user" ? "text-gray-800" : "text-white"
              }`}>
                {message.text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                  part.match(/^https?:\/\/[^\s]+$/) ? (
                    <span key={i} className="break-all">{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </p>
              {message.role === "agent" && message.reasoning && message.tool !== "SUMMARIZE" && (
                <p className="text-sm text-gray-400 whitespace-pre-wrap">
                  <span className="font-semibold">Reasoning: </span>
                  {message.reasoning.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                    part.match(/^https?:\/\/[^\s]+$/) ? (
                      <span key={i} className="break-all">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </p>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="p-4 bg-[#2A2A2A] rounded-2xl">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t-[3px] border-[#404040]">
        <form className="flex gap-2">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 bg-[#1A1A1A] text-white placeholder-gray-400 px-4 py-3 rounded-2xl border-[3px] border-[#404040] focus:outline-none focus:ring-0 focus:border-white transition-all duration-200 font-jetbrains-mono"
          />
          <button
            type="submit"
            className="rounded-2xl bg-white text-black hover:bg-gray-100 transition-colors duration-200 flex items-center justify-center px-6"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
} 