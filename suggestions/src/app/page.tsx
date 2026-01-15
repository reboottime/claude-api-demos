"use client";

import { useState, useRef } from "react";

type Step = {
  type: "tool_call" | "tool_result";
  content: string;
  name?: string;
  input?: unknown;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  steps?: Step[];
};

// Stream event types from the API
type StreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; content: string }
  | { type: "suggestions"; suggestions: string[] }
  | { type: "done" }
  | { type: "error"; message: string };

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSteps, setStreamingSteps] = useState<Step[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse SSE stream and process events
  async function processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    currentMessages: Message[]
  ) {
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedText = "";
    const steps: Step[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (data: {...}\n\n)
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep incomplete chunk in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            try {
              const event: StreamEvent = JSON.parse(jsonStr);

              switch (event.type) {
                case "text_delta":
                  // Append delta to accumulated text and update UI immediately
                  accumulatedText += event.content;
                  setStreamingText(accumulatedText);
                  break;

                case "tool_call":
                  steps.push({
                    type: "tool_call",
                    name: event.name,
                    input: event.input,
                    content: `Calling ${event.name}...`,
                  });
                  setStreamingSteps([...steps]);
                  break;

                case "tool_result":
                  steps.push({
                    type: "tool_result",
                    name: event.name,
                    content: event.content,
                  });
                  setStreamingSteps([...steps]);
                  break;

                case "suggestions":
                  setSuggestions(event.suggestions);
                  break;

                case "done":
                  // Finalize: add assistant message to history
                  setMessages([
                    ...currentMessages,
                    {
                      role: "assistant",
                      content: accumulatedText,
                      steps: steps.length > 0 ? steps : undefined,
                    },
                  ]);
                  setStreamingText("");
                  setStreamingSteps([]);
                  break;

                case "error":
                  setMessages([
                    ...currentMessages,
                    { role: "assistant", content: `Error: ${event.message}` },
                  ]);
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      setMessages([
        ...currentMessages,
        {
          role: "assistant",
          content: `Stream error: ${error instanceof Error ? error.message : "Unknown"}`,
        },
      ]);
    }
  }

  async function sendMessage(userMessage: string, currentMessages: Message[]) {
    setLoading(true);
    setSuggestions([]);
    setStreamingText("");
    setStreamingSteps([]);

    try {
      const history = currentMessages.map(({ role, content }) => ({
        role,
        content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history }),
      });

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      await processStream(reader, [
        ...currentMessages,
        { role: "user", content: userMessage },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    const currentMessages = messages;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    await sendMessage(userMessage, currentMessages);
  }

  async function handleSuggestionClick(suggestion: string) {
    if (loading) return;

    const currentMessages = messages;
    setMessages((prev) => [...prev, { role: "user", content: suggestion }]);
    setSuggestions([]);

    await sendMessage(suggestion, currentMessages);
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Streaming Suggestions Demo
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Responses stream in real-time with follow-up suggestions
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.length === 0 && !streamingText && (
            <div className="py-12 text-center text-zinc-400">
              <p>Try: &quot;What&apos;s the weather in Tokyo?&quot; or &quot;What holidays are coming up?&quot;</p>
            </div>
          )}

          {/* Completed messages */}
          {messages.map((msg, i) => (
            <div key={i} className="space-y-3">
              {/* Tool steps (show above assistant message) */}
              {msg.role === "assistant" && msg.steps && msg.steps.length > 0 && (
                <div className="ml-4 space-y-2">
                  {msg.steps.map((step, j) => (
                    <div
                      key={j}
                      className="text-xs font-mono text-zinc-500 dark:text-zinc-400"
                    >
                      {step.type === "tool_call" ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          → {step.name}({JSON.stringify(step.input)})
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          ← {step.content.slice(0, 100)}
                          {step.content.length > 100 ? "..." : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Streaming response (in progress) */}
          {(streamingText || streamingSteps.length > 0) && (
            <div className="space-y-3">
              {/* Streaming tool steps */}
              {streamingSteps.length > 0 && (
                <div className="ml-4 space-y-2">
                  {streamingSteps.map((step, j) => (
                    <div
                      key={j}
                      className="text-xs font-mono text-zinc-500 dark:text-zinc-400"
                    >
                      {step.type === "tool_call" ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          → {step.name}({JSON.stringify(step.input)})
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          ← {step.content.slice(0, 100)}
                          {step.content.length > 100 ? "..." : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Streaming text */}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl bg-white px-4 py-3 text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700">
                    <div className="whitespace-pre-wrap">
                      {streamingText}
                      <span className="inline-block h-4 w-1 animate-pulse bg-zinc-400 ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading indicator (when waiting for first token) */}
          {loading && !streamingText && streamingSteps.length === 0 && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                <div className="flex items-center gap-2 text-zinc-500">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {suggestions.length > 0 && !loading && (
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="w-full text-xs text-zinc-400 mb-1">
                Suggested follow-ups:
              </span>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-50 active:scale-95 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-700"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
