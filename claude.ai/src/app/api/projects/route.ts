import { nanoid } from "nanoid";
import { db, projects } from "@/db";
import { desc } from "drizzle-orm";

export async function GET() {
  const allProjects = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt));

  return Response.json(allProjects);
}

export async function POST(request: Request) {
  const { name, instructions } = (await request.json()) as {
    name: string;
    instructions?: string;
  };

  if (!name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const id = nanoid();
  const now = new Date();

  await db.insert(projects).values({
    id,
    name: name.trim(),
    instructions: instructions?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  return Response.json(project, { status: 201 });
}
