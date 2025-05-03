import { useState, useRef, useEffect } from "react";
import { IconMicrophoneFilled, IconSquareRoundedFilled, IconLoader2, IconArrowBigRightFilled } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UrlInputProps {
  onSubmit: (task: string) => void;
  isLoading: boolean;
  onAudioData?: (data: { frequencyData: Uint8Array; timeDomainData: Uint8Array } | undefined) => void;
}

interface AudioState {
  isRecording: boolean;
  isTranscribing: boolean;
  permissionError: string | null;
  duration: number;
}

export default function UrlInput({ onSubmit, isLoading, onAudioData }: UrlInputProps) {
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
          setInput(prev => prev + (prev ? ' ' : '') + text);
        } catch (error) {
          setAudioState(prev => ({ ...prev, permissionError: 'Failed to transcribe audio. Please try again.' }));
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

  const animationConfig = {
    type: "spring",
    stiffness: 300,
    damping: 20
  };

  return (
    <div className="relative w-full max-w-2xl mb-8">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a task for the agent to perform..."
          className="w-full bg-[#1A1A1A] text-white placeholder-gray-400 px-4 py-3 rounded-2xl border-[3px] border-[#404040] focus:outline-none focus:ring-0 focus:border-white transition-all duration-200 font-jetbrains-mono pr-28"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <motion.button
            type="button"
            onClick={toggleRecording}
            className={`rounded-lg transition-colors duration-200 flex items-center justify-center ${
              audioState.isRecording 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white hover:bg-gray-100'
            }`}
            aria-label={audioState.isRecording ? "Stop recording" : "Start recording"}
            disabled={audioState.isTranscribing}
            style={{ height: 30, width: 30 }}
            animate={{ width: audioState.isRecording ? 100 : 30 }}
            initial={false}
            transition={animationConfig}
          >
            <AnimatePresence mode="wait">
              {audioState.isTranscribing ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={animationConfig}
                >
                  <IconLoader2 className="animate-spin h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="recording"
                  className="flex items-center justify-center gap-2 w-full"
                  initial={false}
                  animate={{ 
                    paddingRight: audioState.isRecording ? '0.75rem' : '0',
                    paddingLeft: audioState.isRecording ? '0.5rem' : '0'
                  }}
                  transition={animationConfig}
                >
                  <motion.div
                    initial={false}
                    animate={{ scale: audioState.isRecording ? 1.1 : 1 }}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    {audioState.isRecording ? (
                      <IconSquareRoundedFilled className="w-4 h-4 text-white" />
                    ) : (
                      <IconMicrophoneFilled className="w-4 h-4" style={{ color: 'black' }} />
                    )}
                  </motion.div>
                  <AnimatePresence>
                    {audioState.isRecording && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={animationConfig}
                        className="text-white text-sm font-medium whitespace-nowrap"
                        style={{ display: 'inline-block', width: '2.5rem', textAlign: 'center' }}
                      >
                        {formatDuration(audioState.duration)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
          <button
            type="submit"
            className="rounded-lg bg-white text-black hover:bg-gray-100 transition-colors duration-200 flex items-center justify-center"
            aria-label="Start Task"
            disabled={isLoading}
            style={{ width: 30, height: 30 }}
          >
            {isLoading ? (
              <IconLoader2 className="animate-spin h-4 w-4" />
            ) : (
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <IconArrowBigRightFilled className="w-4 h-4" />
              </motion.div>
            )}
          </button>
        </div>
      </form>
      
      {audioState.permissionError && (
        <div className="mt-2 text-red-500 text-sm">
          {audioState.permissionError}
        </div>
      )}
    </div>
  );
} 