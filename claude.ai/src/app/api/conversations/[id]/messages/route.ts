import { db, messages } from "@/db";
import { eq, asc } from "drizzle-orm";
import { NextRequest } from "next/server";

type Params = { id: string };

// GET /api/conversations/[id]/messages - Get all messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json(conversationMessages);
}
