import { db, projects } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json(project);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, instructions } = (await request.json()) as {
    name?: string;
    instructions?: string | null;
  };

  const existing = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!existing) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  await db
    .update(projects)
    .set({
      name: name?.trim() || existing.name,
      instructions: instructions !== undefined ? instructions : existing.instructions,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id));

  const updated = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!existing) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Delete project (cascade will delete associated conversations)
  await db.delete(projects).where(eq(projects.id, id));

  return Response.json({ success: true });
}
