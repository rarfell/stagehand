import { NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";
import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateObject, UserContent } from "ai";
import { z } from "zod";

// Initialize the OpenAI client with GPT-4
const LLMClient = openai("gpt-4o");

// Store active Stagehand sessions
const activeSessions = new Map<string, Stagehand>();

export interface BrowserStep {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK" | "SUMMARIZE";
  instruction: string;
  stepNumber?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received request:", { action: body.action, task: body.task });
    const { sessionId, task, previousSteps = [], action } = body;

    if (!sessionId || !task) {
      console.error("Missing required parameters:", { sessionId, task });
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get or create Stagehand instance for this session
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

    try {
      // Get the live view URL using Browserbase SDK
      const bb = new Browserbase({
        apiKey: process.env.BROWSERBASE_API_KEY!,
      });
      const liveViewLinks = await bb.sessions.debug(sessionId);
      const liveViewLink = liveViewLinks.debuggerFullscreenUrl;

      // Handle different action types
      switch (action) {
        case 'START': {
          console.log("Processing START action");
          // Prepare the prompt for the LLM to determine the starting URL
          const message: CoreMessage = {
            role: "user",
            content: [{
              type: "text",
              text: `Given the goal: "${task}", determine the best URL to start from.
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

          console.log("LLM response:", result.object);

          const firstStep: BrowserStep = {
            text: `Navigating to ${result.object.url}`,
            reasoning: result.object.reasoning,
            tool: "GOTO",
            instruction: result.object.url,
            stepNumber: 1
          };

          console.log("Executing first step:", firstStep);
          // Execute the first step
          await stagehand.page.goto(result.object.url, {
            waitUntil: "commit",
            timeout: 60000,
          });

          return NextResponse.json({
            success: true,
            debugUrl: liveViewLink,
            result: firstStep,
            steps: [firstStep],
            done: false
          });
        }

        case 'GET_NEXT_STEP': {
          // Get the current URL for context
          const currentUrl = await stagehand.page.url();

          // Construct the prompt for the LLM
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

          // Add a screenshot to the prompt
          const cdpSession = await stagehand.page.context().newCDPSession(stagehand.page);
          const { data } = await cdpSession.send("Page.captureScreenshot");
          content.push({
            type: "image",
            image: data,
          });

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
            messages: [{ role: "user", content }],
          });

          const nextStep: BrowserStep = {
            ...result.object,
            stepNumber: previousSteps.length + 1
          };

          return NextResponse.json({
            success: true,
            result: nextStep,
            steps: [...previousSteps, nextStep],
            done: nextStep.tool === "CLOSE"
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

          console.log(`executing ${step.tool} with the instruction: ${step.instruction}`)

          // Execute the step based on the tool
          switch (step.tool) {
            case "GOTO":
              await stagehand.page.goto(step.instruction, {
                waitUntil: "commit",
                timeout: 60000,
              });
              break;
            case "ACT":
              await stagehand.page.act(step.instruction);
              break;
            case "EXTRACT": {
              const { extraction } = await stagehand.page.extract(step.instruction);
              return NextResponse.json({
                success: true,
                extraction,
                done: false
              });
            }
            case "OBSERVE":
              const observation = await stagehand.page.observe({
                instruction: step.instruction,
                useAccessibilityTree: true,
              });
              return NextResponse.json({
                success: true,
                observation,
                done: false
              });
            case "CLOSE":
              return NextResponse.json({
                success: true,
                done: true
              });
            case "WAIT":
              await new Promise((resolve) =>
                setTimeout(resolve, Number(step.instruction))
              );
              break;
            case "NAVBACK":
              await stagehand.page.goBack();
              break;
            case "SUMMARIZE": {
              // Get a screenshot for context
              const cdpSession = await stagehand.page.context().newCDPSession(stagehand.page);
              const { data } = await cdpSession.send("Page.captureScreenshot");

              // Prepare the prompt for summarization
              const message: CoreMessage = {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Given the following 'task': "${task}" and the previous steps taken:
${previousSteps.map((step: BrowserStep, index: number) => `
Step ${index + 1}:
- Action: ${step.text}
- Reasoning: ${step.reasoning}
- Tool Used: ${step.tool}
- Instruction: ${step.instruction}
`).join("\n")}

If 'task' was just a URL, ignore the list of steps and summarize what you see in the screenshot (the content of the page and possible actions).

Otherwise, if 'task' is an explicit instruction, summarize the actions you took.`
                  },
                  {
                    type: "image",
                    image: data
                  }
                ]
              };

              // Generate the summary using the LLM
              const result = await generateObject({
                model: LLMClient,
                schema: z.object({
                  summary: z.string()
                }),
                messages: [message]
              });

              return NextResponse.json({
                success: true,
                summary: result.object.summary,
                done: false
              });
            }
          }

          return NextResponse.json({
            success: true,
            done: false
          });
        }

        default:
          return NextResponse.json(
            { success: false, error: "Invalid action type" },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error("Error during navigation:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error processing task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process task" },
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

    return NextResponse.json({ 
      success: true
    });
  } catch (error) {
    console.error("Error closing session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to close session" },
      { status: 500 }
    );
  }
} 