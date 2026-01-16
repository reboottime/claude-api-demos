import Anthropic from "@anthropic-ai/sdk";
import { db, conversations, messages } from "@/db";
import { eq, asc } from "drizzle-orm";

const anthropic = new Anthropic();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get the first few messages of the conversation
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt))
      .limit(4);

    if (conversationMessages.length < 2) {
      return Response.json({ error: "Not enough messages" }, { status: 400 });
    }

    // Build context for title generation
    const context = conversationMessages
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: `Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, no quotes or punctuation.\n\n${context}`,
        },
      ],
    });

    const title =
      response.content[0].type === "text"
        ? response.content[0].text.trim().slice(0, 100)
        : "Untitled";

    // Update the conversation title
    await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, id));

    return Response.json({ title });
  } catch (error) {
    console.error("Title generation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate title" },
      { status: 500 }
    );
  }
}
