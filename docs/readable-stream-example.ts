/**
 * ReadableStream Example
 *
 * ReadableStream is a Web API for handling data that arrives in chunks over time.
 * Works in: browsers, Node.js (v18+), Deno
 *
 * Why use it?
 * - Stream large data without loading everything into memory
 * - Send data to clients as it's generated (like AI responses)
 * - Build Server-Sent Events (SSE) endpoints
 *
 * Run: npx tsx docs/readable-stream-example.ts
 * Docs: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
 */

const encoder = new TextEncoder();

// Example 1: Basic ReadableStream that emits chunks
const basicStream = new ReadableStream({
  start(controller) {
    // Called once when stream is created
    controller.enqueue(encoder.encode("First chunk\n"));
    controller.enqueue(encoder.encode("Second chunk\n"));
    controller.enqueue(encoder.encode("Third chunk\n"));
    controller.close(); // Signal no more data
  },
});

// Read the stream
console.log("=== Basic Stream ===");
const reader = basicStream.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log("Received:", decoder.decode(value).trim());
}

// Example 2: Async stream (like Claude API streaming)
console.log("\n=== Async Stream (simulating AI response) ===");

const asyncStream = new ReadableStream({
  async start(controller) {
    const words = ["The", "quick", "brown", "fox", "jumps"];

    for (const word of words) {
      // Simulate delay between chunks (like AI generating tokens)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const sseMessage = `data: ${JSON.stringify({ text: word })}\n\n`;
      controller.enqueue(encoder.encode(sseMessage));
      console.log("Sent:", word);
    }

    controller.close();
  },
});

// In a real app, you'd return this stream in a Response:
// return new Response(asyncStream, {
//   headers: { "Content-Type": "text/event-stream" }
// });

// For demo, just consume it
const asyncReader = asyncStream.getReader();
while (true) {
  const { done } = await asyncReader.read();
  if (done) break;
}

// Example 3: Error handling
console.log("\n=== Stream with Error Handling ===");

const errorStream = new ReadableStream({
  async start(controller) {
    try {
      controller.enqueue(encoder.encode("Starting...\n"));
      // Simulate an error
      throw new Error("Something went wrong!");
    } catch (error) {
      const errorMsg = `data: ${JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown",
      })}\n\n`;
      controller.enqueue(encoder.encode(errorMsg));
      controller.close();
    }
  },
});

const errorReader = errorStream.getReader();
while (true) {
  const { done, value } = await errorReader.read();
  if (done) break;
  console.log("Received:", decoder.decode(value).trim());
}

console.log("\nDone!");
