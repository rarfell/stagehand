import BrowserView from "./BrowserView";
import ChatInterface from "./ChatInterface";
import { motion, AnimatePresence } from "framer-motion";

interface SessionViewProps {
  debugUrl: string | null;
  isSessionTerminated: boolean;
  onTerminate: () => void;
  onRefresh: () => void;
  screenshot: string | null;
  pageContent: string | null;
  isVisible: boolean;
}

export default function SessionView({ 
  debugUrl, 
  isSessionTerminated, 
  onTerminate, 
  onRefresh,
  screenshot,
  pageContent,
  isVisible
}: SessionViewProps) {
  return (
    <AnimatePresence>
      {isVisible && debugUrl && (
        <motion.div 
          className="flex gap-4 w-full max-w-[1600px]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ 
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1] // Custom easing for a nice pop effect
          }}
        >
          <BrowserView
            debugUrl={debugUrl}
            isSessionTerminated={isSessionTerminated}
            onTerminate={onTerminate}
            onRefresh={onRefresh}
            screenshot={screenshot}
          />
          
          <div className="flex-1 h-[min(720px,45vw)]">
            <ChatInterface pageContent={pageContent} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 