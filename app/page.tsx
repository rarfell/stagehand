"use client";

import { useState } from "react";
import { websites } from "./data/websites";
import InitialView from "./components/InitialView";
import SessionView from "./components/SessionView";

export default function Home() {
  const [session, setSession] = useState<{
    id: string | null;
    debugUrl: string | null;
    pageContent: string | null;
    isTerminated: boolean;
    screenshot: string | null;
  }>({
    id: null,
    debugUrl: null,
    pageContent: null,
    isTerminated: false,
    screenshot: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSessionVisible, setIsSessionVisible] = useState(false);
  const [pendingSession, setPendingSession] = useState<{
    id: string;
    debugUrl: string;
    pageContent: string;
  } | null>(null);

  const handleSubmit = async (url: string) => {
    setIsLoading(true);

    try {
      // If the input doesn't start with http:// or https://, add https://
      const processedUrl = url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;

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
        throw new Error("Failed to create session");
      }

      const { sessionId: newSessionId, sessionUrl } = await sessionResponse.json();

      // Then navigate to the URL
      const navigateResponse = await fetch("/api/navigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: newSessionId,
          url: processedUrl,
        }),
      });

      if (!navigateResponse.ok) {
        throw new Error("Failed to navigate to URL");
      }

      const { debugUrl, pageContent } = await navigateResponse.json();
      
      // Store the pending session data
      setPendingSession({
        id: newSessionId,
        debugUrl,
        pageContent,
      });
      
      // Start the transition effect
      setIsTransitioning(true);
    } catch (error) {
      alert("Failed to load the website. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransitionComplete = () => {
    if (pendingSession) {
      setSession({
        id: pendingSession.id,
        debugUrl: pendingSession.debugUrl,
        pageContent: pendingSession.pageContent,
        isTerminated: false,
        screenshot: null,
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

      const { screenshot } = await response.json();

      // Start the reverse transition
      setIsTransitioning(true);
      
      // Wait for the session view to fade out
      setTimeout(() => {
        setSession(prev => ({
          ...prev,
          id: null,
          debugUrl: null,
          pageContent: null,
          isTerminated: true,
          screenshot,
        }));
        setIsSessionVisible(false);
        setIsTransitioning(false);
      }, 500); // Match the animation duration
    } catch (error) {
      alert("Failed to terminate the session. Please try again.");
    }
  };

  const handleRefresh = () => {
    // Start the reverse transition
    setIsTransitioning(true);
    
    // Wait for the session view to fade out
    setTimeout(() => {
      setSession({
        id: null,
        debugUrl: null,
        pageContent: null,
        isTerminated: false,
        screenshot: null,
      });
      setIsSessionVisible(false);
      setIsTransitioning(false);
    }, 500); // Match the animation duration
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
        isSessionTerminated={session.isTerminated}
        onTerminate={handleTerminateSession}
        onRefresh={handleRefresh}
        screenshot={session.screenshot}
        pageContent={session.pageContent}
        isVisible={isSessionVisible}
      />
    </div>
  );
}
