import { nanoid } from "nanoid";
import { db, memories } from "@/db";
import { eq, isNull, or } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  // Get global memories (projectId = null) and project-specific memories
  const results = await db
    .select()
    .from(memories)
    .where(
      projectId
        ? or(isNull(memories.projectId), eq(memories.projectId, projectId))
        : isNull(memories.projectId)
    )
    .orderBy(memories.createdAt);

  return Response.json(results);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { type, content, projectId, source } = body as {
    type: "preference" | "fact" | "instruction";
    content: string;
    projectId?: string;
    source?: string;
  };

  if (!type || !content) {
    return Response.json({ error: "type and content are required" }, { status: 400 });
  }

  const now = new Date();
  const memory = {
    id: nanoid(),
    type,
    content,
    projectId: projectId || null,
    source: source || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(memories).values(memory);

  return Response.json(memory, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(memories).where(eq(memories.id, id));

  return Response.json({ success: true });
}
