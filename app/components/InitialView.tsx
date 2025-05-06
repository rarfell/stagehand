import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import DotBackground from "./DotBackground";
import UrlInput from "./UrlInput";
import { motion, AnimatePresence } from "framer-motion";
import { useScramble } from "use-scramble";
import { SpaceInvadersIcon, BoxIcon } from "raster-react";

interface InitialViewProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  isTransitioning: boolean;
  onTransitionComplete?: () => void;
  logMessage?: string;
}

export default function InitialView({ 
  onSubmit, 
  isLoading, 
  isTransitioning, 
  onTransitionComplete,
  logMessage = ""
}: InitialViewProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [shouldFade, setShouldFade] = useState(false);
  const [isRippling, setIsRippling] = useState(false);
  const previousLogMessageRef = useRef<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const { ref: scrambleRef, replay } = useScramble({
    text: errorMessage || logMessage,
    speed: 0.5,
    tick: 1,
    step: 1,
    scramble: 4,
    seed: 0,
    chance: 0.8,
    overdrive: false,
    overflow: false,
  });

  const handleError = useCallback((error: string) => {
    setErrorMessage(error);
    // Clear the error message after 5 seconds
    setTimeout(() => setErrorMessage(""), 5000);
  }, []);

  useEffect(() => {
    // Only process new log messages
    if (logMessage && logMessage !== previousLogMessageRef.current) {
      previousLogMessageRef.current = logMessage;
      replay();
    }
  }, [logMessage, replay]);

  useEffect(() => {
    if (isTransitioning) {
      setShouldFade(false);
    }
  }, [isTransitioning]);

  useEffect(() => {
    // Reset isRippling when component mounts or when transitioning state changes
    setIsRippling(false);
  }, [isTransitioning]);

  const handleDotTransitionComplete = useCallback(() => {
    setShouldFade(true);
    onTransitionComplete?.();
  }, [onTransitionComplete]);

  const handleSubmit = useCallback((url: string) => {
    setIsRippling(true);
    onSubmit(url);
  }, [onSubmit]);

  const memoizedDotBackground = useMemo(() => (
    <DotBackground 
      isTransitioning={isTransitioning}
      isRippling={isRippling}
      onTransitionComplete={handleDotTransitionComplete}
    />
  ), [isTransitioning, isRippling, handleDotTransitionComplete]);

  return (
    <AnimatePresence>
      {!shouldFade && (
        <motion.div 
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div ref={backgroundRef} className="absolute inset-0">
            {memoizedDotBackground}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <UrlInput 
              onSubmit={handleSubmit} 
              isLoading={isLoading}
              onError={handleError}
            />
          </div>
          <motion.div 
            className="fixed bottom-0 left-0 right-0 w-full bg-[#0a0a0a] p-4 text-white text-sm text-center border-t border-white/10 font-steps-mono grid grid-cols-3 items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-left">Durham, NC</span>
            <div className="flex justify-center">
              {(errorMessage || logMessage) ? (
                <span ref={scrambleRef} />
              ) : (
                <span className="opacity-50">Waiting for input...</span>
              )}
            </div>
            <span className="text-right">Made with 🅱️ Browserbase</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 