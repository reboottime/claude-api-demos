import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { NextRequest } from "next/server";

// Open-Meteo API weather codes mapping
const WEATHER_CONDITIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  51: "Light drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  95: "Thunderstorm",
};

// Helper to fetch weather from Open-Meteo API
async function fetchWeather(location: string): Promise<string> {
  try {
    const cityName = location.split(",")[0].trim();

    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`,
      { cache: "no-store" }
    );

    if (!geoRes.ok) {
      return JSON.stringify({ error: `Geocoding API error: ${geoRes.status}` });
    }

    const geoData = await geoRes.json();

    if (!geoData.results?.length) {
      return JSON.stringify({ error: `Location "${location}" not found` });
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit`,
      { cache: "no-store" }
    );

    if (!weatherRes.ok) {
      return JSON.stringify({ error: `Weather API error: ${weatherRes.status}` });
    }

    const weatherData = await weatherRes.json();

    if (!weatherData.current) {
      return JSON.stringify({ error: "Weather data unavailable" });
    }

    const { current } = weatherData;

    return JSON.stringify({
      location: `${name}, ${country}`,
      temperature: `${current.temperature_2m}°F`,
      wind_speed: `${current.wind_speed_10m} mph`,
      conditions: WEATHER_CONDITIONS[current.weather_code] || "Unknown",
    });
  } catch (error) {
    return JSON.stringify({
      error: `Failed to fetch weather: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

// Track suggestions captured from tool calls
let capturedSuggestions: string[] = [];

// Define tools using Agent SDK's tool() function with Zod schemas
const toolServer = createSdkMcpServer({
  name: "demo-tools",
  version: "1.0.0",
  tools: [
    tool(
      "get_weather",
      "Get current weather for a location",
      { location: z.string().describe("City name, e.g. San Francisco, CA") },
      async (args) => {
        const result = await fetchWeather(args.location);
        return {
          content: [{ type: "text", text: result }],
        };
      }
    ),
    tool(
      "suggest_actions",
      "Suggest 2-3 follow-up actions the user might want. Call this after answering questions.",
      {
        suggestions: z
          .array(z.string())
          .describe("Array of 2-3 short suggestions (under 40 chars each)"),
      },
      async (args) => {
        capturedSuggestions = args.suggestions;
        return {
          content: [{ type: "text", text: "Suggestions recorded" }],
        };
      }
    ),
  ],
});

// System prompt
function getSystemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `You are a helpful assistant. Today's date is ${today}.

You have access to these tools:
- WebSearch: Search the web for current information
- WebFetch: Fetch content from a specific URL
- get_weather: Get current weather for any city

Use tools when needed, but answer general knowledge questions directly.

IMPORTANT: After completing a task or answering a question, ALWAYS use the suggest_actions tool to offer 2-3 relevant follow-up actions.

Keep suggestions concise (under 40 characters each) and contextually relevant.`;
}

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

// Stream event types sent to the client
type StreamEvent =
  | { type: "text"; content: string }
  | { type: "text_delta"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; content: string }
  | { type: "suggestions"; suggestions: string[] }
  | { type: "done" }
  | { type: "error"; message: string };

export async function POST(request: NextRequest) {
  const { message, history = [] } = (await request.json()) as {
    message: string;
    history?: ConversationMessage[];
  };

  // Reset suggestions for each request
  capturedSuggestions = [];

  // Build the prompt with conversation history
  const conversationContext = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const fullPrompt = conversationContext
    ? `${conversationContext}\nUser: ${message}`
    : message;

  // Create a streaming response using ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE events
      const sendEvent = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let currentText = "";

      try {
        for await (const event of query({
          prompt: fullPrompt,
          options: {
            systemPrompt: getSystemPrompt(),
            model: "claude-sonnet-4-5-20250929",
            maxTurns: 10,
            mcpServers: {
              "demo-tools": toolServer,
            },
            allowedTools: [
              // Built-in Claude Code tools (no prefix needed)
              "WebSearch",
              "WebFetch",
              // Custom MCP tools (mcp__{server}__{tool} format)
              "mcp__demo-tools__get_weather",
              "mcp__demo-tools__suggest_actions",
            ],
            permissionMode: "bypassPermissions",
          },
        })) {
          // Process events and stream to client
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text" && block.text) {
                // Send text delta (difference from previous)
                const newText = block.text;
                if (newText !== currentText) {
                  // Send the new portion as a delta
                  const delta = newText.slice(currentText.length);
                  if (delta) {
                    sendEvent({ type: "text_delta", content: delta });
                  }
                  currentText = newText;
                }
              } else if (block.type === "tool_use") {
                // Handle both built-in tools (WebSearch) and custom MCP tools
                const rawName = block.name || "";
                const toolName = rawName.replace("mcp__demo-tools__", "");

                // Skip suggest_actions (internal), show everything else
                if (toolName && toolName !== "suggest_actions") {
                  sendEvent({
                    type: "tool_call",
                    name: toolName,
                    input: block.input,
                  });
                }
              }
            }
          } else if (event.type === "user" && event.tool_use_result) {
            const content = event.tool_use_result;
            // Skip suggest_actions results, show all other tool results
            if (Array.isArray(content) && content[0]?.text !== "Suggestions recorded") {
              const resultText = content[0]?.text || JSON.stringify(content);
              // Truncate long results (like web search)
              const truncated = resultText.length > 500
                ? resultText.slice(0, 500) + "..."
                : resultText;
              sendEvent({
                type: "tool_result",
                name: "tool",
                content: truncated,
              });
            }
          }
        }

        // Send suggestions at the end
        if (capturedSuggestions.length > 0) {
          sendEvent({ type: "suggestions", suggestions: capturedSuggestions });
        }

        // Signal completion
        sendEvent({ type: "done" });
      } catch (error) {
        sendEvent({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
