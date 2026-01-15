# Streaming Flow: Story Generator

## The Problem

Without streaming, users wait for the entire response to generate before seeing anything.

```
WITHOUT STREAMING                      WITH STREAMING
─────────────────                      ──────────────
User clicks "Generate"                 User clicks "Generate"
        │                                      │
        ▼                                      ▼
┌─────────────────┐                   ┌─────────────────┐
│   Loading...    │                   │ "Once upon"     │ ← instant feedback
│   Loading...    │                   │ "Once upon a"   │
│   Loading...    │                   │ "Once upon a    │
│   Loading...    │                   │  time..."       │
│   (10 seconds)  │                   │                 │
└─────────────────┘                   └─────────────────┘
        │                                      │
        ▼                                      ▼
  Full response                        Text appeared
  appears at once                      word by word
```

Streaming transforms "Is it broken?" into "This feels responsive."

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           STREAMING FLOW                                     │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────────┐         ┌─────────────┐
│  Browser │         │  Next.js API │         │  Claude API │
│  (React) │         │ /api/generate│         │             │
└────┬─────┘         └──────┬───────┘         └──────┬──────┘
     │                      │                        │
     │  POST {prompt}       │                        │
     │─────────────────────>│                        │
     │                      │                        │
     │                      │  messages.stream()     │
     │                      │───────────────────────>│
     │                      │                        │
     │                      │    SSE: text chunk     │
     │    SSE: {"text":     │<───────────────────────│
     │    "Once"}           │                        │
     │<─────────────────────│                        │
     │                      │    SSE: text chunk     │
     │    SSE: {"text":     │<───────────────────────│
     │    " upon"}          │                        │
     │<─────────────────────│                        │
     │                      │    SSE: text chunk     │
     │    SSE: {"text":     │<───────────────────────│
     │    " a"}             │                        │
     │<─────────────────────│                        │
     │        ...           │         ...            │
     │                      │                        │
     │    SSE: {"type":     │    Stream complete     │
     │    "done"}           │<───────────────────────│
     │<─────────────────────│                        │
     │                      │                        │
     ▼                      │                        │
┌──────────┐                │                        │
│ Display  │                │                        │
│ complete │                │                        │
└──────────┘                │                        │
```

## How Streaming Works

### 1. Backend: SDK Stream → SSE

```typescript
// Anthropic SDK provides a streaming method
const messageStream = anthropic.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  messages: [{ role: "user", content: prompt }],
});

// Listen for text chunks as they arrive
messageStream.on("text", (text) => {
  // Convert to Server-Sent Events format
  controller.enqueue(`data: {"type":"text","text":"${text}"}\n\n`);
});
```

### 2. Frontend: Fetch Stream → Display

```typescript
const response = await fetch("/api/generate", { method: "POST" });
const reader = response.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Parse SSE and append text to state
  const data = JSON.parse(value);
  setStory(prev => prev + data.text);  // Text appears immediately
}
```

## SSE Event Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVER-SENT EVENTS                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Event Type      Data Format                    Purpose
──────────────────────────────────────────────────────────────────────────────
text            {"type":"text","text":"..."}   Chunk of generated text
done            {"type":"done","usage":{...}}  Stream complete + token stats
error           {"type":"error","error":"..."}  Error occurred
```

## Streaming vs Non-Streaming Comparison

```
┌─────────────────────────────────────┬───────────────────────────────────────┐
│         NON-STREAMING               │            STREAMING                   │
├─────────────────────────────────────┼───────────────────────────────────────┤
│                                     │                                        │
│  messages.create()                  │  messages.stream()                     │
│         │                           │         │                              │
│         │ (wait 5-15 sec)           │         │                              │
│         │                           │         ▼                              │
│         │                           │  ┌─────────────┐                       │
│         │                           │  │ text event  │──► display chunk      │
│         │                           │  └─────────────┘                       │
│         │                           │         │                              │
│         │                           │         ▼                              │
│         │                           │  ┌─────────────┐                       │
│         │                           │  │ text event  │──► display chunk      │
│         │                           │  └─────────────┘                       │
│         │                           │         │                              │
│         │                           │        ...                             │
│         │                           │         │                              │
│         ▼                           │         ▼                              │
│  ┌─────────────┐                    │  ┌─────────────┐                       │
│  │  Complete   │                    │  │ done event  │                       │
│  │  Response   │                    │  └─────────────┘                       │
│  └─────────────┘                    │                                        │
│         │                           │                                        │
│         ▼                           │                                        │
│    Display all                      │  Already displayed!                    │
│                                     │                                        │
└─────────────────────────────────────┴───────────────────────────────────────┘

Time to first byte:  ~5-15 seconds         ~100-500ms
User experience:     "Is it working?"      "It's typing!"
```

## Event Flow Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLAUDE API STREAM EVENTS                             │
└─────────────────────────────────────────────────────────────────────────────┘

Claude API sends these SSE events:

1. message_start     ──► Message begins (id, model, etc.)
2. content_block_start ──► Text block begins
3. content_block_delta ──► Text chunk (this is what we display!) ◄─── KEY
4. content_block_delta ──► Another chunk
5. content_block_delta ──► Another chunk
   ...
N. content_block_stop  ──► Text block ends
N+1. message_delta    ──► Stop reason, usage stats
N+2. message_stop     ──► Stream complete

Our API simplifies this to: text → text → text → done
```

## Key Implementation Points

### Response Headers (SSE)

```typescript
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",  // Required for SSE
    "Cache-Control": "no-cache",          // Prevent buffering
    "Connection": "keep-alive",           // Keep connection open
  },
});
```

### SSE Message Format

```
data: {"type":"text","text":"Hello"}\n\n
      ▲                              ▲
      │                              │
      └── JSON payload               └── Double newline = message end
```

### Handling Partial Reads

```typescript
let buffer = "";

while (true) {
  const { value } = await reader.read();
  buffer += decode(value);

  // Split on \n\n (SSE delimiter)
  const messages = buffer.split("\n\n");
  buffer = messages.pop() || "";  // Keep incomplete message

  // Process complete messages
  for (const msg of messages) {
    // parse and display
  }
}
```

## When to Use Streaming

| Use Case | Streaming? | Why |
|----------|------------|-----|
| Long-form content (stories, articles) | Yes | Users see progress |
| Quick Q&A (short answers) | Maybe | Less benefit for short responses |
| Code generation | Yes | See code as it's written |
| Data processing / tool use | No | Need complete response to act |
| Chat interfaces | Yes | Feels more conversational |

## References

- [Anthropic Streaming Docs](https://platform.claude.com/docs/build-with-claude/streaming)
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Anthropic SDK TypeScript](https://github.com/anthropics/anthropic-sdk-typescript)
