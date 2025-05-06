import BrowserView from "./BrowserView";
import ChatInterface from "./ChatInterface";
import { motion, AnimatePresence } from "framer-motion";
import { Message } from "../types/message";

interface SessionViewProps {
  debugUrl: string | null;
  onTerminate: () => Promise<void>;
  onReturnToStart: () => void;
  screenshot: string | null;
  messages: Message[];
  isLoading: boolean;
  isVisible: boolean;
  isAgentComplete: boolean;
  isTerminated: boolean;
  onFollowUp: (task: string) => Promise<void>;
  onMessageSubmit: (message: Message) => void;
  onLoadChat: (messages: Message[]) => void;
  currentUrl: string | null;
  onExecuteAction: (actionObject: any) => Promise<void>;
}

export default function SessionView({ 
  debugUrl, 
  onTerminate, 
  onReturnToStart,
  screenshot,
  messages,
  isLoading,
  isVisible,
  isAgentComplete,
  isTerminated,
  onFollowUp,
  onMessageSubmit,
  onLoadChat,
  currentUrl,
  onExecuteAction
}: SessionViewProps) {
  return (
    <AnimatePresence>
      {isVisible && debugUrl && (
        <motion.div 
          className="flex gap-4 w-full max-w-[1600px] h-[400px]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ 
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1] // Custom easing for a nice pop effect
          }}
        >
          <div className="flex-none">
            <BrowserView
              debugUrl={debugUrl}
              onTerminate={onTerminate}
              onReturnToStart={onReturnToStart}
              screenshot={screenshot}
              isTerminated={isTerminated}
              isLoading={isLoading}
              currentUrl={currentUrl}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <ChatInterface 
              messages={messages} 
              isLoading={isLoading} 
              isAgentComplete={isAgentComplete}
              isTerminated={isTerminated}
              onFollowUp={onFollowUp}
              onMessageSubmit={onMessageSubmit}
              onLoadChat={onLoadChat}
              onExecuteAction={onExecuteAction}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 