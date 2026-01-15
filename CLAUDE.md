# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Portfolio demo showcasing Claude API tool use — the foundation for building AI agents.

Key resources:
- [Tool use overview](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [How to implement tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Advanced tool use (engineering blog)](https://www.anthropic.com/engineering/tool-use-best-practices)

## Setup

Copy `.env.local` and add your Anthropic API key:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Access in code: `process.env.ANTHROPIC_API_KEY`

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- TypeScript (strict mode)

## Architecture

```
src/
├── app/
│   ├── layout.tsx      # Root layout with Geist fonts
│   ├── page.tsx        # Home page
│   ├── globals.css     # Tailwind + CSS variables
│   └── api/            # Route handlers (for Claude API calls)
```

Path alias: `@/*` → `./src/*`
