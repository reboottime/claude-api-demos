import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { db, messages, conversations, projects, memories, styles, Memory, Style } from "@/db";
import { eq, asc, isNull, or } from "drizzle-orm";

const anthropic = new Anthropic();

type SystemPromptOptions = {
  projectInstructions?: string | null;
  memories?: Memory[];
  style?: Style | null;
};

function getSystemPrompt(options: SystemPromptOptions = {}): string {
  const { projectInstructions, memories = [], style } = options;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let prompt = `You are Claude, a helpful AI assistant created by Anthropic. Today's date is ${today}.`;

  // Add style instructions if selected
  if (style) {
    prompt += `\n\n## Response Style: ${style.name}\n${style.prompt}`;
  }

  // Add memories if any exist
  if (memories.length > 0) {
    prompt += `\n\n## User Information\nThe following information has been saved about this user. Use this context to personalize your responses:\n`;

    const preferences = memories.filter((m) => m.type === "preference");
    const facts = memories.filter((m) => m.type === "fact");
    const instructions = memories.filter((m) => m.type === "instruction");

    if (preferences.length > 0) {
      prompt += `\n### Preferences\n${preferences.map((m) => `- ${m.content}`).join("\n")}`;
    }
    if (facts.length > 0) {
      prompt += `\n### Facts\n${facts.map((m) => `- ${m.content}`).join("\n")}`;
    }
    if (instructions.length > 0) {
      prompt += `\n### Instructions\n${instructions.map((m) => `- ${m.content}`).join("\n")}`;
    }
  }

  prompt += `

## Artifacts

When the user asks you to create or generate content that would be better displayed in a separate panel (code, HTML pages, React components, SVGs, documents), use the artifact format:

<artifact type="TYPE" title="TITLE" language="LANGUAGE">
CONTENT
</artifact>

Artifact types:
- "code" - Code snippets (specify language: javascript, python, typescript, etc.)
- "html" - Complete HTML pages or components
- "react" - React components (JSX/TSX)
- "svg" - SVG graphics
- "markdown" - Formatted documents, reports, or long-form content

Guidelines:
- Use artifacts for substantial, self-contained content the user might want to copy, download, or preview
- Don't use artifacts for short code snippets (under 10 lines) or simple explanations
- Always provide a descriptive title
- For code artifacts, always specify the language
- You can create multiple artifacts in a single response
- When updating an artifact, create a new artifact with the updated content

Example:
<artifact type="react" title="Counter Component" language="tsx">
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
</artifact>`;

  if (projectInstructions) {
    prompt += `\n\n## Project Instructions\n${projectInstructions}`;
  }

  return prompt;
}

type FileAttachment = {
  url: string;
  name: string;
  type: string;
  extractedText?: string | null;
  isImage?: boolean;
  isPdf?: boolean;
};

export async function POST(request: Request) {
  const { message, conversationId, projectId, styleId, attachments } = (await request.json()) as {
    message: string;
    conversationId?: string;
    projectId?: string;
    styleId?: string;
    attachments?: FileAttachment[];
  };

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    convId = nanoid();
    await db.insert(conversations).values({
      id: convId,
      title: message.slice(0, 100), // Use first message as title
      projectId: projectId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Load conversation history
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(asc(messages.createdAt));

  // Get project instructions if applicable
  let projectInstructions: string | null = null;
  if (projectId) {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    projectInstructions = project?.instructions ?? null;
  }

  // Fetch memories (global + project-specific)
  const userMemories = await db
    .select()
    .from(memories)
    .where(
      projectId
        ? or(isNull(memories.projectId), eq(memories.projectId, projectId))
        : isNull(memories.projectId)
    );

  // Fetch selected style if provided
  let selectedStyle: Style | null = null;
  if (styleId) {
    selectedStyle = await db.select().from(styles).where(eq(styles.id, styleId)).get() ?? null;
  }

  // Build messages array for Claude
  const claudeMessages: Anthropic.MessageParam[] = history.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Build the user message content with attachments
  const userContent: Anthropic.ContentBlockParam[] = [];

  // Add file attachments first
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      if (attachment.isImage) {
        // Handle images via Claude's vision capability
        if (attachment.url.startsWith("data:")) {
          // Base64 data URL
          const base64Match = attachment.url.match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            userContent.push({
              type: "image",
              source: {
                type: "base64",
                media_type: base64Match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64Match[2],
              },
            });
          }
        } else {
          // URL-based image
          userContent.push({
            type: "image",
            source: {
              type: "url",
              url: attachment.url,
            },
          });
        }
      } else if (attachment.isPdf && attachment.extractedText) {
        // Include PDF text as a text block
        userContent.push({
          type: "text",
          text: `[Content from ${attachment.name}]:\n${attachment.extractedText}\n\n---\n\n`,
        });
      }
    }
  }

  // Add the user's text message
  userContent.push({ type: "text", text: message });

  claudeMessages.push({ role: "user", content: userContent });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send conversation ID first (for new conversations)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "conversation_id", id: convId })}\n\n`
          )
        );

        const messageStream = anthropic.messages.stream({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          system: getSystemPrompt({
            projectInstructions,
            memories: userMemories,
            style: selectedStyle,
          }),
          messages: claudeMessages,
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 5,
            },
          ],
        });

        messageStream.on("text", (text) => {
          fullResponse += text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`)
          );
        });

        // Track when web search starts
        messageStream.on("streamEvent", (event) => {
          if (event.type === "content_block_start" &&
              event.content_block.type === "server_tool_use" &&
              event.content_block.name === "web_search") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "searching" })}\n\n`)
            );
          }
        });

        const finalMessage = await messageStream.finalMessage();

        // Extract citations from web search results
        const citations: Array<{ title: string; url: string }> = [];
        for (const block of finalMessage.content) {
          if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
            for (const result of block.content) {
              if (result.type === "web_search_result") {
                citations.push({
                  title: result.title,
                  url: result.url,
                });
              }
            }
          }
        }

        // Send citations if any
        if (citations.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "citations", citations })}\n\n`)
          );
        }

        // Persist messages to database
        const userMsgId = nanoid();
        const assistantMsgId = nanoid();
        const now = new Date();

        await db.insert(messages).values([
          {
            id: userMsgId,
            conversationId: convId!,
            role: "user",
            content: message,
            createdAt: now,
          },
          {
            id: assistantMsgId,
            conversationId: convId!,
            role: "assistant",
            content: fullResponse,
            createdAt: new Date(now.getTime() + 1), // Slightly after user message
          },
        ]);

        // Update conversation timestamp
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, convId!));

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", usage: finalMessage.usage })}\n\n`
          )
        );
        controller.close();
      } catch (error) {
        console.error("Stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
