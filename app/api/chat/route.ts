/**
 * Chat API Route
 * 
 * This route handles chat interactions with OpenAI's API using Server-Sent Events (SSE)
 * for real-time streaming of responses. It:
 * - Processes incoming chat messages
 * - Adds system context from the page content
 * - Streams responses from OpenAI back to the client
 */

import { NextRequest } from "next/server";

/**
 * Handles POST requests to the chat API
 * @param {NextRequest} req - The incoming request containing chat messages and page content
 * @returns {Response} A streaming response with the AI's replies
 */
export async function POST(req: NextRequest) {
  // Extract messages and page content from the request body
  const { messages, pageContent } = await req.json();

  // Get the last user message to maintain conversation context
  const lastMessage = messages[messages.length - 1];

  /**
   * Create a system message that provides context to the AI
   * This helps the AI understand the webpage content and respond appropriately
   */
  const systemMessage = {
    role: "system",
    content: `You are a helpful assistant that can answer questions about the following webpage content. Use the content to provide accurate and relevant answers. If the question cannot be answered based on the content, say so.

Page Content:
${pageContent || "No page content available."}`,
  };

  /**
   * Prepare messages for the OpenAI API
   * Format: [system message, user messages, assistant messages]
   */
  const apiMessages = [
    systemMessage,
    ...messages.map((message: any) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  /**
   * Make a request to OpenAI's API with streaming enabled
   * The response will be streamed back to the client in real-time
   */
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: apiMessages,
      stream: true, // Enable streaming for real-time responses
      temperature: 0.7, // Controls response randomness (0-1)
      max_tokens: 1000, // Maximum length of the response
    }),
  });

  /**
   * Return the response stream with proper SSE headers
   * These headers are required for Server-Sent Events to work properly:
   * - Content-Type: text/event-stream - Indicates SSE format
   * - Cache-Control: no-cache - Prevents caching of the stream
   * - Connection: keep-alive - Maintains the connection for streaming
   */
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
} 