"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Dot {
  x: number;
  y: number;
  baseSize: number;
  opacity: number;
  scale: number;
  targetOpacity: number;
  targetScale: number;
  speed: number;
  phase: number; // For wave animation
}

interface DotBackgroundProps {
  isTransitioning?: boolean;
  isRippling?: boolean;
  onTransitionComplete?: () => void;
}

export default function DotBackground({ isTransitioning, isRippling, onTransitionComplete }: DotBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | undefined>(undefined);
  const gridSize = 20; // Size of the grid (pixels between dots)
  const timeRef = useRef(0);
  const transitionStartTimeRef = useRef<number | null>(null);
  const rippleStartTimeRef = useRef<number | null>(null);
  const transitionCenterRef = useRef({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(true);
  const hasTransitionedRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Initialize dots in a grid
  const initDots = useCallback((width: number, height: number) => {
    if (isInitializedRef.current && dotsRef.current.length > 0) return;
    
    const dots: Dot[] = [];
    const columns = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        dots.push({
          x: col * gridSize + gridSize / 2,
          y: row * gridSize + gridSize / 2,
          baseSize: 2,
          opacity: 0.2,
          scale: 1,
          targetOpacity: 0.2,
          targetScale: 1,
          speed: Math.random() * 0.02 + 0.01,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    dotsRef.current = dots;
    isInitializedRef.current = true;
  }, []);

  // Handle transition state changes
  useEffect(() => {
    if (isRippling && !rippleStartTimeRef.current) {
      rippleStartTimeRef.current = performance.now();
      if (canvasRef.current) {
        transitionCenterRef.current = {
          x: canvasRef.current.width / 2,
          y: canvasRef.current.height / 2
        };
      }
    } else if (!isRippling) {
      rippleStartTimeRef.current = null;
    }

    if (isTransitioning) {
      console.log("Starting transition");
      transitionStartTimeRef.current = performance.now();
      setIsVisible(true);
      hasTransitionedRef.current = true;
    }
  }, [isTransitioning, isRippling]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size and initialize dots
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initDots(canvas.width, canvas.height);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current = {
            x: e.clientX,
            y: e.clientY,
          };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    const animate = () => {
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update time
      timeRef.current += 0.03;

      // Check if transition is complete
      if (isTransitioning && transitionStartTimeRef.current) {
        const elapsed = (performance.now() - transitionStartTimeRef.current) / 1000;
        
        // Only start checking for completion after the initial ripple (0.4s)
        if (elapsed >= 0.4) {
          // Check if all dots have faded out
          const allDotsFaded = dotsRef.current.every(dot => {
            // During transition, dots should be fading out
            return dot.opacity < 0.5 && dot.scale < 2.1;
          });

          if (allDotsFaded) {
            console.log("Transition complete - all dots faded");
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            onTransitionComplete?.();
            return;
          }
        }
      }

      // Update and draw dots
      dotsRef.current.forEach((dot) => {
        // Base wave animation - only run if not transitioning
        let wave = 0;
        
        if (!isTransitioning) {
          const randomOffset = Math.sin(dot.phase * 2 + timeRef.current * 0.5) * 0.3;
          wave = Math.sin(timeRef.current + dot.phase) * 0.25 + randomOffset;
        }

        // Ripple effect
        let rippleEffect = 0;
        if (isRippling && rippleStartTimeRef.current) {
          const elapsed = (performance.now() - rippleStartTimeRef.current) / 1000;
          const distanceFromCenter = Math.sqrt(
            Math.pow(dot.x - transitionCenterRef.current.x, 2) +
            Math.pow(dot.y - transitionCenterRef.current.y, 2)
          );
          
          // Create an expanding/contracting ripple effect
          const rippleSpeed = 800; // pixels per second
          const maxDistance = Math.max(
            Math.abs(dot.x - transitionCenterRef.current.x),
            Math.abs(dot.y - transitionCenterRef.current.y)
          ) * 1.5; // Extend slightly beyond the edges
          
          // Calculate the ripple position as it expands and contracts
          const ripplePosition = (elapsed * rippleSpeed) % (maxDistance * 2);
          const distanceToRipple = Math.abs(ripplePosition - distanceFromCenter);
          
          if (distanceToRipple < 100) { // Width of the ripple effect
            // Calculate intensity based on distance to ripple
            const intensity = Math.cos((distanceToRipple / 100) * Math.PI) * 0.5 + 0.5;
            rippleEffect = intensity * 2;
          }
        }

        // Transition effect
        let transitionEffect = 0;
        if (isTransitioning && transitionStartTimeRef.current) {
          const elapsed = (performance.now() - transitionStartTimeRef.current) / 1000;
          const distanceFromCenter = Math.sqrt(
            Math.pow(dot.x - transitionCenterRef.current.x, 2) +
            Math.pow(dot.y - transitionCenterRef.current.y, 2)
          );
          
          // Create a ripple effect that expands outward
          const rippleSpeed = 500; // pixels per second
          const rippleWidth = 200; // width of the ripple effect
          const ripplePosition = (elapsed * rippleSpeed) - distanceFromCenter;
          
          if (ripplePosition > -rippleWidth && ripplePosition < rippleWidth) {
            // Calculate intensity based on position in the ripple
            const intensity = Math.cos((ripplePosition / rippleWidth) * Math.PI) * 0.5 + 0.5;
            transitionEffect = intensity * 2;
          }

          // After the ripple passes through, start fading out
          if (ripplePosition > rippleWidth) {
            const fadeOutStart = rippleWidth;
            const fadeOutEnd = rippleWidth + 300; // Additional distance for fade out
            const fadeOutProgress = Math.min(1, (ripplePosition - fadeOutStart) / (fadeOutEnd - fadeOutStart));
            transitionEffect = 1 - fadeOutProgress;
          }
        }

        // Apply effects to dot properties
        if (isTransitioning) {
          // During transition, make dots white and scale up, then fade out
          dot.targetOpacity = transitionEffect;
          dot.targetScale = 1 + transitionEffect * 2;
        } else if (isRippling) {
          // During rippling, make dots white and scale up/down continuously
          dot.targetOpacity = 0.5 + rippleEffect;
          dot.targetScale = 1 + rippleEffect * 2;
        } else {
          dot.targetOpacity = 0.5 + wave;
          dot.targetScale = 1 + wave * 0.6;
        }

        if (!isTransitioning) {
          const dx = mouseRef.current.x - dot.x;
          const dy = mouseRef.current.y - dot.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            const intensity = (120 - distance) / 120;
            dot.targetOpacity = 0.8 + intensity * 0.8;
            dot.targetScale = 1 + intensity * 3;
          }
        }

        // Smooth transitions
        dot.opacity += (dot.targetOpacity - dot.opacity) * (dot.speed * 2);
        dot.scale += (dot.targetScale - dot.scale) * (dot.speed * 2);

        // Draw dot
        const size = dot.baseSize * dot.scale;
        ctx.fillStyle = `rgba(255, 255, 255, ${dot.opacity})`;
        ctx.fillRect(dot.x - size/2, dot.y - size/2, size, size);
      });

      // If all dots have faded out, we can stop the animation
      if (isTransitioning && dotsRef.current.every(dot => dot.opacity < 0.01)) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        onTransitionComplete?.();
        console.log("im done with the animation")
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isTransitioning, isRippling, initDots, onTransitionComplete]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full pointer-events-none z-0 transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
} 