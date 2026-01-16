"use client";

import { useState } from "react";
import { ParsedArtifact, getFileExtension } from "@/lib/artifacts";

type ArtifactPreviewProps = {
  artifact: ParsedArtifact;
};

export function ArtifactPreview({ artifact }: ArtifactPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"preview" | "code">(
    artifact.type === "code" ? "code" : "preview"
  );

  async function copyToClipboard() {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadArtifact() {
    const ext = getFileExtension(artifact.type, artifact.language);
    const filename = `${artifact.title.toLowerCase().replace(/\s+/g, "-")}.${ext}`;
    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canPreview = ["html", "svg", "markdown"].includes(artifact.type);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {artifact.title}
          </h3>
          <p className="text-sm text-zinc-500">
            {artifact.type}
            {artifact.language && ` · ${artifact.language}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canPreview && (
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setView("preview")}
                className={`rounded-l-lg px-3 py-1 text-sm transition-colors ${
                  view === "preview"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setView("code")}
                className={`rounded-r-lg px-3 py-1 text-sm transition-colors ${
                  view === "code"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                Code
              </button>
            </div>
          )}
          <button
            onClick={copyToClipboard}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Copy to clipboard"
          >
            {copied ? (
              <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <button
            onClick={downloadArtifact}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Download"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "code" || artifact.type === "code" ? (
          <CodeView content={artifact.content} language={artifact.language} />
        ) : artifact.type === "html" ? (
          <HtmlPreview content={artifact.content} />
        ) : artifact.type === "svg" ? (
          <SvgPreview content={artifact.content} />
        ) : artifact.type === "markdown" ? (
          <MarkdownPreview content={artifact.content} />
        ) : artifact.type === "react" ? (
          <ReactPreview content={artifact.content} />
        ) : (
          <CodeView content={artifact.content} language={artifact.language} />
        )}
      </div>
    </div>
  );
}

function CodeView({ content, language }: { content: string; language?: string }) {
  return (
    <pre className="h-full overflow-auto bg-zinc-950 p-4 text-sm">
      <code className={`language-${language || "plaintext"} text-zinc-100`}>
        {content}
      </code>
    </pre>
  );
}

function HtmlPreview({ content }: { content: string }) {
  // Wrap content in proper HTML structure if needed
  const htmlContent = content.includes("<html") || content.includes("<!DOCTYPE")
    ? content
    : `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, sans-serif; padding: 1rem; }
  </style>
</head>
<body>
${content}
</body>
</html>`;

  return (
    <iframe
      srcDoc={htmlContent}
      className="h-full w-full bg-white"
      sandbox="allow-scripts"
      title="HTML Preview"
    />
  );
}

function SvgPreview({ content }: { content: string }) {
  return (
    <div
      className="flex h-full items-center justify-center bg-zinc-100 p-8 dark:bg-zinc-800"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

function MarkdownPreview({ content }: { content: string }) {
  // Simple markdown rendering - could use react-markdown for better support
  return (
    <div className="prose prose-zinc max-w-none p-6 dark:prose-invert">
      <pre className="whitespace-pre-wrap font-sans">{content}</pre>
    </div>
  );
}

function ReactPreview({ content }: { content: string }) {
  // For now, show code view with a note about React preview
  // Full React preview would require Sandpack
  return (
    <div className="flex h-full flex-col">
      <div className="bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        React preview requires Sandpack. Showing code view.
      </div>
      <div className="flex-1 overflow-auto">
        <CodeView content={content} language="tsx" />
      </div>
    </div>
  );
}
