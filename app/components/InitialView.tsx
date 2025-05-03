import { useState, useEffect, useRef } from "react";
import DotBackground from "./DotBackground";
import UrlInput from "./UrlInput";
import { motion, AnimatePresence } from "framer-motion";

interface InitialViewProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  isTransitioning: boolean;
  onTransitionComplete?: () => void;
}

export default function InitialView({ onSubmit, isLoading, isTransitioning, onTransitionComplete }: InitialViewProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [shouldFade, setShouldFade] = useState(false);
  const [isRippling, setIsRippling] = useState(false);

  useEffect(() => {
    if (isTransitioning) {
      setShouldFade(false);
    }
  }, [isTransitioning]);

  const handleDotTransitionComplete = () => {
    setShouldFade(true);
    onTransitionComplete?.();
  };

  const handleSubmit = (url: string) => {
    setIsRippling(true);
    onSubmit(url);
  };

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
            <DotBackground 
              isTransitioning={isTransitioning}
              isRippling={isRippling}
              onTransitionComplete={handleDotTransitionComplete}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <UrlInput 
              onSubmit={handleSubmit} 
              isLoading={isLoading} 
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 