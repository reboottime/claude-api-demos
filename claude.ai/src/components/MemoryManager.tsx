"use client";

import { useState, useEffect, useCallback } from "react";
import { Memory } from "@/db/schema";

type MemoryManagerProps = {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
};

const MEMORY_TYPES = [
  { value: "preference", label: "Preference", description: "How you prefer things done" },
  { value: "fact", label: "Fact", description: "Information about you" },
  { value: "instruction", label: "Instruction", description: "Specific rules to follow" },
] as const;

export function MemoryManager({ open, onClose, projectId }: MemoryManagerProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editType, setEditType] = useState<Memory["type"]>("preference");

  // New memory form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<Memory["type"]>("preference");
  const [newScope, setNewScope] = useState<"global" | "project">("global");

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const param = projectId ? `?projectId=${projectId}` : "";
      const res = await fetch(`/api/memories${param}`);
      const data = await res.json();
      setMemories(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchMemories();
    }
  }, [open, fetchMemories]);

  async function handleAdd() {
    if (!newContent.trim()) return;

    await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newType,
        content: newContent.trim(),
        projectId: newScope === "project" ? projectId : null,
      }),
    });

    setNewContent("");
    setNewType("preference");
    setNewScope("global");
    setShowAddForm(false);
    fetchMemories();
  }

  async function handleUpdate(id: string) {
    await fetch(`/api/memories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: editType,
        content: editContent.trim(),
      }),
    });

    setEditingId(null);
    fetchMemories();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/memories?id=${id}`, { method: "DELETE" });
    fetchMemories();
  }

  function startEditing(memory: Memory) {
    setEditingId(memory.id);
    setEditContent(memory.content);
    setEditType(memory.type);
  }

  if (!open) return null;

  const globalMemories = memories.filter((m) => !m.projectId);
  const projectMemories = memories.filter((m) => m.projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-700">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Memory
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Claude remembers these across conversations
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Global Memories */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Global Memories
                </h3>
                {globalMemories.length === 0 ? (
                  <p className="text-sm text-zinc-400">No global memories saved yet.</p>
                ) : (
                  <div className="space-y-2">
                    {globalMemories.map((memory) => (
                      <MemoryItem
                        key={memory.id}
                        memory={memory}
                        isEditing={editingId === memory.id}
                        editContent={editContent}
                        editType={editType}
                        onEditContentChange={setEditContent}
                        onEditTypeChange={setEditType}
                        onStartEdit={() => startEditing(memory)}
                        onSave={() => handleUpdate(memory.id)}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => handleDelete(memory.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Project Memories */}
              {projectId && (
                <div>
                  <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Project Memories
                  </h3>
                  {projectMemories.length === 0 ? (
                    <p className="text-sm text-zinc-400">No project-specific memories.</p>
                  ) : (
                    <div className="space-y-2">
                      {projectMemories.map((memory) => (
                        <MemoryItem
                          key={memory.id}
                          memory={memory}
                          isEditing={editingId === memory.id}
                          editContent={editContent}
                          editType={editType}
                          onEditContentChange={setEditContent}
                          onEditTypeChange={setEditType}
                          onStartEdit={() => startEditing(memory)}
                          onSave={() => handleUpdate(memory.id)}
                          onCancel={() => setEditingId(null)}
                          onDelete={() => handleDelete(memory.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Add new memory form */}
              {showAddForm && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div className="space-y-3">
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="What should Claude remember?"
                      rows={2}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-700"
                    />
                    <div className="flex gap-3">
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as Memory["type"])}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        {MEMORY_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {projectId && (
                        <select
                          value={newScope}
                          onChange={(e) => setNewScope(e.target.value as "global" | "project")}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        >
                          <option value="global">Global</option>
                          <option value="project">This project only</option>
                        </select>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setNewContent("");
                        }}
                        className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAdd}
                        disabled={!newContent.trim()}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-200 p-4 dark:border-zinc-700">
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add memory
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type MemoryItemProps = {
  memory: Memory;
  isEditing: boolean;
  editContent: string;
  editType: Memory["type"];
  onEditContentChange: (content: string) => void;
  onEditTypeChange: (type: Memory["type"]) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

function MemoryItem({
  memory,
  isEditing,
  editContent,
  editType,
  onEditContentChange,
  onEditTypeChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: MemoryItemProps) {
  const typeInfo = MEMORY_TYPES.find((t) => t.value === memory.type);

  if (isEditing) {
    return (
      <div className="rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-800">
        <textarea
          value={editContent}
          onChange={(e) => onEditContentChange(e.target.value)}
          rows={2}
          className="mb-2 w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
        />
        <div className="flex items-center justify-between">
          <select
            value={editType}
            onChange={(e) => onEditTypeChange(e.target.value as Memory["type"])}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          >
            {MEMORY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex-1">
        <p className="text-sm text-zinc-800 dark:text-zinc-200">{memory.content}</p>
        <span className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
          {typeInfo?.label}
        </span>
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onStartEdit}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          title="Edit"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          title="Delete"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
