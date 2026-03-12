# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat interface, and Claude generates JSX files that are immediately rendered in an in-browser preview — without writing anything to disk.

## Commands

```bash
# Initial setup (install deps + generate Prisma client + run migrations)
npm run setup

# Development server
npm run dev

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Lint
npm run lint

# Build
npm run build

# Reset database
npm run db:reset
```

The dev server requires `NODE_OPTIONS='--require ./node-compat.cjs'` (already included in the npm scripts) due to Node.js compatibility shims for the Next.js/Turbopack setup.

## Environment

Create a `.env` file with:
```
ANTHROPIC_API_KEY=your-api-key-here
JWT_SECRET=your-jwt-secret
```

Without `ANTHROPIC_API_KEY`, the app runs using `MockLanguageModel` in `src/lib/provider.ts`, which returns static component examples (counter, form, card) — useful for development without API costs.

## Architecture

### AI Code Generation Flow

1. User sends a message via `ChatInterface` → POST to `/api/chat`
2. The route handler (`src/app/api/chat/route.ts`) deserializes the virtual file system from the request, calls `streamText` (Vercel AI SDK) with two tools: `str_replace_editor` and `file_manager`
3. The AI streams back tool calls that create/modify files in the `VirtualFileSystem`
4. On the client, `chat-context.tsx` processes incoming tool calls via `handleToolCall` in `file-system-context.tsx`, which updates the in-memory VFS
5. `PreviewFrame` detects VFS changes via `refreshTrigger` and re-renders the preview by injecting transformed JSX into an `<iframe srcdoc>`

### Virtual File System

`src/lib/file-system.ts` — `VirtualFileSystem` class that holds all generated files in memory (no disk writes). Supports create/read/update/delete/rename operations. The `serialize()` / `deserializeFromNodes()` methods convert the VFS to/from plain JSON for network transport and database storage.

### Live Preview

`src/components/preview/PreviewFrame.tsx` uses `@babel/standalone` (via `src/lib/transform/jsx-transformer.ts`) to transpile JSX/TSX in the browser. It creates blob URLs for each file and injects them via an import map into an `<iframe>`. Entry point defaults to `/App.jsx`; also checks `/App.tsx`, `/index.jsx`, `/index.tsx`, `/src/App.jsx`.

### AI Tools

- `str_replace_editor` (`src/lib/tools/str-replace.ts`): Implements `view`, `create`, `str_replace`, and `insert` commands on the VFS — matches the Anthropic text editor tool interface
- `file_manager` (`src/lib/tools/file-manager.ts`): Implements `rename` and `delete` commands

### Auth

Cookie-based JWT auth (`src/lib/auth.ts`) using `jose`. Sessions last 7 days. The middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem` routes. Users can also use the app anonymously (projects are persisted per-session via `anon-work-tracker.ts`).

### Database

SQLite via Prisma. The database schema is defined in `prisma/schema.prisma` — reference it whenever you need to understand the structure of data stored in the database. Two models: `User` and `Project`. Projects store chat messages and VFS state as JSON strings (`messages` and `data` columns). Prisma client is generated to `src/generated/prisma/`.

### State Management

Two React contexts:
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`): Owns the `VirtualFileSystem` instance; exposes file CRUD operations and `handleToolCall` to process AI tool calls
- `ChatContext` (`src/lib/contexts/chat-context.tsx`): Manages chat messages and the AI streaming state using Vercel AI SDK's `useChat`

### Key Directories

- `src/app/` — Next.js App Router pages and API routes
- `src/components/chat/` — Chat UI (input, message list, markdown renderer)
- `src/components/editor/` — Monaco code editor and file tree
- `src/components/preview/` — Iframe-based live preview
- `src/lib/contexts/` — React context providers
- `src/lib/tools/` — AI tool implementations
- `src/lib/transform/` — Babel JSX→JS transformation for in-browser preview
- `src/lib/prompts/` — System prompt for component generation

## Code Style

Use comments sparingly — only for complex logic that isn't self-evident from the code itself.

## Testing

Tests use Vitest + jsdom + React Testing Library. Test files live alongside the code they test in `__tests__/` subdirectories.
