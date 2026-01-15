# Web APIs Primer

Background knowledge for understanding the streaming demo.

## What are Web APIs?

**Web APIs** = platform-agnostic standards defined by [WHATWG](https://whatwg.org/) and [W3C](https://www.w3.org/).

Originally browser-only, now implemented by all major runtimes:
- Browsers (Chrome, Firefox, Safari)
- Node.js (v18+)
- Deno
- Bun
- Cloudflare Workers

## The Evolution

```
Before (~2018):                  Now:
┌─────────┐  ┌─────────┐        ┌─────────────────┐
│ Browser │  │ Node.js │        │    Web APIs     │
│  fetch  │  │  http   │        │     fetch       │
│ streams │  │ streams │   →    │  ReadableStream │
│TextEnc. │  │ Buffer  │        │   TextEncoder   │
└─────────┘  └─────────┘        └─────────────────┘
   Different APIs                 Same API everywhere
```

**Why it changed:** Developers wanted write-once-run-anywhere code. Deno (2018) pushed this by building on Web APIs from day one. Node.js followed.

## Web APIs Used in This Repo

| API | Purpose | Docs |
|-----|---------|------|
| `TextEncoder` | String → UTF-8 bytes | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) |
| `TextDecoder` | UTF-8 bytes → String | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder) |
| `ReadableStream` | Chunked data over time | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) |
| `Response` | HTTP response object | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Response) |
| `fetch` | HTTP requests | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/fetch) |

## Why Streams Need Bytes

Streams work with `Uint8Array` (bytes), not strings. This is why we need `TextEncoder`:

```ts
const encoder = new TextEncoder();

// ❌ Can't do this - streams don't accept strings
controller.enqueue("hello");

// ✅ Encode string to bytes first
controller.enqueue(encoder.encode("hello"));
```

## How It Fits Together (Streaming Demo)

```
┌─────────────────────────────────────────────────────────┐
│                    Server (route.ts)                    │
│                                                         │
│  Claude API  ──stream──→  ReadableStream  ──chunks──→  │
│     ↓                          ↓                        │
│   "text"              TextEncoder.encode()              │
│   events                       ↓                        │
│                         Uint8Array bytes                │
│                                ↓                        │
│                    Response (SSE format)                │
└─────────────────────────────────────────────────────────┘
                                 │
                                 ↓ HTTP streaming
┌─────────────────────────────────────────────────────────┐
│                   Client (browser)                      │
│                                                         │
│  EventSource  ←──  Server-Sent Events  ←──  bytes      │
│       ↓                                                 │
│   onmessage callback                                    │
│       ↓                                                 │
│   Update UI with each chunk                             │
└─────────────────────────────────────────────────────────┘
```

## Further Reading

- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)
- [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
