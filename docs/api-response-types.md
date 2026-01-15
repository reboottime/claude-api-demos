# Tool Use API Response Types

Type definitions from `@anthropic-ai/sdk` for tool use responses.

## Core Types

### 1. `ToolUseBlock` - When Claude wants to use a tool

```typescript
interface ToolUseBlock {
  id: string;        // Unique ID to link with tool_result
  input: unknown;    // The arguments Claude provides
  name: string;      // Tool name (e.g., "get_weather")
  type: 'tool_use';
}
```

Example:

```json
{
  "type": "tool_use",
  "id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
  "name": "get_weather",
  "input": { "location": "San Francisco, CA" }
}
```

### 2. `ToolResultBlockParam` - Sending results back to Claude

```typescript
interface ToolResultBlockParam {
  tool_use_id: string;  // Must match the id from ToolUseBlock
  type: 'tool_result';
  content?: string | Array<TextBlockParam | ImageBlockParam | ...>;
  is_error?: boolean;   // Set true if tool execution failed
  cache_control?: CacheControlEphemeral | null;
}
```

Example:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
  "content": "{\"location\":\"San Francisco, United States\",\"temperature\":\"52°F\"}"
}
```

### 3. `StopReason` - Why Claude stopped

```typescript
type StopReason =
  | 'end_turn'       // Claude finished naturally → EXIT loop
  | 'tool_use'       // Claude wants to use a tool → CONTINUE loop
  | 'max_tokens'     // Hit token limit
  | 'stop_sequence'  // Custom stop sequence triggered
  | 'pause_turn'     // Long-running turn paused
  | 'refusal';       // Policy violation
```

### 4. `Message` - The full API response

```typescript
interface Message {
  id: string;
  content: Array<ContentBlock>;  // Text, tool_use, thinking blocks
  model: Model;
  role: 'assistant';
  stop_reason: StopReason | null;
  stop_sequence: string | null;
  type: 'message';
  usage: Usage;
}
```

### 5. `ContentBlock` - What's in `response.content`

```typescript
type ContentBlock =
  | TextBlock           // { type: 'text', text: string }
  | ToolUseBlock        // { type: 'tool_use', id, name, input }
  | ThinkingBlock       // Extended thinking
  | RedactedThinkingBlock
  | ServerToolUseBlock  // Server-side tools (web_search)
  | WebSearchToolResultBlock;
```

### 6. `TextBlock` - Claude's text response

```typescript
interface TextBlock {
  text: string;
  type: 'text';
  citations: Array<TextCitation> | null;
}
```

## Quick Reference

| Type | Purpose | Key Fields |
|------|---------|------------|
| `ToolUseBlock` | Claude requests tool | `id`, `name`, `input` |
| `ToolResultBlockParam` | You return result | `tool_use_id`, `content`, `is_error` |
| `StopReason` | Loop control | `"tool_use"` → continue, `"end_turn"` → done |
| `Message` | Full response | `content`, `stop_reason` |

## Agentic Loop Pattern

```typescript
while (response.stop_reason === "tool_use") {
  // 1. Extract tool request from response.content
  const toolUse = response.content.find(
    (block): block is ToolUseBlock => block.type === "tool_use"
  );

  // 2. Execute tool
  const result = await executeYourTool(toolUse.name, toolUse.input);

  // 3. Append to messages:
  //    - Assistant's tool request
  //    - Tool result
  messages.push(
    { role: "assistant", content: response.content },
    { role: "user", content: [{
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: result
    }]}
  );

  // 4. Call Claude again
  response = await anthropic.messages.create({ ... });
}
// Loop exits when stop_reason === "end_turn"
```

## Source

Types extracted from `@anthropic-ai/sdk/resources/messages/messages.d.ts`
