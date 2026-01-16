"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useMemo } from "react";
import { parseArtifacts, ParsedArtifact, ArtifactType } from "@/lib/artifacts";

type Props = {
  content: string;
  onArtifactClick?: (artifact: ParsedArtifact) => void;
};

function ArtifactIcon({ type }: { type: ArtifactType }) {
  if (type === "code") {
    return (
      <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
  }
  if (type === "html" || type === "react") {
    return (
      <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === "svg") {
    return (
      <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  // markdown
  return (
    <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CodeBlock({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace("language-", "") || "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg bg-zinc-900 dark:bg-zinc-950">
      {language && (
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2 text-xs text-zinc-400">
          <span>{language}</span>
          <button
            onClick={handleCopy}
            className="rounded px-2 py-1 transition-colors hover:bg-zinc-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="text-sm text-zinc-100">{children}</code>
      </pre>
    </div>
  );
}

export function MessageContent({ content, onArtifactClick }: Props) {
  // Parse artifacts from content
  const { text, artifacts } = useMemo(() => parseArtifacts(content), [content]);

  // Map artifact IDs to artifacts for quick lookup
  const artifactMap = useMemo(() => {
    const map = new Map<string, ParsedArtifact>();
    for (const artifact of artifacts) {
      map.set(artifact.id, artifact);
    }
    return map;
  }, [artifacts]);

  // Render artifact button inline
  function renderWithArtifacts(text: string) {
    const parts = text.split(/(\[\[ARTIFACT:[^\]]+\]\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[\[ARTIFACT:([^:]+):([^\]]+)\]\]/);
      if (match) {
        const [, id, title] = match;
        const artifact = artifactMap.get(id);
        if (artifact) {
          return (
            <button
              key={i}
              onClick={() => onArtifactClick?.(artifact)}
              className="my-2 flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <ArtifactIcon type={artifact.type} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {title}
                </div>
                <div className="text-sm text-zinc-500">
                  Click to view {artifact.type}
                  {artifact.language && ` · ${artifact.language}`}
                </div>
              </div>
              <svg
                className="h-5 w-5 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          );
        }
      }
      return part;
    });
  }

  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Custom text renderer to handle artifact placeholders
        p({ children }) {
          // Check if children is a string with artifact placeholder
          if (typeof children === "string" && children.includes("[[ARTIFACT:")) {
            return <div className="mb-3 last:mb-0">{renderWithArtifacts(children)}</div>;
          }
          // Handle array of children (mixed content)
          if (Array.isArray(children)) {
            const processedChildren = children.map((child, i) => {
              if (typeof child === "string" && child.includes("[[ARTIFACT:")) {
                return <span key={i}>{renderWithArtifacts(child)}</span>;
              }
              return child;
            });
            return <p className="mb-3 last:mb-0">{processedChildren}</p>;
          }
          return <p className="mb-3 last:mb-0">{children}</p>;
        },
        code({ className, children, ...props }) {
          const isInline = !className;
          const content = String(children).replace(/\n$/, "");

          if (isInline) {
            return (
              <code
                className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800"
                {...props}
              >
                {content}
              </code>
            );
          }

          return <CodeBlock className={className}>{content}</CodeBlock>;
        },
        ul({ children }) {
          return <ul className="mb-3 list-disc pl-6 last:mb-0">{children}</ul>;
        },
        ol({ children }) {
          return (
            <ol className="mb-3 list-decimal pl-6 last:mb-0">{children}</ol>
          );
        },
        li({ children }) {
          return <li className="mb-1">{children}</li>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              className="text-blue-600 hover:underline dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="mb-3 border-l-4 border-zinc-300 pl-4 italic text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
              {children}
            </blockquote>
          );
        },
        h1({ children }) {
          return (
            <h1 className="mb-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {children}
            </h3>
          );
        },
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse border border-zinc-300 dark:border-zinc-700">
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-800">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-zinc-300 px-3 py-2 dark:border-zinc-700">
              {children}
            </td>
          );
        },
      }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
