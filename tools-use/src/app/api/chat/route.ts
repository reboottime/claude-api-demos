import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// SDK auto-reads ANTHROPIC_API_KEY from environment
const anthropic = new Anthropic();

// System prompt with current date - enables Claude to answer date-aware questions
function getSystemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `You are a helpful assistant. Today's date is ${today}.

You can use tools when needed, but you can also answer general knowledge questions directly without tools. For example, you know about holidays, historical events, and common facts.

When answering questions about upcoming events or holidays, consider the current date to determine what's still upcoming vs what has already passed.

When using the get_weather tool, always expand city abbreviations to full names (e.g., "SF" → "San Francisco", "LA" → "Los Angeles", "NYC" → "New York City").

When asked about weather in multiple locations, call get_weather for ALL locations in parallel (in a single response) rather than one at a time.`;
}

// Define tools that Claude can use
// Claude reads these definitions to understand what tools are available and when to use them
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather in a given location",
    input_schema: {
      type: "object" as const,
      properties: {
        location: {
          type: "string",
          description: "The city and state, e.g. San Francisco, CA",
        },
      },
      required: ["location"],
    },
  },
];

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

// Tool implementation: fetches real weather data from Open-Meteo API
async function getWeather(location: string): Promise<string> {
  try {
    // Extract just the city name - Open-Meteo doesn't handle "City, State" format
    const cityName = location.split(",")[0].trim();

    // Step 1: Convert location name to coordinates
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

    // Step 2: Fetch weather data using coordinates
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

    // Return structured data that Claude will use to formulate response
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

// Type for conversation history from client
type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: NextRequest) {
  const { message, history = [] } = (await request.json()) as {
    message: string;
    history?: ConversationMessage[];
  };

  // Build messages array from conversation history + new message
  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: message },
  ];

  // Track tool calls and results for UI display
  const steps: Array<{
    type: "tool_call" | "tool_result";
    content: string;
    name?: string;
    input?: unknown;
  }> = [];

  // Helper to avoid duplicating API call config (called twice: initial + loop)
  const callClaude = () =>
    anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: getSystemPrompt(),
      tools,
      messages,
    });

  // First API call: Claude decides if it needs tools or can respond directly
  let response = await callClaude();

  // AGENTIC LOOP: continues while Claude wants to use tools
  // - stop_reason="tool_use" → Claude requested tool(s), loop continues
  // - stop_reason="end_turn" → Claude is done, loop exits
  while (response.stop_reason === "tool_use") {
    // Extract ALL tool_use blocks - Claude can request multiple tools at once
    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (toolUses.length === 0) break;

    // Log all tool calls
    for (const toolUse of toolUses) {
      steps.push({
        type: "tool_call",
        name: toolUse.name,
        input: toolUse.input,
        content: `Calling ${toolUse.name}...`,
      });
    }

    // Execute ALL tools in parallel - don't wait for each one sequentially
    const toolResults = await Promise.all(
      toolUses.map(async (toolUse) => {
        const result = await getWeather((toolUse.input as { location: string }).location);
        steps.push({ type: "tool_result", name: toolUse.name, content: result });
        return { id: toolUse.id, result };
      })
    );

    // Add to conversation history:
    // 1. Claude's tool request (as assistant message)
    // 2. ALL tool results in a single user message
    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: toolResults.map(({ id, result }) => ({
          type: "tool_result" as const,
          tool_use_id: id,
          content: result,
        })),
      }
    );

    // Next API call: Claude processes all tool results and decides next action
    response = await callClaude();
  }

  // Extract final text response after loop exits
  const text = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  )?.text;

  return Response.json({ steps, response: text || "No response" });
}
