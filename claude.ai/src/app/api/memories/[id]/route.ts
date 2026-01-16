import { db, memories } from "@/db";
import { eq } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { type, content, projectId } = body as {
    type?: "preference" | "fact" | "instruction";
    content?: string;
    projectId?: string | null;
  };

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (type !== undefined) updates.type = type;
  if (content !== undefined) updates.content = content;
  if (projectId !== undefined) updates.projectId = projectId;

  await db.update(memories).set(updates).where(eq(memories.id, id));

  const updated = await db.select().from(memories).where(eq(memories.id, id)).get();

  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.delete(memories).where(eq(memories.id, id));

  return Response.json({ success: true });
}
