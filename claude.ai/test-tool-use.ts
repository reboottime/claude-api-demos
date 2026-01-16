import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tool definition
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

// Geocode location and fetch weather from Open-Meteo (free, no API key)
async function getWeather(location: string): Promise<string> {
  // Get coordinates from location name
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
  );
  const geoData = await geoRes.json();

  if (!geoData.results?.length) {
    return JSON.stringify({ error: "Location not found" });
  }

  const { latitude, longitude, name, country } = geoData.results[0];

  // Get current weather
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit`
  );
  const weatherData = await weatherRes.json();

  const current = weatherData.current;
  return JSON.stringify({
    location: `${name}, ${country}`,
    temperature: `${current.temperature_2m}°F`,
    wind_speed: `${current.wind_speed_10m} mph`,
    conditions: getWeatherCondition(current.weather_code),
  });
}

// Map weather codes to descriptions
function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    95: "Thunderstorm",
  };
  return conditions[code] || "Unknown";
}

// Process tool calls
async function processToolCall(
  toolName: string,
  toolInput: { location?: string }
): Promise<string> {
  if (toolName === "get_weather" && toolInput.location) {
    return await getWeather(toolInput.location);
  }
  return JSON.stringify({ error: "Unknown tool" });
}

async function main() {
  console.log("User: What's the weather in San Francisco?\n");

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "What's the weather in San Francisco?" },
  ];

  // First API call
  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    tools,
    messages,
  });

  console.log("--- Initial Response ---");
  console.log("Stop reason:", response.stop_reason);

  // Agentic loop: keep processing until no more tool calls
  while (response.stop_reason === "tool_use") {
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUseBlock) break;

    console.log(`\nClaude wants to call: ${toolUseBlock.name}`);
    console.log("With input:", JSON.stringify(toolUseBlock.input));

    // Execute the tool
    const toolResult = await processToolCall(
      toolUseBlock.name,
      toolUseBlock.input as { location?: string }
    );
    console.log("Tool result:", toolResult);

    // Send tool result back to Claude
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        },
      ],
    });

    // Get next response
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      tools,
      messages,
    });

    console.log("\n--- Next Response ---");
    console.log("Stop reason:", response.stop_reason);
  }

  // Extract final text response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  console.log("\n--- Final Answer ---");
  console.log("Claude:", textBlock?.text || "No response");
}

main().catch(console.error);
