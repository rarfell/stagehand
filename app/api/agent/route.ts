/**
 * Agent API Route Handler
 * 
 * This module implements an AI-powered web automation agent that can:
 * 1. Navigate web pages
 * 2. Perform actions on web elements
 * 3. Extract information
 * 4. Observe page content
 * 5. Make decisions based on the current state
 * 
 * The agent uses GPT-4 for decision making and Stagehand for browser automation.
 * It maintains a session-based state to track progress towards a goal.
 */

import { NextResponse } from 'next/server';
import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateObject, UserContent } from "ai";
import { z } from "zod";
import { ObserveResult, Stagehand } from "@browserbasehq/stagehand";

// Initialize the OpenAI client with GPT-4
const LLMClient = openai("gpt-4o");

/**
 * Represents a single step in the agent's execution plan
 * @property {string} text - Human-readable description of the step
 * @property {string} reasoning - The AI's reasoning for choosing this step
 * @property {"GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK"} tool - The type of action to perform
 * @property {string} instruction - Specific instructions for the tool
 */
type Step = {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK";
  instruction: string;
};

/**
 * Executes browser automation commands using Stagehand
 * @param {Object} params - Parameters for the automation
 * @param {string} params.sessionID - Unique identifier for the browser session
 * @param {"GOTO" | "ACT" | "EXTRACT" | "CLOSE" | "SCREENSHOT" | "OBSERVE" | "WAIT" | "NAVBACK"} params.method - Type of action to perform
 * @param {string} [params.instruction] - Specific instructions for the action
 * @returns {Promise<any>} - Result of the action, if any
 * @throws {Error} - If the automation fails
 */
async function runStagehand({
  sessionID,
  method,
  instruction,
}: {
  sessionID: string;
  method: "GOTO" | "ACT" | "EXTRACT" | "CLOSE" | "SCREENSHOT" | "OBSERVE" | "WAIT" | "NAVBACK";
  instruction?: string;
}) {
  // Initialize a new Stagehand instance with the provided session ID
  // Stagehand is a browser automation tool that provides a high-level API for web interactions
  const stagehand = new Stagehand({
    browserbaseSessionID: sessionID,
    env: "BROWSERBASE",
    logger: () => {}, // Disable logging for cleaner output
  });
  await stagehand.init();

  const page = stagehand.page;

  try {
    // Execute the requested action based on the method
    switch (method) {
      case "GOTO":
        // Navigate to a specific URL with a 60-second timeout
        // waitUntil: "commit" ensures the page has started loading
        await page.goto(instruction!, {
          waitUntil: "commit",
          timeout: 60000,
        });
        break;

      case "ACT":
        // Perform a specific action on the page (click, type, etc.)
        await page.act(instruction!);
        break;

      case "EXTRACT": {
        // Extract specific content from the page based on the instruction
        const { extraction } = await page.extract(instruction!);
        return extraction;
      }

      case "OBSERVE":
        // Observe the current state of the page, including accessibility tree
        return await page.observe({
          instruction,
          useAccessibilityTree: true,
        });

      case "CLOSE":
        // Clean up and close the browser session
        await stagehand.close();
        break;

      case "SCREENSHOT": {
        // Take a screenshot of the current page using Chrome DevTools Protocol
        const cdpSession = await page.context().newCDPSession(page);
        const { data } = await cdpSession.send("Page.captureScreenshot");
        return data;
      }

      case "WAIT":
        // Wait for a specified number of milliseconds
        await new Promise((resolve) =>
          setTimeout(resolve, Number(instruction))
        );
        break;

      case "NAVBACK":
        // Navigate back in browser history
        await page.goBack();
        break;
    }
  } catch (error) {
    // Ensure browser session is closed even if an error occurs
    await stagehand.close();
    throw error;
  }
}

/**
 * Sends a prompt to the LLM to determine the next step
 * @param {Object} params - Parameters for the prompt
 * @param {string} params.goal - The overall goal to achieve
 * @param {string} params.sessionID - Unique identifier for the browser session
 * @param {Step[]} [params.previousSteps] - History of steps taken so far
 * @param {string | ObserveResult[]} [params.previousExtraction] - Results from previous extractions or observations
 * @returns {Promise<{result: Step, previousSteps: Step[]}>} - The next step and updated history
 */
async function sendPrompt({
  goal,
  sessionID,
  previousSteps = [],
  previousExtraction,
}: {
  goal: string;
  sessionID: string;
  previousSteps?: Step[];
  previousExtraction?: string | ObserveResult[];
}) {
  // Get the current URL for context
  let currentUrl = "";

  try {
    // Initialize a temporary Stagehand instance to get the current page URL
    const stagehand = new Stagehand({
      browserbaseSessionID: sessionID,
      env: "BROWSERBASE"
    });
    await stagehand.init();
    currentUrl = await stagehand.page.url();
    await stagehand.close();
  } catch (error) {
    console.error('Error getting page info:', error);
  }

  // Construct the prompt for the LLM
  const content: UserContent = [
    {
      type: "text",
      text: `Consider the following screenshot of a web page${currentUrl ? ` (URL: ${currentUrl})` : ''}, with the goal being "${goal}".
${previousSteps.length > 0
    ? `Previous steps taken:
${previousSteps
  .map(
    (step, index) => `
Step ${index + 1}:
- Action: ${step.text}
- Reasoning: ${step.reasoning}
- Tool Used: ${step.tool}
- Instruction: ${step.instruction}
`
  )
  .join("\n")}`
    : ""
}
Determine the immediate next step to take to achieve the goal. 

Important guidelines:
1. Break down complex actions into individual atomic steps
2. For ACT commands, use only one action at a time, such as:
   - Single click on a specific element
   - Type into a single input field
   - Select a single option
3. Avoid combining multiple actions in one instruction
4. If multiple actions are needed, they should be separate steps

If the goal has been achieved, return "close".`,
    },
  ];

  // Add a screenshot to the prompt if we've navigated to a new page
  if (previousSteps.length > 0 && previousSteps.some((step) => step.tool === "GOTO")) {
    content.push({
      type: "image",
      image: (await runStagehand({
        sessionID,
        method: "SCREENSHOT",
      })) as string,
    });
  }

  // Add previous extraction/observation results to the prompt
  if (previousExtraction) {
    content.push({
      type: "text",
      text: `The result of the previous ${
        Array.isArray(previousExtraction) ? "observation" : "extraction"
      } is: ${previousExtraction}.`,
    });
  }

  // Prepare the message for the LLM
  const message: CoreMessage = {
    role: "user",
    content,
  };

  // Generate the next step using the LLM
  const result = await generateObject({
    model: LLMClient,
    schema: z.object({
      text: z.string(),
      reasoning: z.string(),
      tool: z.enum([
        "GOTO",
        "ACT",
        "EXTRACT",
        "OBSERVE",
        "CLOSE",
        "WAIT",
        "NAVBACK",
      ]),
      instruction: z.string(),
    }),
    messages: [message],
  });

  // Return the new step and updated history
  return {
    result: result.object,
    previousSteps: [...previousSteps, result.object],
  };
}

/**
 * Determines the best starting URL for a given goal
 * @param {string} goal - The goal to achieve
 * @returns {Promise<{url: string, reasoning: string}>} - The selected URL and reasoning
 */
async function selectStartingUrl(goal: string) {
  // Prepare the prompt for the LLM to determine the starting URL
  const message: CoreMessage = {
    role: "user",
    content: [{
      type: "text",
      text: `Given the goal: "${goal}", determine the best URL to start from.
Choose from:
1. A relevant search engine (Google, Bing, etc.)
2. A direct URL if you're confident about the target website
3. Any other appropriate starting point

Return a URL that would be most effective for achieving this goal.`
    }]
  };

  // Generate the starting URL using the LLM
  const result = await generateObject({
    model: LLMClient,
    schema: z.object({
      url: z.string().url(),
      reasoning: z.string()
    }),
    messages: [message]
  });

  return result.object;
}

/**
 * GET endpoint handler
 * @returns {Promise<NextResponse>} - Response indicating the API is ready
 */
export async function GET() {
  return NextResponse.json({ message: 'Agent API endpoint ready' });
}

/**
 * POST endpoint handler for agent actions
 * @param {Request} request - The incoming HTTP request
 * @returns {Promise<NextResponse>} - Response containing the result of the action
 * 
 * Supported actions:
 * - START: Initialize a new session and determine the starting URL
 * - GET_NEXT_STEP: Get the next step to take
 * - EXECUTE_STEP: Execute a specific step
 */
export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { goal, sessionId, previousSteps = [], action } = body;

    // Validate required parameters
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId in request body' },
        { status: 400 }
      );
    }

    // Handle different action types
    switch (action) {
      case 'START': {
        // Validate goal for START action
        if (!goal) {
          return NextResponse.json(
            { error: 'Missing goal in request body' },
            { status: 400 }
          );
        }

        // Determine the starting URL and create the first step
        const { url, reasoning } = await selectStartingUrl(goal);
        const firstStep = {
          text: `Navigating to ${url}`,
          reasoning,
          tool: "GOTO" as const,
          instruction: url
        };
        
        // Execute the first step
        await runStagehand({
          sessionID: sessionId,
          method: "GOTO",
          instruction: url
        });

        return NextResponse.json({ 
          success: true,
          result: firstStep,
          steps: [firstStep],
          done: false
        });
      }

      case 'GET_NEXT_STEP': {
        // Validate goal for GET_NEXT_STEP action
        if (!goal) {
          return NextResponse.json(
            { error: 'Missing goal in request body' },
            { status: 400 }
          );
        }

        // Get the next step from the LLM
        const { result, previousSteps: newPreviousSteps } = await sendPrompt({
          goal,
          sessionID: sessionId,
          previousSteps,
        });

        return NextResponse.json({
          success: true,
          result,
          steps: newPreviousSteps,
          done: result.tool === "CLOSE"
        });
      }

      case 'EXECUTE_STEP': {
        const { step } = body;
        // Validate step for EXECUTE_STEP action
        if (!step) {
          return NextResponse.json(
            { error: 'Missing step in request body' },
            { status: 400 }
          );
        }

        // Execute the step using Stagehand
        const extraction = await runStagehand({
          sessionID: sessionId,
          method: step.tool,
          instruction: step.instruction,
        });

        return NextResponse.json({
          success: true,
          extraction,
          done: step.tool === "CLOSE"
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action type' },
          { status: 400 }
        );
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error('Error in agent endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 