import { db, conversations, messages } from "@/db";
import { desc, eq, isNull } from "drizzle-orm";

// GET /api/conversations - List conversations (optionally filtered by project)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  let query = db.select().from(conversations);

  if (projectId) {
    // Filter by specific project
    query = query.where(eq(conversations.projectId, projectId)) as typeof query;
  } else {
    // Show conversations without a project
    query = query.where(isNull(conversations.projectId)) as typeof query;
  }

  const allConversations = await query.orderBy(desc(conversations.updatedAt));

  return Response.json(allConversations);
}

// DELETE /api/conversations?id=xxx - Delete a conversation
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing conversation id" }, { status: 400 });
  }

  // Delete messages first (cascade should handle this, but being explicit)
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));

  return Response.json({ success: true });
}
