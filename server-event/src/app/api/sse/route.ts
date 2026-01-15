import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// SDK auto-reads ANTHROPIC_API_KEY from environment
const anthropic = new Anthropic();

// System prompt with current date
function getSystemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `You are a helpful assistant. Today's date is ${today}. Keep responses concise but informative.`;
}

// SSE endpoint using GET (EventSource only supports GET)
// Query params: ?message=user+message
export async function GET(request: NextRequest) {
  const message = request.nextUrl.searchParams.get("message");

  if (!message) {
    return new Response("Missing message parameter", { status: 400 });
  }

  // Create a TransformStream to handle SSE formatting
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE events
  // SSE format: "data: <content>\n\n" for each event
  const sendEvent = async (event: string, data: string) => {
    // SSE format with event type
    const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(sseMessage));
  };

  // Start streaming from Claude in the background
  (async () => {
    let chunkCount = 0;
    console.log("\n========== SSE STREAM START ==========");
    console.log(`Message: "${message}"`);
    console.log("---------------------------------------");

    try {
      // Use Claude's streaming API
      const claudeStream = anthropic.messages.stream({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: getSystemPrompt(),
        messages: [{ role: "user", content: message }],
      });

      // Handle each text chunk as it arrives
      claudeStream.on("text", async (text) => {
        chunkCount++;
        console.log(`[chunk ${chunkCount}] "${text}"`);
        await sendEvent("message", text);
      });

      // Wait for stream to complete
      const finalMessage = await claudeStream.finalMessage();

      console.log("---------------------------------------");
      console.log(`Total chunks: ${chunkCount}`);
      console.log(`Usage: ${JSON.stringify(finalMessage.usage)}`);
      const fullText = finalMessage.content[0].type === "text"
        ? finalMessage.content[0].text
        : "";
      console.log(`\nFull message:\n${fullText}`);
      console.log("========== SSE STREAM END ==========\n");

      // Send done event
      await sendEvent("done", "[DONE]");
    } catch (error) {
      console.error("SSE stream error:", error);
      await sendEvent(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      await writer.close();
    }
  })();

  // Return SSE response with proper headers
  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream", // Required for SSE
      "Cache-Control": "no-cache", // Prevent caching
      Connection: "keep-alive", // Keep connection open
    },
  });
}
