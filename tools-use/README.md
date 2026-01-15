# Tool Use Flow: Weather Example

## The Problem

LLMs can't access real-time data. Claude's knowledge is frozen at training time.

- Without tools: "Weather in Tokyo?" → Claude guesses or says "I don't know"
- With tools: Claude fetches live data and gives accurate answer

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              TOOL USE FLOW                                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────────┐         ┌─────────────┐
│  User    │         │  Next.js API │         │  Claude API │
│ (Chat)   │         │  /api/chat   │         │             │
└────┬─────┘         └──────┬───────┘         └──────┬──────┘
     │                      │                        │
     │  POST {message,      │                        │
     │  history}            │                        │
     │─────────────────────>│                        │
     │                      │                        │
     │                      │  Build messages array  │
     │                      │  (history + new msg)   │
     │                      │                        │
     │                      │  messages.create()     │
     │                      │  with tools & system   │
     │                      │───────────────────────>│
     │                      │                        │
     │                      │                        │  Claude decides:
     │                      │                        │  tool or direct?
     │                      │                        │
     │                      │<───────────────────────│
     │                      │  response              │
     │                      │                        │
     │              ┌───────┴───────┐                │
     │              │ stop_reason?  │                │
     │              └───────┬───────┘                │
     │                      │                        │
     │         ┌────────────┴────────────┐           │
     │         │                         │           │
     │         ▼                         ▼           │
     │   "tool_use"                 "end_turn"       │
     │         │                         │           │
     │   ┌─────┴───────────────┐         │           │
     │   │   AGENTIC LOOP      │         │           │
     │   └──────────────────┬──┘         │           │
     │                      │            │           │
     │         Extract tool_use block    │           │
     │         (name, input, id)         │           │
     │                      │            │           │
     │                      ▼            │           │
     │              ┌───────────────┐    │           │
     │              │ Execute tool  │    │           │
     │              │ getWeather()  │    │           │
     │              └───────┬───────┘    │           │
     │                      │            │           │
     │                      ▼            │           │
     │              ┌───────────────┐    │           │
     │              │ Open-Meteo    │    │           │
     │              │ Weather API   │    │           │
     │              └───────┬───────┘    │           │
     │                      │            │           │
     │         Append to messages:       │           │
     │         1. assistant (tool req)   │           │
     │         2. user (tool_result)     │           │
     │                      │            │           │
     │                      │  messages.create()     │
     │                      │───────────────────────>│
     │                      │                        │
     │                      │<───────────────────────│
     │                      │  new response          │
     │                      │                        │
     │              Loop back to         │           │
     │              "stop_reason?"       │           │
     │                      │            │           │
     │                      └────────────┤           │
     │                                   │           │
     │                                   ▼           │
     │                      Extract text block       │
     │                      from final response      │
     │                                   │           │
     │  {steps, response}                │           │
     │<──────────────────────────────────┘           │
     │                                               │
     ▼                                               │
┌──────────┐                                         │
│ Display  │                                         │
│ in chat  │                                         │
└──────────┘                                         │
```

## Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER MESSAGE                                   │
│                    "What's the weather in Tokyo?"                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. FIRST API CALL                                 │
│                                                                             │
│   Claude receives: message + available tools                                │
│   Claude thinks: "I need real weather data, I'll use the tool"              │
│                                                                             │
│   Returns: stop_reason = "tool_use" ◄─── KEY: tells us to continue loop    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         2. EXECUTE TOOL                                     │
│                                                                             │
│   Call Open-Meteo API → get real weather data                               │
│   Result: { location: "Tokyo, Japan", temperature: "45°F", ... }            │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        3. SECOND API CALL                                   │
│                                                                             │
│   Claude receives: full conversation history including tool result          │
│   Claude thinks: "I have the data, I can answer now"                        │
│                                                                             │
│   Returns: stop_reason = "end_turn" ◄─── KEY: exits the loop               │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FINAL RESPONSE                                    │
│         "The weather in Tokyo is 45°F with partly cloudy skies"             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Two Scenarios Compared

```
RANDOM MESSAGE: "Tell me a joke"          WEATHER QUERY: "Weather in SF?"
         │                                         │
         ▼                                         ▼
   ┌───────────┐                             ┌───────────┐
   │  Claude   │                             │  Claude   │
   └───────────┘                             └───────────┘
         │                                         │
         │ No tool needed                          │ Need real data!
         │                                         │
         ▼                                         ▼
  stop_reason: "end_turn"                   stop_reason: "tool_use"
         │                                         │
         │                                         ▼
         │                                   Execute getWeather()
         │                                         │
         │                                         ▼
         │                                   Send result to Claude
         │                                         │
         │                                         ▼
         │                                  stop_reason: "end_turn"
         │                                         │
         ▼                                         ▼
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                        while loop exits                                 │
   │                   (stop_reason !== "tool_use")                          │
   └─────────────────────────────────────────────────────────────────────────┘
```

## How the Loop Stops

```
stop_reason = "tool_use"  →  Claude says: "I need to call a tool first"
                              Loop CONTINUES

stop_reason = "end_turn"  →  Claude says: "I'm done, here's my answer"
                              Loop EXITS
```

Visual:

```
User: "Weather in Tokyo?"
         │
         ▼
┌─────────────────┐
│ 1st API CALL    │
│ messages.create │──► stop_reason = "tool_use" ──► while loop CONTINUES
└─────────────────┘
         │
         ▼
  Execute get_weather()
         │
         ▼
  Append to messages:
  - assistant's tool request
  - tool result
         │
         ▼
┌─────────────────┐
│ 2nd API CALL    │
│ messages.create │──► stop_reason = "end_turn" ──► while loop EXITS
└─────────────────┘
         │
         ▼
  "Tokyo is 45°F..."
```

Note: Each API call is **stateless**. Claude doesn't "remember" the previous call.
We pass the full conversation history (including tool results) each time.

The key insight: **Claude controls when to stop**, not your code. Your code just checks `stop_reason` and obeys:

```typescript
while (response.stop_reason === "tool_use") {
  // Claude said "tool_use" → keep going
}
// Claude said "end_turn" → we're done
```

| `stop_reason`  | Meaning                      | Loop continues? |
| -------------- | ---------------------------- | --------------- |
| `"tool_use"`   | Claude wants to call a tool  | Yes             |
| `"end_turn"`   | Claude finished responding   | No (exits)      |
| `"max_tokens"` | Hit token limit              | No (exits)      |

## Parallel Tool Calls

Claude can request **multiple tools in a single response**. For example:

```
User: "Compare weather in Tokyo, London, and NYC"
```

Instead of 3 sequential API round-trips, Claude sends all 3 tool calls at once:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARALLEL TOOL CALLS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

User: "Weather in Tokyo, London, and NYC?"
         │
         ▼
┌─────────────────┐
│ 1st API CALL    │
│ messages.create │
└────────┬────────┘
         │
         ▼
   response.content = [
     { type: "tool_use", name: "get_weather", input: {location: "Tokyo"} },
     { type: "tool_use", name: "get_weather", input: {location: "London"} },
     { type: "tool_use", name: "get_weather", input: {location: "NYC"} }
   ]
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Promise.all() - PARALLEL                     │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  getWeather()   │  getWeather()   │  getWeather()               │
│  Tokyo          │  London         │  NYC                        │
└────────┬────────┴────────┬────────┴────────┬────────────────────┘
         │                 │                 │
         └────────────────┬┴─────────────────┘
                          │
                          ▼
   Send ALL results in one message:
   content: [
     { type: "tool_result", tool_use_id: "id1", content: "Tokyo: 45°F" },
     { type: "tool_result", tool_use_id: "id2", content: "London: 50°F" },
     { type: "tool_result", tool_use_id: "id3", content: "NYC: 38°F" }
   ]
         │
         ▼
┌─────────────────┐
│ 2nd API CALL    │
│ messages.create │──► stop_reason = "end_turn"
└────────┬────────┘
         │
         ▼
   "Here's the weather comparison:
    - Tokyo: 45°F, Clear
    - London: 50°F, Cloudy
    - NYC: 38°F, Partly cloudy"
```

### Key Implementation Details

```typescript
// 1. Extract ALL tool_use blocks (not just the first one)
const toolUses = response.content.filter(
  (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
);

// 2. Execute ALL tools in parallel
const toolResults = await Promise.all(
  toolUses.map(async (toolUse) => {
    const result = await getWeather(toolUse.input.location);
    return { id: toolUse.id, result };
  })
);

// 3. Send ALL results in a single message
messages.push({
  role: "user",
  content: toolResults.map(({ id, result }) => ({
    type: "tool_result",
    tool_use_id: id,
    content: result,
  })),
});
```

### Sequential vs Parallel

| Approach | API Calls | Latency |
|----------|-----------|---------|
| Sequential (one tool at a time) | 2N + 1 | High - waits for each |
| Parallel (all at once) | 3 | Low - concurrent execution |

For 3 locations: Sequential = 7 API calls, Parallel = 3 API calls.
