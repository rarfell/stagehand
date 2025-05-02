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

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

/**
 * Props for the ChatInterface component
 * @interface ChatInterfaceProps
 * @property {string | null} pageContent - The content of the current page to provide context to the chat
 */
interface ChatInterfaceProps {
  pageContent: string | null;
}

/**
 * Represents a single message in the chat
 * @interface Message
 * @property {string} id - Unique identifier for the message
 * @property {string} content - The text content of the message
 * @property {"user" | "assistant"} role - The sender of the message (either user or AI assistant)
 */
interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
}

/**
 * Main chat interface component that handles user interactions and displays the conversation
 * @param {ChatInterfaceProps} props - Component props
 * @returns {JSX.Element} The rendered chat interface
 */
export default function ChatInterface({ pageContent }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMessageRef = useRef<Message | null>(null);

  /**
   * Scrolls the chat container to the bottom to show the latest messages
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll when new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Handles the submission of a new user message
   * @param {React.FormEvent} e - The form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      /**
       * Fetches the AI response using Server-Sent Events (SSE)
       * The response is streamed in real-time and displayed as it arrives
       */
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          pageContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        role: "assistant",
      };

      currentMessageRef.current = assistantMessage;
      setMessages((prev) => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let buffer = "";

      /**
       * Processes the streamed response data using Server-Sent Events (SSE)
       * 
       * SSE Format:
       * - Each message starts with "data: " followed by the actual data
       * - Messages are separated by newlines
       * - A special "[DONE]" message indicates the end of the stream
       * 
       * Buffer Handling:
       * - The buffer accumulates incoming chunks of data
       * - When a newline is found, the buffer is split into complete messages
       * - Any incomplete message remains in the buffer for the next chunk
       * 
       * Example of SSE data format:
       * data: {"choices":[{"delta":{"content":"Hello"}}]}
       * data: {"choices":[{"delta":{"content":" there"}}]}
       * data: [DONE]
       */
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the incoming chunk and add it to the buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split the buffer into lines, keeping any incomplete message in the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        // Process each complete line
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              break;
            }

            try {
              // Parse the JSON data from OpenAI's response
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              
              // Update the current message with the new content
              if (content && currentMessageRef.current) {
                currentMessageRef.current.content += content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.content = currentMessageRef.current?.content || "";
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: "Sorry, there was an error processing your request.",
          role: "assistant",
        },
      ]);
    } finally {
      setIsLoading(false);
      currentMessageRef.current = null;
    }
  };

  /**
   * Renders the chat interface with:
   * - Message history display
   * - Loading indicator
   * - Input form for new messages
   */
  return (
    <div className="flex flex-col h-full bg-[#1A1A1A] rounded-2xl overflow-hidden border-[3px] border-[#404040]">
      {/* Messages container with auto-scroll */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-2xl ${
                message.role === "user"
                  ? "bg-white text-black"
                  : "bg-[#2A2A2A] text-white"
              }`}
            >
              {message.content}
            </div>
          </motion.div>
        ))}
        {/* Loading indicator with animated dots */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-[#2A2A2A] text-white p-4 rounded-2xl">
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

      {/* Message input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t-[3px] border-[#404040]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the page..."
            className="flex-1 bg-[#2A2A2A] text-white placeholder-gray-400 px-4 py-3 rounded-2xl border-[3px] border-[#404040] focus:outline-none focus:ring-0 focus:border-white transition-all duration-200 font-jetbrains-mono"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-white text-black px-4 py-3 rounded-2xl hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
} 