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
 * - Local storage for chat history
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState, ReactNode } from "react";
import { Message } from "../types/message";
import { MicrophoneIcon } from "./RetroIcons";
import { ArrowIcon } from "./RetroIcons";

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  isAgentComplete: boolean;
  isTerminated: boolean;
  onFollowUp: (task: string) => Promise<void>;
  onMessageSubmit: (message: Message) => void;
  onLoadChat: (messages: Message[]) => void;
  onExecuteAction: (actionObject: any) => Promise<void>;
}

interface SavedChat {
  id: string;
  timestamp: number;
  messages: Message[];
  title: string;
}

interface AudioState {
  isRecording: boolean;
  isTranscribing: boolean;
  permissionError: string | null;
  duration: number;
}

interface ActionObject {
  description: string;
  action: string;
  selector: string;
  arguments: [string, ...any[]];
}

const STATIC_USERS = [
  "Angelica~", "davevr", "glory", "Halo~", "latifa", "madmax", "mutti", "SunSweet", "THE_Cheri", "THE_Cheri2", "Tiger3", "Tiapper"
];

const Tooltip = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 5 }}
    className="absolute bottom-full -left-[15px] mb-2 w-[75px] py-1.5 bg-white/10 backdrop-blur-md rounded-lg text-white text-sm font-bold text-center whitespace-nowrap border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
  >
    {children}
  </motion.div>
);

export default function ChatInterface({ 
  messages, 
  isLoading, 
  isAgentComplete,
  isTerminated,
  onFollowUp,
  onMessageSubmit,
  onLoadChat,
  onExecuteAction
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [showPastChats, setShowPastChats] = useState(true);
  const [audioState, setAudioState] = useState<AudioState>({
    isRecording: false,
    isTranscribing: false,
    permissionError: null,
    duration: 0
  });
  const [availableActions, setAvailableActions] = useState<ActionObject[]>([]);
  const [isWaitingForAction, setIsWaitingForAction] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setAudioState(prev => ({ ...prev, permissionError: null, duration: 0 }));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      durationIntervalRef.current = setInterval(() => {
        setAudioState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioState(prev => ({ ...prev, isTranscribing: true }));
        
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioData: Array.from(new Uint8Array(arrayBuffer)) }),
          });

          if (!response.ok) throw new Error('Transcription failed');
          const { text } = await response.json();
          setInputValue(prev => prev + (prev ? ' ' : '') + text);
        } catch (error) {
          const errorMessage = 'Failed to transcribe audio. Please try again.';
          setAudioState(prev => ({ ...prev, permissionError: errorMessage }));
        } finally {
          setAudioState(prev => ({ ...prev, isTranscribing: false }));
        }
      };

      mediaRecorder.start();
      setAudioState(prev => ({ ...prev, isRecording: true }));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone access in your browser settings.'
          : error.name === 'NotFoundError'
            ? 'No microphone found. Please connect a microphone and try again.'
            : 'Failed to access microphone. Please check your browser settings and try again.'
        : 'Failed to access microphone. Please try again.';
      
      setAudioState(prev => ({ ...prev, permissionError: errorMessage }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && audioState.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setAudioState(prev => ({ ...prev, isRecording: false }));
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      }
    }
  };

  const toggleRecording = () => {
    audioState.isRecording ? stopRecording() : startRecording();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load saved chats from localStorage on component mount
  useEffect(() => {
    const savedChatsStr = localStorage.getItem('savedChats');
    if (savedChatsStr) {
      try {
        const parsedChats = JSON.parse(savedChatsStr);
        setSavedChats(parsedChats);
      } catch (error) {
        console.error('Error parsing saved chats:', error);
        setSavedChats([]);
      }
    }
  }, []);

  // Save chat to localStorage when session is terminated
  useEffect(() => {
    if (isTerminated && messages.length > 0) {
      const firstUserMessage = messages.find(m => m.role === 'user')?.text || 'Untitled Chat';
      const newChat: SavedChat = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        messages: [...messages],
        title: firstUserMessage.slice(0, 30) + (firstUserMessage.length > 30 ? '...' : '')
      };

      setSavedChats(prevChats => {
        const updatedChats = [newChat, ...prevChats];
        try {
          localStorage.setItem('savedChats', JSON.stringify(updatedChats));
        } catch (error) {
          console.error('Error saving chat to localStorage:', error);
        }
        return updatedChats;
      });
    }
  }, [isTerminated]); // Only depend on isTerminated

  const handleLoadChat = (chat: SavedChat) => {
    if (onLoadChat) {
      onLoadChat(chat.messages);
    }
  };

  useEffect(() => {
    // Check if the last message is from the agent and contains OBSERVE actions
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'agent' && lastMessage.tool === 'OBSERVE' && lastMessage.observation) {
      try {
        const observation = JSON.parse(lastMessage.observation);
        if (observation.actions) {
          setAvailableActions(observation.actions);
          setIsWaitingForAction(true);
        }
      } catch (error) {
        console.error('Error parsing OBSERVE actions:', error);
      }
    } else {
      setAvailableActions([]);
      setIsWaitingForAction(false);
    }
  }, [messages]);

  const handleActionSelect = async (index: number) => {
    if (index >= 0 && index < availableActions.length) {
      const selectedAction = availableActions[index];
      
      try {
        await onExecuteAction(selectedAction);
      } catch (error) {
        console.error("Error executing selected action:", error);
      }
      
      setAvailableActions([]);
      setIsWaitingForAction(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("submitting!")
    if (!inputValue.trim() || isLoading || (!isAgentComplete && !isWaitingForAction)) return;
    
    if (isWaitingForAction) {
      const actionIndex = parseInt(inputValue.trim()) - 1;
      setInputValue("");
      if (!isNaN(actionIndex)) {
        await handleActionSelect(actionIndex);
      }
    } else {
      const task = inputValue.trim();
      setInputValue("");
      const userMessage = {
        text: task,
        role: "user" as const,
        conversationId: messages[0]?.conversationId
      };
      if (onMessageSubmit) onMessageSubmit(userMessage);
      try { await onFollowUp(task); } catch (error) { console.error("Error handling follow-up:", error); }
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && !e.repeat) {
        e.preventDefault(); // Prevent browser refresh
        toggleRecording();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        if (inputValue.trim() && !isLoading && isAgentComplete) {
          handleSubmit(e as any);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [audioState.isRecording, inputValue, isLoading, isAgentComplete]);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative font-steps-mono bg-[#e0e0e0]"
      style={{
        width: '100%',
        height: '100%',
        borderTop: '2px solid #fff',
        borderLeft: '2px solid #fff',
        borderBottom: '2px solid #888',
        borderRight: '2px solid #888',
        borderRadius: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title Bar */}
      <div
        className="flex items-center justify-end select-none"
        style={{
          height: '24px',
          background: 'linear-gradient(90deg, #a04fd6 80%, #e0b0ff 100%)',
          padding: '0 4px',
        }}
      >
        <div className="flex gap-0.5">
          {/* Minimize */}
          <button className="w-4 h-4 bg-[#e0e0e0] flex items-center justify-center p-0" style={{ borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #888', borderRight: '2px solid #888', boxShadow: '1px 1px 0 #aaa', borderRadius: 0, marginRight: 1 }} aria-label="Minimize">
            <span className="block w-3 h-0.5 bg-black" />
          </button>
          {/* Maximize */}
          <button className="w-4 h-4 bg-[#e0e0e0] flex items-center justify-center p-0" style={{ borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #888', borderRight: '2px solid #888', boxShadow: '1px 1px 0 #aaa', borderRadius: 0, marginRight: 1 }} aria-label="Maximize">
            <span className="block w-3 h-3 border-2 border-black" style={{ boxSizing: 'border-box' }} />
          </button>
          {/* Close */}
          <button className="w-4 h-4 bg-[#e0e0e0] flex items-center justify-center p-0" style={{ borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #888', borderRight: '2px solid #888', boxShadow: '1px 1px 0 #aaa', borderRadius: 0, position: 'relative' }} aria-label="Close">
            <span className="block w-3 h-0.5 bg-black absolute" style={{ transform: 'rotate(45deg)' }} />
            <span className="block w-3 h-0.5 bg-black absolute" style={{ transform: 'rotate(-45deg)' }} />
          </button>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex-1 flex bg-white" style={{ borderTop: '2px solid #000', borderLeft: '2px solid #000', borderBottom: '2px solid #fff', borderRight: '2px solid #fff', overflow: 'hidden', background: '#fff' }}>
        {/* Chat Area */}
        <div className="flex-1 flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
          <div className="flex-1 overflow-y-auto px-2 py-2" style={{ 
            fontFamily: 'monospace', 
            fontSize: 14, 
            lineHeight: 1.4, 
            background: '#fff', 
            borderRight: '2px solid #e0e0e0',
            scrollbarWidth: 'none',  /* Firefox */
            msOverflowStyle: 'none', /* IE and Edge */
            minHeight: 0,
            maxHeight: '100%',
            flex: 1,
          }}>
            <style jsx>{`
              .flex-1.overflow-y-auto::-webkit-scrollbar {
                display: none;  /* Chrome, Safari and Opera */
              }
            `}</style>
            {messages.map((message, idx) => (
              <div key={idx} className="mb-1 flex items-start">
                <span
                  className="font-bold mr-2 select-none flex-shrink-0"
                  style={{
                    color: message.role === 'user' ? '#3a4fc1' : message.role === 'agent' ? '#d14fd6' : '#888',
                    fontFamily: 'monospace',
                  }}
                >
                  {message.role === 'user' ? 'You' : message.role === 'agent' ? 'Agent' : message.role}
                  <span className="ml-1" style={{ color: '#888', fontWeight: 'normal', fontSize: 11 }}>
                    {message.stepNumber ? `(${message.stepNumber})` : ''}
                  </span>
                </span>
                <span 
                  className="whitespace-pre-wrap break-words overflow-hidden" 
                  style={{ 
                    color: '#222',
                    maxWidth: '100%',
                    wordBreak: 'break-word'
                  }}
                >
                  {message.text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
                    if (url.length > 50) {
                      return url.substring(0, 47) + '...';
                    }
                    return url;
                  })}
                  {message.tool === 'OBSERVE' && message.observation && (() => {
                    try {
                      const observation = JSON.parse(message.observation);
                      if (observation.actions) {
                        return (
                          <div className="mt-2">
                            <div className="font-bold text-[#3a4fc1] mb-1">Available Actions:</div>
                            <div className="space-y-1">
                              {observation.actions.map((action: ActionObject, index: number) => (
                                <div key={index} className="pl-2">
                                  <span className="text-[#3a4fc1] font-bold mr-2">{index + 1}.</span>
                                  {action.description}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    } catch (error) {
                      console.error('Error parsing OBSERVE actions:', error);
                    }
                    return null;
                  })()}
                  {message.tool === 'EXTRACT' && message.extraction && (() => {
                    try {
                      const extraction = JSON.parse(message.extraction);
                      const renderValue = (value: any, depth: number = 0): ReactNode => {
                        if (value === null || value === undefined) {
                          return <span>null</span>;
                        }
                        if (Array.isArray(value)) {
                          return (
                            <div className="pl-4">
                              {value.map((item, index) => (
                                <div key={index} className="flex items-start">
                                  <span className="text-[#888] mr-2">{index + 1}.</span>
                                  {typeof item === 'object' ? renderValue(item, depth + 1) : <span>{String(item)}</span>}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        if (typeof value === 'object') {
                          return (
                            <div className="pl-4">
                              {Object.entries(value).map(([key, val]) => (
                                <div key={key} className="flex items-start">
                                  <span className="text-[#3a4fc1] font-bold mr-2">{key}:</span>
                                  {typeof val === 'object' ? renderValue(val, depth + 1) : <span>{String(val)}</span>}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return <span>{String(value)}</span>;
                      };

                      return (
                        <div className="mt-2">
                          <div className="font-bold text-[#3a4fc1] mb-1">Extracted Data:</div>
                          <div className="relative group">
                            <div 
                              className="bg-[#f8f8f8] p-2 overflow-x-auto whitespace-pre-wrap text-sm"
                              style={{
                                borderTop: '2px solid #fff',
                                borderLeft: '2px solid #fff',
                                borderBottom: '2px solid #888',
                                borderRight: '2px solid #888',
                                boxShadow: 'inset 1px 1px 2px #aaa',
                                borderRadius: 0,
                              }}
                            >
                              {renderValue(extraction)}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(extraction, null, 2));
                              }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#e0e0e0] p-1 rounded border border-[#888] hover:bg-[#d0d0d0]"
                              style={{
                                borderTop: '2px solid #fff',
                                borderLeft: '2px solid #fff',
                                borderBottom: '2px solid #888',
                                borderRight: '2px solid #888',
                                boxShadow: '1px 1px 0 #aaa',
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    } catch (error) {
                      console.error('Error parsing extraction data:', error);
                    }
                    return null;
                  })()}
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="mb-1 flex items-center">
                <span className="font-bold mr-2 select-none" style={{ color: '#d14fd6', fontFamily: 'monospace' }}>Agent</span>
                <span className="flex gap-1">
                  <span className="inline-block w-1 h-1 bg-[#d14fd6] rounded-full animate-bounce" />
                  <span className="inline-block w-1 h-1 bg-[#d14fd6] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="inline-block w-1 h-1 bg-[#d14fd6] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Input Bar */}
          {!isTerminated && (
            <div className="w-full border-t-2 border-[#e0e0e0] bg-[#f8f8f8] px-2 py-2 flex items-center gap-2" style={{ fontFamily: 'monospace' }}>
              <form onSubmit={handleSubmit} className="flex w-full gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={isWaitingForAction ? "Enter action number..." : "Type your message..."}
                  className="flex-1 px-2 py-1 bg-white text-black font-steps-mono text-sm outline-none"
                  style={{
                    borderTop: '2px solid #888',
                    borderLeft: '2px solid #888',
                    borderBottom: '2px solid #fff',
                    borderRight: '2px solid #fff',
                    boxShadow: 'inset 1px 1px 2px #aaa',
                    borderRadius: 0,
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isLoading || audioState.isTranscribing || !isAgentComplete || isWaitingForAction}
                    className="h-[45px] w-[45px] p-0 bg-[#e0e0e0] text-black font-steps-mono flex items-center justify-center"
                    style={{
                      borderTop: '2px solid #fff',
                      borderLeft: '2px solid #fff',
                      borderBottom: '2px solid #888',
                      borderRight: '2px solid #888',
                      boxShadow: '1px 1px 0 #aaa',
                      borderRadius: 0,
                      opacity: (isLoading || audioState.isTranscribing || !isAgentComplete || isWaitingForAction) ? 0.5 : 1,
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {audioState.isRecording ? (
                        <motion.span
                          key="timer"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-black text-base font-normal whitespace-nowrap px-2"
                        >
                          {formatDuration(audioState.duration)}
                        </motion.span>
                      ) : (
                        <motion.div
                          key="mic"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <MicrophoneIcon />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || audioState.isTranscribing || (!isAgentComplete && !isWaitingForAction)}
                    className="h-[45px] w-[45px] p-0 bg-[#e0e0e0] text-black font-steps-mono flex items-center justify-center"
                    style={{
                      borderTop: '2px solid #fff',
                      borderLeft: '2px solid #fff',
                      borderBottom: '2px solid #888',
                      borderRight: '2px solid #888',
                      boxShadow: '1px 1px 0 #aaa',
                      borderRadius: 0,
                      opacity: (isLoading || audioState.isTranscribing || (!isAgentComplete && !isWaitingForAction)) ? 0.5 : 1,
                    }}
                  >
                    <ArrowIcon />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
        {/* Past Chats Sidebar */}
        <div
          className="flex flex-col items-start h-full bg-[#f8f8f8] border-l-2 border-[#e0e0e0] px-2 py-2 overflow-y-auto"
          style={{ 
            width: 120, 
            fontFamily: 'monospace', 
            fontSize: 13,
            maxHeight: '100%',
            scrollbarWidth: 'none',  /* Firefox */
            msOverflowStyle: 'none', /* IE and Edge */
          }}
        >
          <style jsx>{`
            .overflow-y-auto::-webkit-scrollbar {
              display: none;  /* Chrome, Safari and Opera */
            }
          `}</style>
          {savedChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => handleLoadChat(chat)}
              className="w-full text-left mb-1 flex items-start gap-1"
            >
              <span className="inline-block w-2 h-2 bg-[#ffe680] border border-[#b0b0b0] mt-1.5 flex-shrink-0" style={{ borderRadius: 6 }} />
              <span 
                className="text-[#3a4fc1] font-bold line-clamp-2" 
                style={{ 
                  fontFamily: 'monospace',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {chat.title}
              </span>
            </button>
          ))}
        </div>
      </div>
      {/* Status Bar */}
      <div
        className="flex items-center justify-between px-2"
        style={{
          height: 22,
          background: '#e0e0e0',
          borderTop: '2px solid #fff',
          borderBottom: '2px solid #888',
          borderLeft: '2px solid #fff',
          borderRight: '2px solid #888',
          fontSize: 12,
          color: '#888',
          boxShadow: 'inset 0 2px 0 #fff',
        }}
      >
        <span>{savedChats.length > 0 ? `${savedChats.length} saved chats` : 'No saved chats'}</span>
        
      </div>
    </div>
  );
} 