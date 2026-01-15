import Anthropic from "@anthropic-ai/sdk";

// SDK auto-reads ANTHROPIC_API_KEY from environment
const anthropic = new Anthropic();

// Story generation system prompt
const SYSTEM_PROMPT = `You are a creative storyteller. When given a prompt, write an engaging short story (200-400 words).
Use vivid descriptions and compelling narrative. Include dialogue when appropriate.
Start immediately with the story - no preamble like "Here's a story about..."`;

export async function POST(request: Request) {
  const { prompt } = await request.json();

  console.log("\n========== STREAM START ==========");
  console.log(`Prompt: "${prompt}"`);
  console.log("-----------------------------------");

  // Create a TransformStream to convert SDK stream to SSE format
  const encoder = new TextEncoder();
  let chunkCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Use SDK's streaming method - returns chunks as they're generated
        const messageStream = anthropic.messages.stream({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });

        // Listen for text chunks and send as SSE
        messageStream.on("text", (text) => {
          chunkCount++;
          // Log each chunk with timestamp
          console.log(`[chunk ${chunkCount}] "${text}"`);

          // SSE format: "data: <content>\n\n"
          const sseMessage = `data: ${JSON.stringify({ type: "text", text })}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
        });

        // Wait for stream to complete
        const finalMessage = await messageStream.finalMessage();

        console.log("-----------------------------------");
        console.log(`Total chunks: ${chunkCount}`);
        console.log(`Usage: ${JSON.stringify(finalMessage.usage)}`);
        // finalMessage.content[0] contains the complete assembled text
        const fullText = finalMessage.content[0].type === "text"
          ? finalMessage.content[0].text
          : "";
        console.log(`\nFull message:\n${fullText}`);
        console.log("========== STREAM END ==========\n");

        // Send completion event with usage stats
        const doneMessage = `data: ${JSON.stringify({
          type: "done",
          usage: finalMessage.usage,
        })}\n\n`;
        controller.enqueue(encoder.encode(doneMessage));
        controller.close();
      } catch (error) {
        console.error("Stream error:", error);
        // Send error event
        const errorMessage = `data: ${JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMessage));
        controller.close();
      }
    },
  });

  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
