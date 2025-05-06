"use client";

import { useState, useRef, useCallback } from "react";
import InitialView from "./components/InitialView";
import SessionView from "./components/SessionView";
import { BrowserStep } from "./api/navigate/route";
import { Message } from "./types/message";

interface AgentState {
  sessionId: string | null;
  sessionUrl: string | null;
  steps: BrowserStep[];
  isLoading: boolean;
}

export default function Home() {
  const [session, setSession] = useState<{
    id: string | null;
    debugUrl: string | null;
    isTerminated: boolean;
    screenshot: string | null;
    messages: Message[];
    currentUrl: string | null;
    isAgentComplete: boolean;
  }>({
    id: null,
    debugUrl: null,
    isTerminated: false,
    screenshot: null,
    messages: [],
    currentUrl: null,
    isAgentComplete: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSessionVisible, setIsSessionVisible] = useState(false);
  const [pendingSession, setPendingSession] = useState<{
    id: string;
    debugUrl: string;
  } | null>(null);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);
  const [logMessage, setLogMessage] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const agentStateRef = useRef<AgentState>({
    sessionId: null,
    sessionUrl: null,
    steps: [],
    isLoading: false,
  });

  const generateSpeech = useCallback(async (text: string) => {
    // Add the new text to the queue
    audioQueueRef.current.push(text);
    
    // If we're already speaking, just queue it up
    if (isSpeaking) {
      return;
    }

    // Start processing the queue without awaiting
    processQueue();
  }, [isSpeaking]);

  const processQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      setIsSpeaking(false);
      return;
    }

    const nextText = audioQueueRef.current[0];
    console.log('Requesting speech generation for:', nextText);
    
    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nextText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to generate speech');
      }
      
      const { audioData } = await response.json();
      
      if (!audioData || !Array.isArray(audioData)) {
        throw new Error('Invalid audio data received');
      }

      console.log('Received audio data, creating blob');
      
      const audioBlob = new Blob([new Uint8Array(audioData)], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        setIsSpeaking(true);
        
        audioRef.current.onended = () => {
          // Remove the processed text from queue
          audioQueueRef.current.shift();
          URL.revokeObjectURL(audioUrl);
          // Process next item in queue
          processQueue();
        };

        // Remove await to make it non-blocking
        audioRef.current.play().catch(error => {
          console.error('Audio playback error:', error);
          // Remove the failed item from queue
          audioQueueRef.current.shift();
          // Try to process next item
          if (audioQueueRef.current.length > 0) {
            processQueue();
          } else {
            setIsSpeaking(false);
          }
        });
      }
    } catch (error) {
      console.error('Speech generation error:', error);
      // Remove the failed item from queue
      audioQueueRef.current.shift();
      // Try to process next item
      if (audioQueueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    }
  }, []);

  const addLogMessage = useCallback((message: string) => {
    setLogMessage(message);
    generateSpeech(message);
  }, [generateSpeech]);

  const handleSubmit = async (task: string) => {
    setIsLoading(true);
    setCurrentTask(task);
    setLogMessage(""); // Clear previous log message
    // Clear the audio queue when starting a new task
    audioQueueRef.current = [];

    // Set isAgentComplete to false when starting a new task
    setSession(prev => ({
      ...prev,
      isAgentComplete: false
    }));

    // Add the user's task as the first message
    const userMessage: Message = {
      text: task,
      role: "user",
      conversationId: session.id || undefined
    };

    try {
      addLogMessage("Initializing new browser session...");
      // First, create a new session
      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        console.error("Session creation failed:", errorData);
        throw new Error("Failed to create session");
      }

      const { sessionId: newSessionId, sessionUrl } = await sessionResponse.json();
  

      // Then start the agent with the task
      addLogMessage("Initializing agent with task...");
      const navigateResponse = await fetch("/api/navigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: newSessionId,
          task,
          action: "START",
        }),
      });

      if (!navigateResponse.ok) {
        const errorData = await navigateResponse.json();
        console.error("Agent start failed:", errorData);
        throw new Error("Failed to start agent");
      }

      const { debugUrl, result, steps } = await navigateResponse.json();
      addLogMessage("Agent initialized successfully...");
      
      // Store the pending session data
      setPendingSession({
        id: newSessionId,
        debugUrl,
      });

      // Update agent state
      agentStateRef.current = {
        sessionId: newSessionId,
        sessionUrl: sessionUrl,
        steps: steps,
        isLoading: false,
      };

      // Get the current URL from the first step's instruction if it's a GOTO
      const initialUrl = steps[0].tool === "GOTO" ? steps[0].instruction : null;
      
      // Start the transition effect
      setIsTransitioning(true);

      // Set the initial URL in the session state
      setSession(prev => ({
        ...prev,
        currentUrl: initialUrl
      }));

      // Continue with subsequent steps
      while (true) {
        // Get next step from LLM
        const nextStepResponse = await fetch("/api/navigate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: newSessionId,
            task,
            previousSteps: agentStateRef.current.steps,
            action: "GET_NEXT_STEP",
          }),
        });

        if (!nextStepResponse.ok) {
          const errorData = await nextStepResponse.json();
          console.error("Get next step failed:", errorData);
          throw new Error("Failed to get next step");
        }

        const nextStepData = await nextStepResponse.json();

        // Add the next step to UI immediately after receiving it
        const nextStep = {
          ...nextStepData.result,
          stepNumber: agentStateRef.current.steps.length + 1,
        };

        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [...agentStateRef.current.steps, nextStep],
        };

        // Convert steps to messages
        const messages: Message[] = [
          userMessage,
          ...agentStateRef.current.steps.map(step => ({
            text: step.text,
            role: "agent" as const,
            reasoning: step.reasoning,
            tool: step.tool,
            instruction: step.instruction,
            stepNumber: step.stepNumber,
            conversationId: newSessionId,
          }))
        ];

        setSession(prev => ({
          ...prev,
          messages,
        }));

        // Queue the speech generation without awaiting
        generateSpeech(nextStep.text);

        // Update current URL if the step was a GOTO
        if (nextStep.tool === "GOTO") {
          setSession(prev => ({
            ...prev,
            currentUrl: nextStep.instruction
          }));
        }

        // Break if the step is COMPLETE
        if (nextStep.tool === "COMPLETE") {
          break;
        }

        // Execute the step
        const executeResponse = await fetch("/api/navigate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: newSessionId,
            step: nextStepData.result,
            task,
            action: "EXECUTE_STEP",
          }),
        });

        if (!executeResponse.ok) {
          const errorData = await executeResponse.json();
          console.error("Step execution failed:", errorData);
          throw new Error("Failed to execute step");
        }

        const executeData = await executeResponse.json();
        console.log("Execute step response:", executeData);

        // Update the step with execution results
        const updatedStep = {
          ...nextStep,
          observation: executeData.observation,
          extraction: executeData.extraction
        };

        // Update agent state with the updated step
        agentStateRef.current = {
          ...agentStateRef.current,
          steps: agentStateRef.current.steps.map((step, idx) => 
            idx === agentStateRef.current.steps.length - 1 ? updatedStep : step
          )
        };

        // If this was an OBSERVE step with waitForUserInput, update the last message with the observation
        if (nextStep.tool === "OBSERVE" && executeData.observation) {
          setSession(prev => ({
            ...prev,
            messages: prev.messages.map((msg, idx) => 
              idx === prev.messages.length - 1 
                ? { ...msg, observation: JSON.stringify(executeData.observation) }
                : msg
            )
          }));
        } else if (nextStep.tool === "EXTRACT" && executeData.extraction) {
          setSession(prev => ({
            ...prev,
            messages: prev.messages.map((msg, idx) => 
              idx === prev.messages.length - 1 
                ? { ...msg, extraction: JSON.stringify(executeData.extraction) }
                : msg
            )
          }));
        }

        // Break if we're waiting for user input or if the step is done
        if ((nextStep.tool === "OBSERVE" && nextStep.utilityBoolean) || executeData.done) {
          break;
        }
      }

      if (pendingSession) {
        setSession({
          id: pendingSession.id,
          debugUrl: pendingSession.debugUrl,
          isTerminated: false,
          screenshot: null,
          messages: [{
            text: currentTask || "",
            role: "user"
          }],
          currentUrl: initialUrl,
          isAgentComplete: false,
        });
        setPendingSession(null);
      }
      setIsSessionVisible(true);

      // Set isAgentComplete to true when the task is complete
      setSession(prev => ({
        ...prev,
        isAgentComplete: true
      }));

    } catch (error) {
      console.error("Agent error:", error);
      // Set isAgentComplete to true even on error
      setSession(prev => ({
        ...prev,
        isAgentComplete: true
      }));
      addLogMessage("Error: " + (error instanceof Error ? error.message : "Unknown error occurred"));
      alert("Failed to start the agent. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = useCallback(async (task: string) => {
    if (!session.id) return;

    setIsLoading(true);
    setCurrentTask(task);
    // Clear the audio queue when starting a new follow-up
    audioQueueRef.current = [];

    // Reset agent state for the new follow-up
    agentStateRef.current = {
      sessionId: session.id,
      sessionUrl: session.debugUrl,
      steps: [],
      isLoading: false,
    };

    // Set isAgentComplete to false when starting a new follow-up
    setSession(prev => ({
      ...prev,
      isAgentComplete: false
    }));

    try {
      const navigateResponse = await fetch("/api/navigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          task,
          action: "FOLLOW_UP_START",
          previousMessages: session.messages,
        }),
      });

      if (!navigateResponse.ok) {
        const errorData = await navigateResponse.json();
        console.error("Follow-up start failed:", errorData);
        throw new Error("Failed to start follow-up");
      }

      const { result, steps } = await navigateResponse.json();

      // Update agent state with first step
      agentStateRef.current = {
        ...agentStateRef.current,
        steps: [result],
        isLoading: false,
      };

      // Update current URL if the first step is a GOTO
      if (result.tool === "GOTO") {
        setSession(prev => ({
          ...prev,
          currentUrl: result.instruction
        }));
      }

      // Add the first step to messages
      setSession(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            text: result.text,
            role: "agent" as const,
            reasoning: result.reasoning,
            tool: result.tool,
            instruction: result.instruction,
            stepNumber: result.stepNumber,
            conversationId: session.id || undefined,

          }
        ],
      }));

      // Queue the speech generation without awaiting
      generateSpeech(result.text);

      // Execute the first step immediately
      if (result.tool !== "COMPLETE") {
        const executeResponse = await fetch("/api/navigate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: session.id,
            step: result,
            task,
            action: "EXECUTE_STEP",
          }),
        });

        if (!executeResponse.ok) {
          const errorData = await executeResponse.json();
          console.error("Step execution failed:", errorData);
          throw new Error("Failed to execute step");
        }

        const executeData = await executeResponse.json();

        // Update the step with execution results
        const updatedStep = {
          ...result,
          observation: executeData.observation,
          extraction: executeData.extraction
        };

        // Update agent state with the updated step
        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [updatedStep],
        };

        // If this was an OBSERVE step with waitForUserInput, update the last message with the observation
        if (result.tool === "OBSERVE" && executeData.observation) {
          setSession(prev => ({
            ...prev,
            messages: prev.messages.map((msg, idx) => 
              idx === prev.messages.length - 1 
                ? { ...msg, observation: JSON.stringify(executeData.observation) }
                : msg
            )
          }));
        } else if (result.tool === "EXTRACT" && executeData.extraction) {
          setSession(prev => ({
            ...prev,
            messages: prev.messages.map((msg, idx) => 
              idx === prev.messages.length - 1 
                ? { ...msg, extraction: JSON.stringify(executeData.extraction) }
                : msg
            )
          }));
        }

        if (executeData.done) {
          // Set isAgentComplete to true if we're waiting for user input
          if (result.tool === "OBSERVE" && result.utilityBoolean) {
            setSession(prev => ({
              ...prev,
              isAgentComplete: true
            }));
          }
          return;
        }
      }

      // Continue with subsequent steps
      while (true) {
        console.log("Getting next step...");
        const nextStepResponse = await fetch("/api/navigate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: session.id,
            task,
            previousSteps: agentStateRef.current.steps,
            action: "GET_NEXT_STEP",
          }),
        });

        if (!nextStepResponse.ok) {
          const errorData = await nextStepResponse.json();
          console.error("Get next step failed:", errorData);
          throw new Error("Failed to get next step");
        }

        const nextStepData = await nextStepResponse.json();
        const nextStep = {
          ...nextStepData.result,
          stepNumber: agentStateRef.current.steps.length + 1,
        };

        // Update agent state
        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [...agentStateRef.current.steps, nextStep],
        };

        // Update messages with new step
        setSession(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              text: nextStep.text,
              role: "agent" as const,
              reasoning: nextStep.reasoning,
              tool: nextStep.tool,
              instruction: nextStep.instruction,
              stepNumber: nextStep.stepNumber,
              conversationId: session.id || undefined,
              observation: nextStep.tool === "OBSERVE" ? JSON.stringify(nextStep.observation) : undefined,
              extraction: nextStep.tool === "EXTRACT" ? JSON.stringify(nextStep.extraction) : undefined
            }
          ],
        }));

        // Queue the speech generation without awaiting
        generateSpeech(nextStep.text);

        // Update current URL if the step is a GOTO
        if (nextStep.tool === "GOTO") {
          setSession(prev => ({
            ...prev,
            currentUrl: nextStep.instruction
          }));
        }

        if (nextStep.tool === "COMPLETE") {
          console.log("Agent completed follow-up task");
          break;
        }

        console.log("Executing step:", nextStep);
        const executeResponse = await fetch("/api/navigate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: session.id,
            step: nextStepData.result,
            task,
            action: "EXECUTE_STEP",
          }),
        });

        if (!executeResponse.ok) {
          const errorData = await executeResponse.json();
          console.error("Step execution failed:", errorData);
          throw new Error("Failed to execute step");
        }

        const executeData = await executeResponse.json();
        console.log("Step executed:", executeData);

        // Update the step with execution results
        const updatedStep = {
          ...nextStep,
          observation: executeData.observation,
          extraction: executeData.extraction
        };

        // Update agent state with the updated step
        agentStateRef.current = {
          ...agentStateRef.current,
          steps: agentStateRef.current.steps.map((step, idx) => 
            idx === agentStateRef.current.steps.length - 1 ? updatedStep : step
          )
        };

        // If this was an OBSERVE step with waitForUserInput, update the last message with the observation
        if (nextStep.tool === "OBSERVE" && executeData.observation) {
          setSession(prev => ({
            ...prev,
            messages: prev.messages.map((msg, idx) => 
              idx === prev.messages.length - 1 
                ? { ...msg, observation: JSON.stringify(executeData.observation) }
                : msg
            )
          }));
        } else if (nextStep.tool === "EXTRACT" && executeData.extraction) {
          setSession(prev => ({
            ...prev,
            messages: prev.messages.map((msg, idx) => 
              idx === prev.messages.length - 1 
                ? { ...msg, extraction: JSON.stringify(executeData.extraction) }
                : msg
            )
          }));
        }

        if (executeData.done) {
          // Set isAgentComplete to true if we're waiting for user input
          if (nextStep.tool === "OBSERVE" && nextStep.utilityBoolean) {
            setSession(prev => ({
              ...prev,
              isAgentComplete: true
            }));
          }
          console.log("Agent completed follow-up task");
          break;
        }
      }

      // Set isAgentComplete to true when the follow-up is complete
      setSession(prev => ({
        ...prev,
        isAgentComplete: true
      }));

    } catch (error) {
      console.error("Follow-up error:", error);
      // Set isAgentComplete to true even on error
      setSession(prev => ({
        ...prev,
        isAgentComplete: true
      }));
      alert("Failed to process follow-up. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [session.id, session.messages, session.debugUrl, generateSpeech]);

  const handleTransitionComplete = () => {
    if (pendingSession) {
      setSession({
        id: pendingSession.id,
        debugUrl: pendingSession.debugUrl,
        isTerminated: false,
        screenshot: null,
        messages: [{
          text: currentTask || "",
          role: "user"
        }],
        currentUrl: null,
        isAgentComplete: false,
      });
      setPendingSession(null);
      setIsSessionVisible(true);
    }
    setIsTransitioning(false);
  };

  const handleTerminateSession = async () => {
    if (!session.id) return;

    try {
      const response = await fetch("/api/navigate", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to terminate session");
      }

      setSession(prev => ({
        ...prev,
        isTerminated: true
      }));
    } catch (error) {
      alert("Failed to terminate the session. Please try again.");
    }
  };

  const handleReturnToStart = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSession({
        id: null,
        debugUrl: null,
        isTerminated: false,
        screenshot: null,
        messages: [],
        currentUrl: null,
        isAgentComplete: false,
      });
      setIsSessionVisible(false);
      setIsTransitioning(false);
    }, 500);
  };

  const handleMessageSubmit = useCallback((message: Message) => {
    setSession(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  }, []);

  const handleLoadChat = useCallback((messages: Message[]) => {
    setSession(prev => ({
      ...prev,
      messages,
      isTerminated: false
    }));
  }, []);

  const handleExecuteAction = useCallback(async (actionObject: any) => {
    if (!session.id) return;

    // Add user's action selection message immediately
    setSession(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          text: `Selected action: ${actionObject.description}`,
          role: "user" as const,
          conversationId: session.id || undefined
        }
      ]
    }));

    try {
      const response = await fetch("/api/navigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          action: "EXECUTE_ACTION",
          actionObject,
          task: "Executing selected action"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to execute action");
      }

      const result = await response.json();
      
      // Add the result message to the chat
      setSession(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            text: result.text,
            role: "agent" as const,
            conversationId: session.id || undefined
          }
        ],
        // Set isAgentComplete to true after action execution
        isAgentComplete: true
      }));

      // Queue the speech generation without awaiting
      generateSpeech(result.text);

    } catch (error) {
      console.error("Action execution error:", error);
      // Add error message to chat
      setSession(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            text: "Failed to execute action. Please try again.",
            role: "agent" as const,
            conversationId: session.id || undefined
          }
        ],
        // Set isAgentComplete to true even on error
        isAgentComplete: true
      }));
    }
  }, [session.id, generateSpeech]);

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 relative">
      <InitialView 
        onSubmit={handleSubmit} 
        isLoading={isLoading} 
        isTransitioning={isTransitioning}
        onTransitionComplete={handleTransitionComplete}
        logMessage={logMessage}
      />
      <SessionView
        debugUrl={session.debugUrl}
        onTerminate={handleTerminateSession}
        onReturnToStart={handleReturnToStart}
        screenshot={session.screenshot}
        messages={session.messages}
        isLoading={isLoading}
        isVisible={isSessionVisible}
        isAgentComplete={session.isAgentComplete}
        isTerminated={session.isTerminated}
        onFollowUp={handleFollowUp}
        onMessageSubmit={handleMessageSubmit}
        onLoadChat={handleLoadChat}
        currentUrl={session.currentUrl}
        onExecuteAction={handleExecuteAction}
      />
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
