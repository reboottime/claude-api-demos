"use client";

import { useState, useRef } from "react";

type StreamState = "idle" | "streaming" | "done" | "error";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [story, setStory] = useState("");
  const [state, setState] = useState<StreamState>("idle");
  const [usage, setUsage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleGenerate() {
    if (!prompt.trim() || state === "streaming") return;

    // Reset state
    setStory("");
    setUsage(null);
    setError(null);
    setState("streaming");

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (end with \n\n)
        const messages = buffer.split("\n\n");
        buffer = messages.pop() || ""; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.startsWith("data: ")) continue;

          const data = JSON.parse(message.slice(6));

          if (data.type === "text") {
            setStory((prev) => prev + data.text);
          } else if (data.type === "done") {
            setUsage(data.usage);
            setState("done");
          } else if (data.type === "error") {
            setError(data.error);
            setState("error");
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setState("idle");
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
        setState("error");
      }
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
    setState("idle");
  }

  const examplePrompts = [
    "A robot discovers it can dream",
    "The last library on Earth",
    "A time traveler's first day job",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Claude Streaming Demo
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Watch stories generate in real-time with Server-Sent Events
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Prompt Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Story Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a story idea..."
              rows={3}
              disabled={state === "streaming"}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-700"
            />
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example) => (
                <button
                  key={example}
                  onClick={() => setPrompt(example)}
                  disabled={state === "streaming"}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || state === "streaming"}
              className="flex-1 rounded-xl bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {state === "streaming" ? "Generating..." : "Generate Story"}
            </button>
            {state === "streaming" && (
              <button
                onClick={handleCancel}
                className="rounded-xl border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Story Output */}
          {(story || state === "streaming") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Generated Story
                </h2>
                {state === "streaming" && (
                  <span className="flex items-center gap-2 text-sm text-zinc-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    Streaming...
                  </span>
                )}
              </div>
              <div className="min-h-[200px] rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
                <p className="whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {story}
                  {state === "streaming" && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-zinc-400" />
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Usage Stats */}
          {usage && state === "done" && (
            <div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <span className="font-medium">Tokens used:</span> {usage.input_tokens} input, {usage.output_tokens} output
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
