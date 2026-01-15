# Claude SDKs Comparison

## Which SDK Should I Use?

**Custom tools only, lightweight?** → Use **Client SDK**

**File ops, or custom tools + file ops?** → Use **Agent SDK**

```
┌─────────────────────────────────────────────────────────────────┐
│                   LIGHTWEIGHT (Client SDK)                      │
│                   Custom tools, no file ops                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐   │
│  │   Your App  │────▶│  Client SDK      │────▶│  Claude API │   │
│  │  (any env)  │◀────│  (+ toolRunner)  │◀────│             │   │
│  └─────────────┘     └──────────────────┘     └─────────────┘   │
│                             │                                   │
│                             ▼                                   │
│                      ┌────────────────┐                         │
│                      │ YOUR Tools     │                         │
│                      │ - DB queries   │                         │
│                      │ - External APIs│                         │
│                      │ - Any function │                         │
│                      └────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   FULL-FEATURED (Agent SDK)                     │
│                   Pre-built + custom via MCP                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐   │
│  │   Your App  │────▶│  Agent SDK       │────▶│  Claude API │   │
│  │             │◀────│  (Claude Code)   │◀────│             │   │
│  └─────────────┘     └──────────────────┘     └─────────────┘   │
│                             │                                   │
│               ┌─────────────┴─────────────┐                     │
│               ▼                           ▼                     │
│        ┌──────────────┐           ┌──────────────┐              │
│        │ PRE-BUILT    │           │ CUSTOM (MCP) │              │
│        │ - Read/Write │           │ - DB queries │              │
│        │ - Bash       │           │ - APIs       │              │
│        │ - Grep/Glob  │           │ - Any tool   │              │
│        └──────────────┘           └──────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Overview

Anthropic provides two SDKs for building with Claude:

| SDK | Package | Tools | You Implement |
|-----|---------|-------|---------------|
| **Client SDK** | `@anthropic-ai/sdk` | Your own | Tool definitions + execution |
| **Agent SDK** | `@anthropic-ai/claude-agent-sdk` | Pre-built (Read, Write, Bash...) | Just the prompt |

## Client SDK (`@anthropic-ai/sdk`)

API wrapper where **you define and implement your own tools**. The SDK provides helpers
for the agentic loop, but you write the actual tool logic.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const client = new Anthropic();

// You define your tools - SDK handles the loop
const weatherTool = betaZodTool({
  name: "get_weather",
  description: "Get weather for a location",
  inputSchema: z.object({ location: z.string() }),
  run: async (input) => {
    // YOUR implementation - call weather API, database, etc.
    return `Weather in ${input.location}: 72°F`;
  },
});

// toolRunner (beta) handles the agentic loop for you
const result = await client.beta.messages.toolRunner({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools: [weatherTool],
  messages: [{ role: "user", content: "What's the weather in SF?" }],
});
```

**Key point**: You implement tool logic (DB queries, API calls, business logic).
The SDK can automate the loop, but the tools are yours to build.

## Agent SDK (`@anthropic-ai/claude-agent-sdk`)

**Claude Code as a library** - tools are pre-built and ready to use. You just provide
a prompt and select which tools to enable.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Tools are ALREADY implemented - just enable them
for await (const message of query({
  prompt: "Fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);
}
```

**Key point**: You don't implement Read/Write/Bash - they're Claude Code's built-in
tools with safety guardrails, permission systems, and error handling included.

### Built-in Tools

| Tool | What it does |
|------|--------------|
| Read | Read any file |
| Write | Create new files |
| Edit | Make precise edits |
| Bash | Run terminal commands |
| Glob | Find files by pattern |
| Grep | Search file contents |
| WebSearch | Search the web |
| WebFetch | Fetch web page content |
| AskUserQuestion | Ask user clarifying questions |

### Additional Features

- **Sessions** - maintain context across exchanges, resume or fork
- **Subagents** - spawn specialized agents for subtasks
- **Hooks** - run custom code at key points (PreToolUse, PostToolUse, Stop, etc.)
- **MCP** - connect databases, browsers, APIs via Model Context Protocol
- **Permissions** - control which tools agent can use

## When to Use Which

| Use Case | SDK | Why |
|----------|-----|-----|
| Chat/completion (no tools) | Client SDK | Simpler, direct API access |
| Custom tools only | Client SDK | Lighter weight, no CLI dependency |
| Custom tools + file ops | Agent SDK | MCP for custom + pre-built file tools |
| File read/write/edit | Agent SDK | Pre-built with safety guardrails |
| Run shell commands | Agent SDK | Pre-built Bash tool with permissions |
| Code search (grep/glob) | Agent SDK | Pre-built, battle-tested |
| CI/CD automation | Agent SDK | Full Claude Code capabilities |

## Key Difference

The SDKs differ in **what tools you get out of the box**:

| | Client SDK | Agent SDK |
|---|---|---|
| **Built-in tools** | None | Read, Write, Edit, Bash, Grep... |
| **Custom tools** | Direct implementation | Via MCP servers |
| **Tool execution** | Your code runs it | Claude Code subprocess |
| **Safety/permissions** | You implement | Built-in |
| **Best for** | Lightweight custom tools | File ops + custom tools combo |

**Example**: To let Claude read files with Client SDK, you'd implement a `read_file`
tool yourself. With Agent SDK, you just enable the `Read` tool - it's already built.

## Custom Tools with Agent SDK

Agent SDK isn't limited to pre-built tools. You can add custom tools via **MCP servers**.

### What is MCP?

**Model Context Protocol** - a standard protocol for Claude to communicate with external tools/services. Think of it like USB for AI tools - a universal connector.

```
┌─────────────────┐         MCP Protocol         ┌─────────────────┐
│                 │  ──────────────────────────► │                 │
│   Claude Agent  │      "call get_weather"      │   MCP Server    │
│                 │  ◄────────────────────────── │   (your tools)  │
│                 │      { temp: "72°F" }        │                 │
└─────────────────┘                              └─────────────────┘
```

### Why MCP?

The Agent SDK doesn't have a direct "add tool" API. Instead, it uses MCP as the **universal tool interface** for everything:

```
┌──────────────────────────────────────────────────────────────────┐
│                        Agent SDK                                 │
│                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│   │ Built-in     │   │ Your custom  │   │ Remote MCP   │        │
│   │ tools (Read, │   │ MCP server   │   │ server       │        │
│   │ Edit, Bash)  │   │ (in-process) │   │ (over HTTP)  │        │
│   └──────────────┘   └──────────────┘   └──────────────┘        │
│          │                  │                  │                 │
│          └──────────────────┼──────────────────┘                 │
│                             │                                    │
│                     All speak MCP                                │
└──────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- **Consistency** - Same interface for all tools (built-in, custom, remote)
- **Portability** - Your MCP server could run locally OR as a remote service
- **Ecosystem** - Reuse existing MCP servers (databases, APIs, etc.)

### `createSdkMcpServer` Explained

Creates an **in-process MCP server** - no network, no separate process. Just a local object that speaks the MCP protocol:

**TypeScript:**
```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Create an in-process MCP server with your custom tools
const toolServer = createSdkMcpServer({
  name: "my-tools",           // Server name (used in tool naming)
  version: "1.0.0",
  tools: [
    tool(
      "get_weather",                              // Tool name
      "Get weather for a location",               // Description
      { location: z.string() },                   // Zod schema for type safety
      async (args) => ({                          // Implementation
        content: [{ type: "text", text: `72°F in ${args.location}` }]
      })
    ),
  ],
});

// Use it with query()
for await (const event of query({
  prompt: "What's the weather in Tokyo?",
  options: {
    mcpServers: { "my-tools": toolServer },       // Register MCP server
    allowedTools: ["mcp__my-tools__get_weather"], // Tool naming: mcp__{server}__{tool}
    permissionMode: "bypassPermissions",
  },
})) {
  // Process events
}
```

**Python:**
```python
from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions

# Define custom tool
@tool("get_weather", "Get weather for a location", {"location": str})
async def get_weather(args):
    return {"content": [{"type": "text", "text": f"72°F in {args['location']}"}]}

# Create MCP server with your tools
my_tools = create_sdk_mcp_server(name="my-tools", version="1.0.0", tools=[get_weather])

# Use both built-in AND custom tools
options = ClaudeAgentOptions(
    system_prompt="You are a weather assistant.",
    allowed_tools=["Read", "mcp__my-tools__get_weather"],
    mcp_servers={"my-tools": my_tools}
)
```

### Tool Naming Convention

Custom tools follow the pattern: `mcp__{server-name}__{tool-name}`

| Server Name | Tool Name | Full Tool ID |
|-------------|-----------|--------------|
| `my-tools` | `get_weather` | `mcp__my-tools__get_weather` |
| `database` | `query` | `mcp__database__query` |

This gives you pre-built file ops + your custom business logic.

## Desktop Apps

| App Type | Recommended SDK | Why |
|----------|-----------------|-----|
| **Dev tools** (IDE plugins, CLI) | Agent SDK | Users likely have Claude Code; get file ops free |
| **Consumer apps** (Electron, Tauri) | Client SDK | No CLI dependency; easier distribution |

**Agent SDK trade-offs for desktop:**
- Requires Claude Code CLI installed on user's machine
- Spawns subprocess (heavier than direct API calls)
- Great for power users / developers

**Client SDK trade-offs for desktop:**
- You implement file operations yourself
- Lighter weight, no external dependencies
- Full control over UX

## Prerequisites

Agent SDK requires Claude Code CLI installed:
```bash
# macOS/Linux
curl -fsSL https://claude.ai/install.sh | bash

# Homebrew
brew install --cask claude-code
```

## Also Available in Python

Both SDKs have Python versions:

| SDK | Python Package |
|-----|----------------|
| Client SDK | `anthropic` |
| Agent SDK | `claude-agent-sdk` |

## Resources

- [Tool Use Overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [How to Implement Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Client SDK Reference](https://platform.claude.com/docs/en/api/client-sdks)
- [GitHub: anthropic-sdk-typescript](https://github.com/anthropics/anthropic-sdk-typescript)
- [GitHub: claude-code-sdk-python](https://github.com/anthropics/claude-code-sdk-python)
