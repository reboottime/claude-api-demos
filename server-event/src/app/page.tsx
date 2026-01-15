"use client";

import { useState, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    // Add empty assistant message that we'll stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setStreaming(true);

    // Create EventSource connection to SSE endpoint
    // EventSource is the browser's built-in API for Server-Sent Events
    const eventSource = new EventSource(
      `/api/sse?message=${encodeURIComponent(userMessage)}`
    );
    eventSourceRef.current = eventSource;

    // Handle incoming message events
    // Each event contains a chunk of Claude's response
    eventSource.addEventListener("message", (event) => {
      const text = JSON.parse(event.data);
      // Append chunk to the last message (assistant's response)
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = {
          ...updated[lastIndex],
          content: updated[lastIndex].content + text,
        };
        return updated;
      });
    });

    // Handle completion
    eventSource.addEventListener("done", () => {
      eventSource.close();
      setStreaming(false);
    });

    // Handle errors
    eventSource.addEventListener("error", () => {
      eventSource.close();
      setStreaming(false);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex].content === "") {
          updated[lastIndex].content = "Error: Connection failed";
        }
        return updated;
      });
    });
  }

  // Stop streaming if user wants to cancel
  function handleStop() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setStreaming(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Server-Sent Events Demo
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Watch Claude&apos;s response stream in real-time via SSE
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.length === 0 && (
            <div className="py-12 text-center text-zinc-400">
              <p>Ask anything to see streaming in action</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="space-y-3">
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
                  {msg.content || (
                    <span className="text-zinc-400">Thinking...</span>
                  )}
                  {/* Show cursor while streaming the assistant's response */}
                  {streaming &&
                    msg.role === "assistant" &&
                    i === messages.length - 1 && (
                      <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-zinc-400" />
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-700"
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-xl bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-500"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Send
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}
