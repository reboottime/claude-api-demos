"use client";

import { useState } from "react";

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

const EXAMPLE_PROMPTS = [
  "What's the weather in Tokyo?",
  "Compare weather in NYC, London, and Paris",
  "Is it warmer in Miami or Seattle right now?",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    const currentMessages = messages;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

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

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          steps: data.steps,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Failed to get response" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleExampleClick(prompt: string) {
    setInput(prompt);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-lg shadow-orange-500/20">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Claude Tool Use Demo
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Parallel tool calls with real-time weather API
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Empty State */}
          {messages.length === 0 && (
            <div className="py-16 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-xl shadow-orange-500/25">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-semibold text-slate-800 dark:text-slate-200">
                Try asking about the weather
              </h2>
              <p className="mb-8 text-slate-500 dark:text-slate-400">
                Watch Claude call external APIs in real-time
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleExampleClick(prompt)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-orange-600 dark:hover:bg-orange-950 dark:hover:text-orange-400"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className="space-y-3">
              {/* User Message */}
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 text-white shadow-lg dark:from-slate-200 dark:to-slate-100 dark:text-slate-900">
                    {msg.content}
                  </div>
                </div>
              )}

              {/* Assistant Message with Steps */}
              {msg.role === "assistant" && (
                <div className="space-y-3">
                  {/* Tool Steps */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="ml-2 space-y-2 border-l-2 border-orange-200 pl-4 dark:border-orange-800">
                      {msg.steps.map((step, j) => (
                        <div
                          key={j}
                          className={`rounded-lg p-3 text-sm ${
                            step.type === "tool_call"
                              ? "bg-orange-50 dark:bg-orange-950/50"
                              : "bg-emerald-50 dark:bg-emerald-950/50"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            {step.type === "tool_call" ? (
                              <>
                                <span className="flex h-5 w-5 items-center justify-center rounded bg-orange-500 text-xs text-white">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </span>
                                <span className="font-medium text-orange-700 dark:text-orange-400">
                                  Tool Call: {step.name}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-xs text-white">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                  Result: {step.name}
                                </span>
                              </>
                            )}
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-600 dark:text-slate-400">
                            {step.type === "tool_call"
                              ? JSON.stringify(step.input, null, 2)
                              : step.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Response */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-slate-900 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
                      {msg.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading State */}
          {loading && (
            <div className="space-y-3">
              <div className="ml-2 border-l-2 border-orange-200 pl-4 dark:border-orange-800">
                <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/50">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-orange-500 text-white">
                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      Processing...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input Footer */}
      <footer className="border-t border-slate-200 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the weather anywhere..."
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-orange-500 dark:focus:ring-orange-900/50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-medium text-white shadow-lg shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-amber-600 hover:shadow-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <span className="flex items-center gap-2">
              Send
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
        </form>
      </footer>
    </div>
  );
}
