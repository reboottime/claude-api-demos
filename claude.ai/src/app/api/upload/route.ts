import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PDF, PNG, JPEG, GIF, WebP` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from PDFs
    let extractedText: string | null = null;
    if (file.type === "application/pdf") {
      try {
        // pdf-parse v1.x exports a function directly
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text.trim();
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError);
        // Continue without extracted text
      }
    }

    // Upload to Vercel Blob if token is available, otherwise use data URL
    let url: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${nanoid()}-${file.name}`, buffer, {
        access: "public",
        contentType: file.type,
      });
      url = blob.url;
    } else {
      // For local development without Vercel Blob, use base64 data URL
      const base64 = buffer.toString("base64");
      url = `data:${file.type};base64,${base64}`;
    }

    return Response.json({
      url,
      name: file.name,
      type: file.type,
      size: file.size,
      extractedText,
      isImage: file.type.startsWith("image/"),
      isPdf: file.type === "application/pdf",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
