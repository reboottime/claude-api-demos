"use client";

import { Conversation } from "@/db/schema";

type Props = {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
};

function SkeletonItem() {
  return (
    <div className="animate-pulse rounded-lg px-3 py-2">
      <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

function SkeletonGroup() {
  return (
    <div className="mb-4">
      <div className="mb-1 px-2">
        <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="space-y-1">
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function groupConversations(conversations: Conversation[]) {
  const groups: Record<string, Conversation[]> = {};

  for (const conv of conversations) {
    const label = formatDate(new Date(conv.updatedAt));
    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  }

  return groups;
}

export function Sidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  loading = false,
}: Props) {
  const groups = groupConversations(conversations);
  const groupOrder = [
    "Today",
    "Yesterday",
    "Previous 7 days",
    "Previous 30 days",
  ];

  // Sort groups: known labels first, then others by date
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    const aIndex = groupOrder.indexOf(a);
    const bIndex = groupOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {loading && (
          <>
            <SkeletonGroup />
            <SkeletonGroup />
          </>
        )}

        {!loading && sortedGroups.map(([label, convs]) => (
          <div key={label} className="mb-4">
            <h3 className="mb-1 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {label}
            </h3>
            <ul className="space-y-1">
              {convs.map((conv) => (
                <li key={conv.id} className="group relative">
                  <button
                    onClick={() => onSelect(conv.id)}
                    className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      conv.id === currentId
                        ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {conv.title || "New conversation"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    title="Delete conversation"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {!loading && conversations.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-zinc-400">
            No conversations yet
          </p>
        )}
      </nav>
    </aside>
  );
}
