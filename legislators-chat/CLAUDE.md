# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Legislators Chat is an AI-powered chat interface for researching US legislators, congressional hearings, voting records, and related documents. It helps citizens identify and contact legislators on issues they care about.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Maple AI (privacy-first, E2E encrypted LLM)
- **UI**: React 19 + shadcn/ui
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Language**: TypeScript
- **Linting**: ESLint + Prettier

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run format:check # Check formatting without writing
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   └── ui/           # shadcn/ui components
└── lib/              # Utility functions
```

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

## Key Documentation

- `docs/ARCHITECTURE.md` - System design and data flow
- `docs/ROADMAP.md` - Feature roadmap and implementation tasks
- `docs/STYLES.md` - UI/UX guidelines and design system

## Design Decisions

- Dark mode is the default theme (Slate color palette)
- Uses CSS variables for theming via shadcn/ui
- Mobile-first responsive design
- Animations should be subtle and respect prefers-reduced-motion

## API Integration

The frontend expects a backend API at `NEXT_PUBLIC_API_URL` that handles:
- Chat conversations with AI
- Legislator lookups
- Document/hearing/vote searches
- Report generation

Response schema is documented in `docs/ARCHITECTURE.md`.

## Maple AI Integration

This project uses [Maple AI](https://trymaple.ai/) for LLM operations:
- Privacy-first with end-to-end encryption
- Runs in Trusted Execution Environments (TEEs)
- OpenAI-compatible API via Maple Proxy
- Streaming-only responses (`/v1/chat/completions`)

Backend connects to Maple Proxy at `MAPLE_PROXY_URL` with bearer token auth.
Available models: `llama-3.3-70b`, `gpt-oss-120b`, `deepseek-r1-0528`, `qwen3-coder-480b`
