import { NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";
import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateObject, UserContent } from "ai";
import { z } from "zod";
import { Message } from "../../types/message";

// Initialize the OpenAI client with GPT-4
const LLMClient = openai("gpt-4o");

// Store active Stagehand sessions
const activeSessions = new Map<string, Stagehand>();

// Initialize Browserbase client once
const browserbase = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});

export interface BrowserStep {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "WAIT" | "NAVBACK" | "COMPLETE";
  instruction: string;
  stepNumber?: number;
  // Utility boolean property that has different meanings based on the tool:
  // - For OBSERVE: if true, wait for user input; if false, proceed automatically
  // - For ACT: if true, execute action object from instruction; if false, execute string prompt
  utilityBoolean?: boolean;
  observation?: {
    actions: ActionObject[];
  };
  extraction?: any;
}

interface ActionObject {
  description: string;
  action: string;
  selector: string;
  arguments: [string, ...any[]];
}

async function getOrCreateStagehand(sessionId: string): Promise<Stagehand> {
  let stagehand = activeSessions.get(sessionId);
  if (!stagehand) {
    console.log("Creating new Stagehand instance for session:", sessionId);
    stagehand = new Stagehand({
      browserbaseSessionID: sessionId,
      env: "BROWSERBASE",
      logger: () => {},
    });
    await stagehand.init();
    activeSessions.set(sessionId, stagehand);
  }
  return stagehand;
}

async function getDebugUrl(sessionId: string): Promise<string> {
  const liveViewLinks = await browserbase.sessions.debug(sessionId);
  return liveViewLinks.debuggerFullscreenUrl;
}

async function handleStartAction(stagehand: Stagehand, task: string) {
  const message: CoreMessage = {
    role: "user",
    content: [{
      type: "text",
      text: `Given the goal: "${task}", determine the best URL to start from.
Choose from:
1. Alternative search engines (DuckDuckGo, Bing, Brave Search, etc.) - AVOID Google due to CAPTCHA issues
2. A direct URL if you're confident about the target website
3. Any other appropriate starting point

Return a URL that would be most effective for achieving this goal. If the goal itself is a plain URL, clean it up and return it.`
    }]
  };

  const result = await generateObject({
    model: LLMClient,
    schema: z.object({
      url: z.string().url(),
      reasoning: z.string()
    }),
    messages: [message]
  });

  const firstStep: BrowserStep = {
    text: `Navigating to ${result.object.url}`,
    reasoning: result.object.reasoning,
    tool: "GOTO",
    instruction: result.object.url,
    stepNumber: 1
  };

  await stagehand.page.goto(result.object.url, {
    waitUntil: "commit",
    timeout: 60000,
  });

  return firstStep;
}

async function handleGetNextStep(stagehand: Stagehand, task: string, previousSteps: BrowserStep[]) {
  const currentUrl = stagehand.page.url();

  const content: UserContent = [
    {
      type: "text",
      text: `Consider the following screenshot of a web page (URL: ${currentUrl}), with the goal being "${task}".
${previousSteps.length > 0
    ? `Previous steps taken:
${previousSteps
  .map(
    (step: BrowserStep, index: number) => `
Step ${index + 1}:
- Action: ${step.text}
- Reasoning: ${step.reasoning}
- Tool Used: ${step.tool}
- Instruction: ${step.instruction}
${step.tool === "OBSERVE" && step.observation ? `
- Available Actions: ${JSON.stringify(step.observation.actions)}` : ''}
${step.tool === "EXTRACT" && step.extraction ? `
- Extraction Results: ${JSON.stringify(step.extraction)}` : ''}`
  )
  .join("\n")}`
    : ""
}
Determine the immediate next step to take to achieve the goal. 

Available tools and their purposes:
1. GOTO: Navigate to a specific URL - Use this if the current page isn't helpful or if you need to try a different search engine/website.
   - If this is the tool of choice, make the instruction property of your output object a clean URL.
2. ACT: Perform actions on the current page using Stagehand's act() method and a prompt. 
   - Clicking elements ("click on add to cart"), typing text ("Type 'Browserbase' into the search bar"), and filling in forms ("fill in the form with username and password") are some examples.
   - Keep actions atomic and simple - break complex multi-step actions into smaller steps
   - If there are available actions from a previous OBSERVE step, you can use one of those actions by doing both of the following:
     a. Setting the instruction property to the JSON string of the action object
     b. Setting the utilityBoolean property to true to indicate you're using an action object
3. EXTRACT: Extract structured data from the page using Stagehand's extract() method with zod schemas:
   - Extract single objects: "extract the price of the item"
   - Extract lists of objects: "extract all apartment listings with their details"
   - Always specify the exact fields you want to extract
4. OBSERVE: Get a list of available actions on the current page using Stagehand's observe() method:
   - If this is the tool of choice, you must either:
      - Set the utilityBoolean property to true if you want to show the user a list of possible actions to choose from
      - Set the utilityBoolean property to false if you want to automatically proceed with the next action, passing on these actions for the next agent to possibly act on
5. WAIT: Pause execution for a specified number of milliseconds
6. NAVBACK: Navigate back in browser history
7. COMPLETE: End the session and provide a summary/answer. Use this when:
   - The goal has been achieved
   - The task was just to visit a URL (summarize the page)
   - The task was a question (provide an answer)
   - No further actions are needed
   - If this is the tool of choice, make the text property of your output object a summary. If the task was just a URL, summarize the website content and any potential actions. If the task was an explicit task, summarize the steps you took. If the task was a question, answer the question.

If the current page isn't helpful for achieving the goal, consider using GOTO to try a different URL or search engine. If the goal has been achieved or the task is complete, use COMPLETE.`,
    },
  ];

  console.log(content)

  const cdpSession = await stagehand.page.context().newCDPSession(stagehand.page);
  const { data } = await cdpSession.send("Page.captureScreenshot");
  content.push({
    type: "image",
    image: data,
  });

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
        "WAIT",
        "NAVBACK",
        "COMPLETE"
      ]),
      instruction: z.string(),
      utilityBoolean: z.boolean()
    }),
    messages: [{ role: "user", content }],
  });

  console.log(result.object)

  return {
    ...result.object,
    stepNumber: previousSteps.length + 1
  };
}

async function handleExecuteStep(stagehand: Stagehand, step: BrowserStep, task: string, previousSteps: BrowserStep[]) {
  console.log(`Executing ${step.tool} with the instruction: ${step.instruction}`);

  switch (step.tool) {
    case "GOTO":
      await stagehand.page.goto(step.instruction, {
        waitUntil: "commit",
        timeout: 60000,
      });
      return { success: true, done: false };
    case "ACT":
      if (step.utilityBoolean) {
        const action = JSON.parse(step.instruction) as ActionObject;
        console.log(action)
        await stagehand.page.act(action);
      } else {
        // Execute string prompt
        await stagehand.page.act(step.instruction);
      }
      return { success: true, done: false };
    case "EXTRACT": {
      const { extraction } = await stagehand.page.extract(step.instruction);
      console.log("extraction taking place")
      console.log(extraction)
      return { success: true, extraction, done: false };
    }
    case "OBSERVE": {
      const observation = await stagehand.page.observe({
        instruction: step.instruction
      });
      console.log(observation)
      if (step.utilityBoolean) {
        return { 
          success: true, 
          observation: { actions: observation }, 
          done: true 
        };
      }
      return { 
        success: true, 
        observation: { actions: observation }, 
        done: false 
      };
    }
    case "WAIT":
      await new Promise((resolve) => setTimeout(resolve, Number(step.instruction)));
      return { success: true, done: false };
    case "NAVBACK":
      await stagehand.page.goBack();
      return { success: true, done: false };
    case "COMPLETE":
      return { success: true, done: true };
    default:
      throw new Error(`Unknown tool: ${step.tool}`);
  }
}

async function handleFollowUpStart(stagehand: Stagehand, task: string, previousMessages: Message[]) {
  // Get current page screenshot
  const cdpSession = await stagehand.page.context().newCDPSession(stagehand.page);
  const { data: screenshot } = await cdpSession.send("Page.captureScreenshot");

  // Get current URL
  const currentUrl = await stagehand.page.url();

  // Transform the task to include context from previous messages and current page state
  const context = previousMessages
    .map(msg => `${msg.role}: ${msg.text}`)
    .join("\n");

  const message: CoreMessage = {
    role: "user",
    content: [{
      type: "text",
      text: `Given the goal: "${task}", determine the best immediate action to take.
Current page URL: ${currentUrl}

Previous conversation context:
${context}

Available tools and their purposes:
1. GOTO: Navigate to a specific URL - Use this if the current page isn't helpful or if you need to try a different search engine/website. 
   - If this is the tool of choice, make the instruction property of your output object a clean URL.
2. ACT: Perform actions on the current page using Stagehand's act() method and a prompt.
3. EXTRACT: Extract structured data from the page using Stagehand's extract() method with zod schemas.
4. OBSERVE: Get a list of available actions on the current page using Stagehand's observe() method.
   - Set the utilityBoolean property to true if you want to show the user a list of possible actions to choose from
   - Set the utilityBoolean property to false if you want to automatically proceed with the next action
5. WAIT: Pause execution for a specified number of milliseconds.
6. NAVBACK: Navigate back in browser history.
7. COMPLETE: End the session and provide a summary/answer.

Choose the most appropriate tool and provide a clear instruction for that tool. Consider the current page state and previous context when making your decision.`
    },
    {
      type: "image",
      image: screenshot
    }]
  };

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
        "WAIT",
        "NAVBACK",
        "COMPLETE"
      ]),
      instruction: z.string(),
      utilityBoolean: z.boolean().optional()
    }),
    messages: [message]
  });

  return {
    ...result.object,
    stepNumber: 1
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received request:", { action: body.action, task: body.task });
    const { sessionId, task, previousSteps = [], action, previousMessages = [] } = body;

    if (!sessionId || !task) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const stagehand = await getOrCreateStagehand(sessionId);

    switch (action) {
      case 'START': {
        const debugUrl = await getDebugUrl(sessionId);
        const firstStep = await handleStartAction(stagehand, task);
        return NextResponse.json({
          success: true,
          debugUrl,
          result: firstStep,
          steps: [firstStep],
          done: false
        });
      }

      case 'FOLLOW_UP_START': {
        const firstStep = await handleFollowUpStart(stagehand, task, previousMessages);
        return NextResponse.json({
          success: true,
          result: firstStep,
          steps: [firstStep],
          done: false
        });
      }

      case 'GET_NEXT_STEP': {
        const nextStep = await handleGetNextStep(stagehand, task, previousSteps);
        return NextResponse.json({
          success: true,
          result: nextStep,
          steps: [...previousSteps, nextStep],
          done: nextStep.tool === "COMPLETE"
        });
      }

      case 'EXECUTE_STEP': {
        const { step } = body;
        if (!step) {
          return NextResponse.json(
            { success: false, error: "Missing step in request body" },
            { status: 400 }
          );
        }

        const result = await handleExecuteStep(stagehand, step, task, previousSteps);
        return NextResponse.json(result);
      }

      case 'EXECUTE_ACTION': {
        const { actionObject, sessionId } = body;
        console.log(actionObject)
        if (!actionObject || !sessionId) {
          return NextResponse.json(
            { success: false, error: "Missing required parameters" },
            { status: 400 }
          );
        }

        try {
          const stagehand = await getOrCreateStagehand(sessionId);
          await stagehand.page.act(actionObject);
          return NextResponse.json({
            success: true,
            text: `Executed action: ${actionObject.description}`,
            done: false
          });
        } catch (error) {
          console.error("Action execution failed:", error);
          return NextResponse.json(
            { success: false, error: "Failed to execute action" },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
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
    if (stagehand) {
      await stagehand.close();
      activeSessions.delete(sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error closing session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to close session" },
      { status: 500 }
    );
  }
} 