"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MessageContent } from "@/components/MessageContent";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProjectSelector } from "@/components/ProjectSelector";
import { ProjectSettings } from "@/components/ProjectSettings";
import { ArtifactPanel } from "@/components/ArtifactPanel";
import { StyleSelector } from "@/components/StyleSelector";
import { MemoryManager } from "@/components/MemoryManager";
import { useToast } from "@/components/Toast";
import { Conversation, Message, Project, Style } from "@/db/schema";
import { ParsedArtifact } from "@/lib/artifacts";

type Citation = {
  title: string;
  url: string;
};

type DisplayMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type FileAttachment = {
  url: string;
  name: string;
  type: string;
  size: number;
  extractedText?: string | null;
  isImage?: boolean;
  isPdf?: boolean;
};

export default function Home() {
  const { showToast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Artifacts state
  const [selectedArtifact, setSelectedArtifact] = useState<ParsedArtifact | null>(null);

  // Styles state
  const [styles, setStyles] = useState<Style[]>([]);
  const [currentStyle, setCurrentStyle] = useState<Style | null>(null);

  // Memory manager state
  const [memoryManagerOpen, setMemoryManagerOpen] = useState(false);

  // File attachments state
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Web search state
  const [searching, setSearching] = useState(false);

  const fetchConversations = useCallback(async () => {
    setSidebarLoading(true);
    try {
      const projectParam = currentProject ? `?projectId=${currentProject.id}` : "";
      const res = await fetch(`/api/conversations${projectParam}`);
      const data = await res.json();
      setConversations(data);
    } finally {
      setSidebarLoading(false);
    }
  }, [currentProject]);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
  }, []);

  const fetchStyles = useCallback(async () => {
    const res = await fetch("/api/styles");
    const data = await res.json();
    setStyles(data);
  }, []);

  // Load conversations, projects, and styles on mount
  useEffect(() => {
    fetchConversations();
    fetchProjects();
    fetchStyles();
  }, [fetchConversations, fetchProjects, fetchStyles]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + K: New chat
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleNewChat();
      }
      // Escape: Close panels
      if (e.key === "Escape") {
        if (selectedArtifact) {
          setSelectedArtifact(null);
        } else if (projectSettingsOpen) {
          setProjectSettingsOpen(false);
        } else if (memoryManagerOpen) {
          setMemoryManagerOpen(false);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedArtifact, projectSettingsOpen, memoryManagerOpen]);

  function handleProjectSelect(project: Project | null) {
    setCurrentProject(project);
    // Clear current conversation when switching projects
    setCurrentConversationId(null);
    setMessages([]);
  }

  function handleProjectSave(project: Project) {
    fetchProjects();
    // If editing current project, update it
    if (currentProject?.id === project.id) {
      setCurrentProject(project);
    }
  }

  function handleProjectDelete(project: Project) {
    fetchProjects();
    // If deleting current project, clear selection
    if (currentProject?.id === project.id) {
      setCurrentProject(null);
      setCurrentConversationId(null);
      setMessages([]);
    }
  }

  async function loadConversation(id: string) {
    setCurrentConversationId(id);
    // Load messages for this conversation
    const res = await fetch(`/api/conversations/${id}/messages`);
    if (res.ok) {
      const data: Message[] = await res.json();
      setMessages(
        data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );
    }
  }

  function handleNewChat() {
    setCurrentConversationId(null);
    setMessages([]);
    setInput("");
  }

  async function handleDeleteConversation(id: string) {
    await fetch(`/api/conversations?id=${id}`, { method: "DELETE" });
    await fetchConversations();
    if (currentConversationId === id) {
      handleNewChat();
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newAttachments: FileAttachment[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Upload failed");
        }

        const attachment = await res.json();
        newAttachments.push(attachment);
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (error) {
      console.error("Upload error:", error);
      showToast(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMessage = input.trim() || "Please analyze the attached file(s).";
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);

    // Build display message with attachment indicators
    let displayContent = userMessage;
    if (currentAttachments.length > 0) {
      const fileNames = currentAttachments.map((a) => a.name).join(", ");
      displayContent = `📎 ${fileNames}\n\n${userMessage}`;
    }

    setMessages((prev) => [...prev, { role: "user", content: displayContent }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId: currentConversationId,
          projectId: currentProject?.id,
          styleId: currentStyle?.id,
          attachments: currentAttachments,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";
      let newConversationId: string | null = null;

      // Add empty assistant message to show streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "conversation_id") {
            newConversationId = data.id;
            setCurrentConversationId(data.id);
          } else if (data.type === "searching") {
            setSearching(true);
          } else if (data.type === "text") {
            setSearching(false);
            assistantMessage += data.text;
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                role: "assistant",
                content: assistantMessage,
              };
              return newMessages;
            });
          } else if (data.type === "citations") {
            // Attach citations to the current message
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                citations: data.citations,
              };
              return newMessages;
            });
          } else if (data.type === "done") {
            // Generate title for new conversations (first message)
            if (!currentConversationId && newConversationId) {
              fetch(`/api/conversations/${newConversationId}/title`, { method: "POST" })
                .then(() => fetchConversations())
                .catch(console.error);
            } else {
              await fetchConversations();
            }
          } else if (data.type === "error") {
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                role: "assistant",
                content: `Error: ${data.error}`,
              };
              return newMessages;
            });
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get response";
      showToast(errorMessage, "error");
      setMessages((prev) => [
        ...prev.slice(0, -1), // Remove the empty assistant message
        {
          role: "assistant",
          content: `Error: ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={loadConversation}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
          loading={sidebarLoading}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Claude
          </h1>
          <ProjectSelector
            projects={projects}
            currentProject={currentProject}
            onSelect={handleProjectSelect}
            onCreateNew={() => {
              setEditingProject(null);
              setProjectSettingsOpen(true);
            }}
            onEdit={(project) => {
              setEditingProject(project);
              setProjectSettingsOpen(true);
            }}
          />
          <div className="flex-1" />
          <StyleSelector
            styles={styles}
            currentStyle={currentStyle}
            onSelect={setCurrentStyle}
          />
          <button
            onClick={() => setMemoryManagerOpen(true)}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Memory"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </button>
          <ThemeToggle />
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 p-4">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  How can I help you today?
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Start a conversation with Claude
                </p>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className="flex gap-4">
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "user"
                        ? "bg-zinc-200 dark:bg-zinc-700"
                        : "bg-gradient-to-br from-orange-400 to-orange-600"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <svg
                        className="h-5 w-5 text-zinc-600 dark:text-zinc-300"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Message content */}
                  <div className="flex-1 overflow-hidden">
                    <div className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {msg.role === "user" ? "You" : "Claude"}
                    </div>
                    <div className="text-zinc-700 dark:text-zinc-300">
                      {msg.role === "assistant" ? (
                        <MessageContent
                          content={msg.content}
                          onArtifactClick={setSelectedArtifact}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {msg.role === "assistant" &&
                        loading &&
                        i === messages.length - 1 &&
                        !msg.content && (
                          <div className="flex items-center gap-2">
                            {searching ? (
                              <>
                                <svg className="h-4 w-4 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="text-sm text-zinc-400">Searching the web...</span>
                              </>
                            ) : (
                              <>
                                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                              </>
                            )}
                          </div>
                        )}
                      {/* Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.citations.map((citation, idx) => (
                              <a
                                key={idx}
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                <span className="max-w-[200px] truncate">{citation.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input footer */}
        <footer className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            {/* Attached files display */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    {file.isImage ? (
                      <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="max-w-[150px] truncate text-zinc-700 dark:text-zinc-300">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="application/pdf,image/png,image/jpeg,image/gif,image/webp"
                multiple
                className="hidden"
              />

              {/* Attach file button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-2 left-2 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                title="Attach file"
              >
                {uploading ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message Claude..."
                rows={1}
                className="w-full resize-none rounded-xl border border-zinc-300 bg-white py-3 pl-12 pr-12 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-700"
                style={{
                  minHeight: "48px",
                  maxHeight: "200px",
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute bottom-2 right-2 rounded-lg bg-zinc-900 p-2 text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-zinc-400">
              Claude can make mistakes. Please verify important information.
            </p>
          </form>
        </footer>
      </div>

      {/* Artifact Panel */}
      {selectedArtifact && (
        <ArtifactPanel
          artifact={selectedArtifact}
          onClose={() => setSelectedArtifact(null)}
        />
      )}

      {/* Project Settings Modal */}
      <ProjectSettings
        project={editingProject}
        open={projectSettingsOpen}
        onClose={() => setProjectSettingsOpen(false)}
        onSave={handleProjectSave}
        onDelete={handleProjectDelete}
      />

      {/* Memory Manager Modal */}
      <MemoryManager
        open={memoryManagerOpen}
        onClose={() => setMemoryManagerOpen(false)}
        projectId={currentProject?.id}
      />
    </div>
  );
}
