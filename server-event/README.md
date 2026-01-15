# Server-Sent Events (SSE) Demo

## The Problem

Traditional HTTP is request-response: client asks, server answers, connection closes.

- Without streaming: User waits 5-10 seconds staring at "Loading..." while Claude generates full response
- With SSE: User sees text appear word-by-word in real-time as Claude generates it

## What is SSE?

Server-Sent Events is a **one-way streaming protocol** from server to client.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SSE vs WebSockets                                    │
└──────────────────────────────────────────────────────────────────────────────┘

     SSE (Server-Sent Events)              WebSockets
     ─────────────────────────             ──────────────

     ┌────────┐      ┌────────┐           ┌────────┐      ┌────────┐
     │ Client │      │ Server │           │ Client │      │ Server │
     └───┬────┘      └───┬────┘           └───┬────┘      └───┬────┘
         │               │                    │               │
         │  GET /events  │                    │  Upgrade      │
         │──────────────>│                    │──────────────>│
         │               │                    │               │
         │  data: msg1   │                    │<─────────────>│
         │<──────────────│                    │  bidirectional│
         │               │                    │<─────────────>│
         │  data: msg2   │                    │               │
         │<──────────────│
         │               │
         │  data: msg3   │
         │<──────────────│

   One-way: Server → Client            Two-way: Both directions
   Perfect for: Streaming AI           Perfect for: Chat, games
```

**Why SSE for AI responses?**
- Claude generates text sequentially (can't go back and edit earlier parts)
- User only needs to receive, not send during generation
- Simpler than WebSockets, built into browsers via `EventSource` API

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SSE FLOW                                        │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────────┐         ┌─────────────┐
│  Browser │         │  Next.js API │         │  Claude API │
│ (React)  │         │  /api/sse    │         │ (Streaming) │
└────┬─────┘         └──────┬───────┘         └──────┬──────┘
     │                      │                        │
     │  new EventSource     │                        │
     │  ("/api/sse?msg=hi") │                        │
     │─────────────────────>│                        │
     │                      │                        │
     │                      │  messages.stream()     │
     │                      │───────────────────────>│
     │                      │                        │
     │                      │                        │  Claude thinks...
     │                      │                        │
     │                      │  chunk: "Hello"        │
     │                      │<───────────────────────│
     │  event: message      │                        │
     │  data: "Hello"       │                        │
     │<─────────────────────│                        │
     │                      │                        │
     │                      │  chunk: " there"       │
     │                      │<───────────────────────│
     │  event: message      │                        │
     │  data: " there"      │                        │
     │<─────────────────────│                        │
     │                      │                        │
     │                      │  chunk: "!"            │
     │                      │<───────────────────────│
     │  event: message      │                        │
     │  data: "!"           │                        │
     │<─────────────────────│                        │
     │                      │                        │
     │  event: done         │  [stream complete]     │
     │  data: "[DONE]"      │<───────────────────────│
     │<─────────────────────│                        │
     │                      │                        │
     ▼                      ▼                        ▼
  "Hello there!"         Connection                Done
  displayed live         closes
```

## SSE Message Format

SSE has a simple text-based format. Each message is separated by double newlines:

```
event: message
data: {"text": "Hello"}

event: message
data: {"text": " there"}

event: done
data: "[DONE]"
```

### Fields

| Field   | Purpose                                    |
|---------|--------------------------------------------|
| `event` | Event type name (client listens for this)  |
| `data`  | Message payload (can be JSON or plain text)|
| `id`    | Event ID (for reconnection)                |
| `retry` | Reconnection time in milliseconds          |

### Required Headers

```typescript
{
  "Content-Type": "text/event-stream",  // Tells browser it's SSE
  "Cache-Control": "no-cache",          // Don't cache stream
  "Connection": "keep-alive"            // Keep connection open
}
```

## Code Walkthrough

### Server: `/api/sse/route.ts`

```typescript
// SSE uses GET because EventSource only supports GET
export async function GET(request: NextRequest) {
  const message = request.nextUrl.searchParams.get("message");

  // Create a stream to write SSE events
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to format SSE events
  const sendEvent = async (event: string, data: string) => {
    const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(sseMessage));
  };

  // Stream from Claude → send to client
  (async () => {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      messages: [{ role: "user", content: message }],
    });

    // Each text chunk from Claude becomes an SSE event
    stream.on("text", async (text) => {
      await sendEvent("message", text);
    });

    await stream.finalMessage();
    await sendEvent("done", "[DONE]");
  })();

  // Return SSE response
  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### Client: `page.tsx`

```typescript
// EventSource is the browser's built-in SSE client
const eventSource = new EventSource(
  `/api/sse?message=${encodeURIComponent(userMessage)}`
);

// Listen for "message" events (our text chunks)
eventSource.addEventListener("message", (event) => {
  const text = JSON.parse(event.data);
  // Append to UI - text appears character by character
  setResponse(prev => prev + text);
});

// Listen for completion
eventSource.addEventListener("done", () => {
  eventSource.close();  // Must close manually!
});

// Handle errors (connection lost, server error, etc.)
eventSource.addEventListener("error", () => {
  eventSource.close();
});
```

## Key Concepts

### 1. EventSource Only Supports GET

Unlike `fetch()`, the browser's `EventSource` API only supports GET requests. This means:
- Parameters go in query string: `/api/sse?message=hello`
- Can't send JSON body
- For complex data, use `encodeURIComponent()`

### 2. Connection Management

```typescript
// Opening
const eventSource = new EventSource("/api/sse");

// Closing (IMPORTANT: won't close automatically!)
eventSource.close();

// Check state
eventSource.readyState  // 0: connecting, 1: open, 2: closed
```

### 3. Auto-Reconnection

SSE automatically reconnects if connection drops (unless you call `.close()`). You can control this:

```
retry: 5000   ← Server tells client to wait 5 seconds before reconnecting
```

### 4. Browser Limits

| Protocol | Max connections per domain |
|----------|---------------------------|
| HTTP/1.1 | 6 connections             |
| HTTP/2   | 100 concurrent streams    |

With HTTP/1.1, opening too many SSE connections can block other requests!

## When to Use SSE vs Alternatives

| Use Case                        | Best Choice    |
|---------------------------------|----------------|
| AI response streaming           | SSE            |
| Real-time notifications         | SSE            |
| Live data feeds (stocks, sports)| SSE            |
| Chat applications               | WebSockets     |
| Multiplayer games               | WebSockets     |
| File uploads with progress      | Fetch + streams|

## Running the Demo

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
```

## File Structure

```
server-event/
├── src/
│   └── app/
│       ├── api/
│       │   └── sse/
│       │       └── route.ts    # SSE endpoint (Claude streaming → client)
│       ├── page.tsx            # React UI with EventSource
│       ├── layout.tsx          # Root layout
│       └── globals.css         # Styles
├── package.json
└── README.md
```

## References

- [MDN: Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN: EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Claude API Streaming](https://docs.anthropic.com/en/api/streaming)
