"use client";

import { useState, useRef } from "react";
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
  }>({
    id: null,
    debugUrl: null,
    isTerminated: false,
    screenshot: null,
    messages: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSessionVisible, setIsSessionVisible] = useState(false);
  const [pendingSession, setPendingSession] = useState<{
    id: string;
    debugUrl: string;
  } | null>(null);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);
  const agentStateRef = useRef<AgentState>({
    sessionId: null,
    sessionUrl: null,
    steps: [],
    isLoading: false,
  });

  const handleSubmit = async (task: string) => {
    setIsLoading(true);
    setCurrentTask(task);

    // Add the user's task as the first message
    const userMessage: Message = {
      text: task,
      role: "user"
    };

    try {
      console.log("Starting new session...");
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
      console.log("Session created:", { newSessionId, sessionUrl });

      // Then start the agent with the task
      console.log("Starting agent with task:", task);
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
      console.log("Agent started:", { debugUrl, result, steps });
      
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
      
      // Start the transition effect
      setIsTransitioning(true);

      // Continue with subsequent steps
      while (true) {
        console.log("Getting next step...");
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
        console.log("Next step received:", nextStepData);

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
          }))
        ];

        setSession(prev => ({
          ...prev,
          messages,
        }));

        // Break after adding the CLOSE step to UI
        if (nextStepData.done || nextStepData.result.tool === "CLOSE") {
          console.log("Agent completed task");
          
          // Add summary step
          const summaryResponse = await fetch("/api/navigate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: newSessionId,
              task,
              previousSteps: agentStateRef.current.steps,
              action: "EXECUTE_STEP",
              step: {
                text: "Generating summary of actions taken",
                reasoning: "Summarizing the task completion and results",
                tool: "SUMMARIZE",
                instruction: "Summarize the task completion and results",
                stepNumber: agentStateRef.current.steps.length + 1
              }
            }),
          });

          if (!summaryResponse.ok) {
            const errorData = await summaryResponse.json();
            console.error("Summary generation failed:", errorData);
            throw new Error("Failed to generate summary");
          }

          const summaryData = await summaryResponse.json();
          
          // Add summary to messages
          const summaryMessage: Message = {
            text: summaryData.summary,
            role: "agent",
            reasoning: "Final summary of task completion",
            tool: "SUMMARIZE",
            stepNumber: agentStateRef.current.steps.length + 1
          };

          setSession(prev => ({
            ...prev,
            messages: [...prev.messages, summaryMessage]
          }));

          break;
        }

        console.log("Executing step:", nextStep);
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
        console.log("Step executed:", executeData);

        if (executeData.done) {
          console.log("Agent completed task");
          break;
        }
      }
    } catch (error) {
      console.error("Agent error:", error);
      alert("Failed to start the agent. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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

      setIsTransitioning(true);
      
      setTimeout(() => {
        setSession({
          id: null,
          debugUrl: null,
          isTerminated: false,
          screenshot: null,
          messages: [],
        });
        setIsSessionVisible(false);
        setIsTransitioning(false);
      }, 500); // Match the animation duration
    } catch (error) {
      alert("Failed to terminate the session. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 relative">
      <InitialView 
        onSubmit={handleSubmit} 
        isLoading={isLoading} 
        isTransitioning={isTransitioning}
        onTransitionComplete={handleTransitionComplete}
      />
      <SessionView
        debugUrl={session.debugUrl}
        onTerminate={handleTerminateSession}
        screenshot={session.screenshot}
        messages={session.messages}
        isLoading={isLoading}
        isVisible={isSessionVisible}
      />
    </div>
  );
}
