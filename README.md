# Claude API & Agent SDK Demos

Hands-on learning with the Claude API and Agent SDK, prepare a weekend hackthon.

## Demos

| Demo                      | What is covered                                    |
|---------------------------|----------------------------------------------------|
| [tool-use](./tool-use/)   | Agent loop pattern: `tool_use` → execute → `end_turn` |
| [streaming](./streaming)  | use server event                                     |

## Roadmap

- [x] Tool use / agent loop
- [x] Streaming
- [x] SDK comparison (Client vs Agent)
- [x] Parallel tool calls
- [ ] MCP servers
- [ ] Save token comsumptions, 5 demos cost me 0.92 $ 

## References

**Claude API**
- [SDK Comparison](./docs/sdk-comparison.md) - Client SDK vs Agent SDK
- [Claude Cookbooks](https://github.com/anthropics/claude-cookbooks)
- [Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)

**Web APIs used in demos**
- [Web APIs Primer](./docs/web-apis-primer.md) - Start here if new to Web APIs
- [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) - Encodes strings to UTF-8 bytes
- [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) - Streams API for chunked data
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) - One-way server→client streaming

See [`docs/`](./docs/) for standalone examples.