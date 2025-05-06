import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import RetroButton from './RetroButton';
import RetroInput from './RetroInput';
import { MicrophoneIcon, ArrowIcon } from './RetroIcons';

interface UrlInputProps {
  onSubmit: (task: string) => void;
  isLoading: boolean;
  onAudioData?: (data: { frequencyData: Uint8Array; timeDomainData: Uint8Array } | undefined) => void;
  onError?: (error: string) => void;
}

interface AudioState {
  isRecording: boolean;
  isTranscribing: boolean;
  permissionError: string | null;
  duration: number;
}

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

export default function UrlInput({ onSubmit, isLoading, onAudioData, onError }: UrlInputProps) {
  const [input, setInput] = useState("");
  const [audioState, setAudioState] = useState<AudioState>({
    isRecording: false,
    isTranscribing: false,
    permissionError: null,
    duration: 0
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCommandPressed, setIsCommandPressed] = useState(false);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const initAudioAnalysis = (stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const timeDomainData = new Uint8Array(analyser.fftSize);

    const updateAudioData = () => {
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(frequencyData);
        analyserRef.current.getByteTimeDomainData(timeDomainData);
        onAudioData?.({ frequencyData, timeDomainData });
        requestAnimationFrame(updateAudioData);
      }
    };

    requestAnimationFrame(updateAudioData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSubmit(input);
  };

  const startRecording = async () => {
    setIsTranscribing(true)
    setAudioState(prev => ({ ...prev, permissionError: null, duration: 0 }));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      initAudioAnalysis(stream);
      
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
          const newInput = (prev: string) => prev + (prev ? ' ' : '') + text;
          setInput(newInput(input));
          // Automatically submit after successful transcription
          onSubmit(newInput(input));
        } catch (error) {
          const errorMessage = 'Failed to transcribe audio. Please try again.';
          setAudioState(prev => ({ ...prev, permissionError: errorMessage }));
          onError?.(errorMessage);
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
      onError?.(errorMessage);
    }
  };

  const stopRecording = () => {
    setIsTranscribing(false)
    if (mediaRecorderRef.current && audioState.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setAudioState(prev => ({ ...prev, isRecording: false }));
      onAudioData?.(undefined);
      
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

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && !e.repeat) {
        e.preventDefault(); // Prevent browser refresh
        toggleRecording();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        setIsCommandPressed(true);
        setShowTooltip(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        if (input.trim()) {
          onSubmit(input);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        setIsCommandPressed(false);
        setShowTooltip(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [audioState.isRecording, input, onSubmit]);

  const animationConfig = {
    type: "spring",
    stiffness: 300,
    damping: 20
  };

  return (
    <div className="relative w-full max-w-2xl mb-8">
      <form onSubmit={handleSubmit} className="relative flex gap-2">
        <RetroInput
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a task for the agent to perform..."
        />
        <div className="flex items-center gap-2">
          <motion.div className="relative">
            <RetroButton
              type="button"
              onClick={toggleRecording}
              isActive={audioState.isRecording}
              disabled={audioState.isTranscribing || isLoading}
              className="h-[45px] p-0"
              animateWidth={true}
              initialWidth={45}
              expandedWidth={80}
            >
              <AnimatePresence mode="wait">
                {audioState.isRecording ? (
                  <motion.span
                    key="timer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-white text-base font-normal whitespace-nowrap px-2"
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
            </RetroButton>
            <AnimatePresence>
              {(showTooltip && !isTranscribing) && (
                <Tooltip>
                  ⌘ + V
                </Tooltip>
              )}
            </AnimatePresence>
          </motion.div>
          <RetroButton
            type="submit"
            disabled={isLoading || audioState.isTranscribing}
            className="h-[45px] w-[45px] p-0"
          >
            <ArrowIcon />
          </RetroButton>
        </div>
      </form>
    </div>
  );
} 