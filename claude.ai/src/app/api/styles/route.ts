import { nanoid } from "nanoid";
import { db, styles } from "@/db";
import { eq } from "drizzle-orm";

// Built-in styles to seed
const BUILTIN_STYLES = [
  {
    id: "style-concise",
    name: "Concise",
    description: "Brief, to-the-point responses",
    prompt: "Be concise and direct. Keep responses short and focused. Avoid unnecessary explanations or elaboration unless asked. Get straight to the point.",
    isBuiltin: true,
  },
  {
    id: "style-detailed",
    name: "Detailed",
    description: "Thorough, comprehensive explanations",
    prompt: "Provide detailed, thorough explanations. Include relevant context, examples, and nuances. Anticipate follow-up questions and address them proactively.",
    isBuiltin: true,
  },
  {
    id: "style-formal",
    name: "Formal",
    description: "Professional, polished tone",
    prompt: "Use formal, professional language. Maintain a polished tone suitable for business or academic contexts. Avoid casual expressions and contractions.",
    isBuiltin: true,
  },
  {
    id: "style-friendly",
    name: "Friendly",
    description: "Warm, conversational style",
    prompt: "Be warm and conversational. Use a friendly, approachable tone. Feel free to use casual language and light humor where appropriate.",
    isBuiltin: true,
  },
];

export async function GET() {
  const allStyles = await db.select().from(styles).orderBy(styles.createdAt);

  // If no styles exist, seed the built-in ones
  if (allStyles.length === 0) {
    const now = new Date();
    await db.insert(styles).values(
      BUILTIN_STYLES.map((s) => ({
        ...s,
        createdAt: now,
      }))
    );

    return Response.json(
      BUILTIN_STYLES.map((s) => ({
        ...s,
        createdAt: now,
      }))
    );
  }

  return Response.json(allStyles);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, description, prompt } = body as {
    name: string;
    description?: string;
    prompt: string;
  };

  if (!name || !prompt) {
    return Response.json({ error: "name and prompt are required" }, { status: 400 });
  }

  const style = {
    id: nanoid(),
    name,
    description: description || null,
    prompt,
    isBuiltin: false,
    createdAt: new Date(),
  };

  await db.insert(styles).values(style);

  return Response.json(style, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  // Don't allow deleting built-in styles
  const style = await db.select().from(styles).where(eq(styles.id, id)).get();
  if (style?.isBuiltin) {
    return Response.json({ error: "Cannot delete built-in styles" }, { status: 400 });
  }

  await db.delete(styles).where(eq(styles.id, id));

  return Response.json({ success: true });
}
