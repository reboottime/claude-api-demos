# Claude.ai Clone - Implementation Plan

## Overview
Full claude.ai clone using Next.js 16, React 19, Tailwind v4, TypeScript, Anthropic SDK, Turso (SQLite), Vercel Blob.

**Location:** `/claude-code-api-demos/claude.ai/`

---

## Progress

### Phase 1: MVP - Chat + Database [COMPLETED]

- [x] **1.1 Database Setup (Turso + Drizzle)**
  - Installed: `drizzle-orm`, `@libsql/client`, `nanoid`, `drizzle-kit`
  - Created `/src/db/schema.ts` - Tables: conversations, messages, projects, projectFiles, artifacts, memories, styles, userPreferences
  - Created `/src/db/index.ts` - Drizzle client
  - Created `/drizzle.config.ts` - Migration config
  - Database pushed with `npm run db:push`

- [x] **1.2 Streaming Chat API**
  - Updated `/src/app/api/chat/route.ts`
  - SSE streaming with `anthropic.messages.stream()`
  - Persists messages to database after completion
  - Loads conversation history from DB
  - Auto-creates conversation on first message

- [x] **1.3 Conversation Sidebar**
  - Created `/src/components/Sidebar.tsx`
  - Conversations grouped by date (Today, Yesterday, Previous 7 days, etc.)
  - New chat button, delete conversation
  - Created `/src/app/api/conversations/route.ts` - List/delete
  - Created `/src/app/api/conversations/[id]/messages/route.ts` - Get messages

- [x] **1.4 Dark/Light Mode**
  - Created `/src/components/ThemeToggle.tsx`
  - Persists preference to localStorage
  - Respects system preference on first load

- [x] **1.5 Markdown Rendering**
  - Installed: `react-markdown`, `remark-gfm`
  - Created `/src/components/MessageContent.tsx`
  - Code blocks with copy button
  - Tables, lists, blockquotes, headings styled

---

### Phase 2: Projects + Artifacts [COMPLETED]

- [x] **2.1 Projects Feature**
  - Schema already defined in `/src/db/schema.ts` (projects, projectFiles tables)
  - Created API routes:
    - `GET/POST /api/projects` - List and create projects
    - `GET/PUT/DELETE /api/projects/[id]` - Get, update, delete projects
  - Created components:
    - `/src/components/ProjectSelector.tsx` - Header dropdown with project selection
    - `/src/components/ProjectSettings.tsx` - Modal for create/edit/delete projects
  - Integrated into main page with project-filtered conversations
  - Updated `/api/conversations` to filter by projectId

- [x] **2.2 Artifacts System**
  - Updated system prompt to instruct Claude to use `<artifact>` tags
  - Created `/src/lib/artifacts.ts` - Artifact parsing utility
  - Created components:
    - `/src/components/ArtifactPanel.tsx` - Slide-in right panel
    - `/src/components/ArtifactPreview.tsx` - Code/HTML/SVG/Markdown preview with copy/download
  - Updated `/src/components/MessageContent.tsx` to render artifact buttons
  - Integrated artifact panel into main page
  - TODO (future): Install Sandpack for React live preview, add version selector

---

### Phase 3: Memory + Styles [COMPLETED]

- [x] **3.1 Memory System**
  - Schema already defined (memories table)
  - Created API routes:
    - `GET/POST/DELETE /api/memories` - List, create, delete memories
    - `PUT/DELETE /api/memories/[id]` - Update, delete specific memory
  - Created `/src/components/MemoryManager.tsx` - Modal to view/add/edit/delete memories
  - Memories are grouped by global and project-specific
  - Three memory types: preference, fact, instruction
  - Memories injected into system prompt

- [x] **3.2 Response Styles**
  - Schema already defined (styles table)
  - Created API routes:
    - `GET/POST/DELETE /api/styles` - List, create, delete styles
  - Built-in styles auto-seeded on first request: Concise, Detailed, Formal, Friendly
  - Created `/src/components/StyleSelector.tsx` - Header dropdown selector
  - Style instructions applied to system prompt

---

### Phase 4: File Uploads + Polish [COMPLETED]

- [x] **4.1 File Upload**
  - Installed: `@vercel/blob`, `pdf-parse`
  - Created `POST /api/upload` - Upload to Vercel Blob (with base64 fallback for local dev)
  - Extract text from PDFs using pdf-parse
  - Support images via Claude's vision capability (base64 and URL sources)
  - File upload UI with attachment button in chat input
  - Display attached files with remove option

- [x] **4.2 Polish**
  - Auto-generate conversation titles via Claude after first exchange
  - Keyboard shortcuts: Cmd/Ctrl+K new chat, Esc close panels
  - Loading skeletons for sidebar conversations
  - Toast notification system with success/error/info variants
  - Error handling with toast notifications

---

## Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# For production (Turso)
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# For file uploads (required for production, optional for local dev)
BLOB_READ_WRITE_TOKEN=...
```

For local development:
- SQLite file is used (`file:local.db`)
- File uploads use base64 data URLs (no Vercel Blob token needed)

---

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run db:push    # Push schema to database
npm run db:studio  # Open Drizzle Studio (DB GUI)
```

---

## File Structure (Current)

```
claude.ai/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Main chat interface
│   │   ├── globals.css
│   │   └── api/
│   │       ├── chat/route.ts     # Streaming chat with file support
│   │       ├── upload/route.ts   # File upload to Vercel Blob
│   │       ├── conversations/
│   │       │   ├── route.ts      # List/delete conversations
│   │       │   └── [id]/
│   │       │       ├── messages/route.ts
│   │       │       └── title/route.ts  # Auto-generate title
│   │       ├── projects/
│   │       │   ├── route.ts      # List/create projects
│   │       │   └── [id]/route.ts # Get/update/delete project
│   │       ├── memories/
│   │       │   ├── route.ts      # List/create/delete memories
│   │       │   └── [id]/route.ts # Update/delete memory
│   │       └── styles/
│   │           └── route.ts      # List/create/delete styles
│   ├── components/
│   │   ├── Sidebar.tsx           # Conversation list with skeleton loading
│   │   ├── MessageContent.tsx    # Markdown rendering
│   │   ├── ThemeToggle.tsx       # Dark/light mode
│   │   ├── ProjectSelector.tsx   # Project dropdown
│   │   ├── ProjectSettings.tsx   # Project edit modal
│   │   ├── ArtifactPanel.tsx     # Artifact side panel
│   │   ├── ArtifactPreview.tsx   # Artifact preview renderer
│   │   ├── StyleSelector.tsx     # Response style dropdown
│   │   ├── MemoryManager.tsx     # Memory view/edit modal
│   │   └── Toast.tsx             # Toast notification system
│   ├── lib/
│   │   └── artifacts.ts          # Artifact parsing utilities
│   └── db/
│       ├── index.ts              # Drizzle client
│       └── schema.ts             # All table definitions
├── drizzle.config.ts
├── local.db                      # SQLite database (local dev)
├── package.json
└── PLAN.md                       # This file
```

---

## References

- Streaming pattern: `/streaming/src/app/api/generate/route.ts`
- Tool use pattern: `/tool-use/src/app/api/chat/route.ts`
- Client SSE parsing: `/suggestions/src/app/page.tsx`
- [Drizzle + Turso docs](https://orm.drizzle.team/docs/tutorials/drizzle-with-turso)
- [Sandpack docs](https://sandpack.codesandbox.io/)
