import { NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// Store active Stagehand sessions
const activeSessions = new Map<string, Stagehand>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, url } = body;

    if (!sessionId || !url) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get or create Stagehand instance for this session
    let stagehand = activeSessions.get(sessionId);
    if (!stagehand) {
      stagehand = new Stagehand({
        browserbaseSessionID: sessionId,
        env: "BROWSERBASE",
        logger: () => {},
      });
      await stagehand.init();
      activeSessions.set(sessionId, stagehand);
    }

    try {
      // Navigate to the URL using Stagehand
      await stagehand.page.goto(url, {
        waitUntil: "commit",
        timeout: 60000,
      });

      // Get the page content
      const content = await stagehand.page.content();
      const dom = new JSDOM(content);
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      const pageContent = `${article?.title || ''}\n${article?.textContent || ''}`;

      // Get the live view URL using Browserbase SDK
      const bb = new Browserbase({
        apiKey: process.env.BROWSERBASE_API_KEY!,
      });
      const liveViewLinks = await bb.sessions.debug(sessionId);
      const liveViewLink = liveViewLinks.debuggerFullscreenUrl;
      
      return NextResponse.json({
        success: true,
        debugUrl: liveViewLink,
        pageContent: pageContent
      });
    } catch (error) {
      console.error("Error during navigation:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error navigating to URL:", error);
    return NextResponse.json(
      { success: false, error: "Failed to navigate to URL" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const stagehand = activeSessions.get(sessionId);
    let screenshotData = null;

    if (stagehand) {
      try {
        // Create a CDP session for faster screenshots
        const cdpSession = await stagehand.page.context().newCDPSession(stagehand.page);
        const { data } = await cdpSession.send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 100,
          captureBeyondViewport: false
        });

        // Ensure the data is a valid base64 string
        if (data && typeof data === 'string') {
          screenshotData = data;
          console.log('Screenshot captured successfully, length:', data.length);
        } else {
          console.error('Invalid screenshot data format:', typeof data);
        }
      } catch (error) {
        console.error("Error taking screenshot:", error);
      }

      // Close the Stagehand session
      await stagehand.close();
      activeSessions.delete(sessionId);
    }

    return NextResponse.json({ 
      success: true,
      screenshot: screenshotData 
    });
  } catch (error) {
    console.error("Error closing session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to close session" },
      { status: 500 }
    );
  }
} 