!# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev                   # Start Next.js dev server
npm run build                 # Production build
npm run lint                  # ESLint
npm run test                  # Minimal regression tests (Node native test runner)

# Database (Prisma)
npm run db:generate           # Regenerate Prisma client after schema changes
npm run db:migrate            # Create + apply new migration in dev
npm run db:deploy             # Apply committed migrations (production)
npm run db:push               # Push schema directly without migration (dev only)
npm run db:studio             # Open Prisma Studio

# Verification and admin
npm run verify:integrations   # Check OpenAI, Sentry, PostHog, Puppeteer configs
npm run commerce:grant        # Grant paid credits to a user
```

Path alias: `@/*` maps to `src/*`.

## Architecture Overview

Full-stack Next.js (App Router) application. TypeScript strict mode throughout.

**Tech stack:** React 19 + Next.js 16 + Tailwind CSS 4 + PostgreSQL + Prisma 7 (PrismaPg adapter) + NextAuth 4 + OpenAI-compatible API + Puppeteer (PDF) + Sentry + PostHog.

### Layer structure

```
src/
  app/            # Next.js App Router — pages and API route handlers
  ai/             # AI orchestration (orchestrators, prompts, schemas, parsers)
  services/       # Business logic — one file per domain
  features/       # Feature-specific React components (by domain)
  components/     # Shared UI components
  lib/            # Utilities: db, auth, env, http helpers, monitoring
  types/          # TypeScript interfaces
```

### Route groups in `src/app/`

- `(auth)/` — login, register, password reset
- `(marketing)/` — public pages
- `(workspace)/` — all protected user-facing pages

API routes live in `src/app/api/` as Next.js Route Handlers.

### AI layer (`src/ai/`)

AI work follows a strict pattern:
1. **Prompts** (`prompts/`) — versioned, centralized system/user prompts
2. **Schemas** (`schemas/`) — Zod schemas defining expected structured output
3. **Parsers** (`parsers/`) — extract JSON from LLM responses
4. **Orchestrators** (`orchestrators/`) — chain AI calls and business logic for each feature (resume generation, JD parsing, optimization, diagnosis, profile normalization)

`src/services/ai-service.ts` is the single entry point for all LLM calls — it handles model selection (trial vs. paid tier), custom base URLs, and provides the fallback mechanism.

### Data model highlights

- `ResumeVersion` — core entity. Types: `MASTER | JOB_TARGETED | MANUAL | AI_REWRITE`. Status: `DRAFT | READY | ARCHIVED`. Stores content as both Markdown and structured JSON. Tracks `sourceVersionId` for lineage.
- `UserCommerceProfile` — tracks access tier (`TRIAL | PAID`) and per-feature credits.
- `AuditLog` — records all significant user actions for compliance.
- `Export` — tracks PDF/Markdown export jobs with status (`PENDING | SUCCESS | FAILED`).

### Key conventions

**API routes:** Validate with Zod schemas from `src/lib/validations/`, then call services. Use `apiOk()` / `apiError()` from `src/lib/http.ts` for all responses. All responses include `x-request-id`.

**Services:** Business logic only — no HTTP concepts. Custom error classes (e.g., `ResumeServiceError`). Services call orchestrators for AI operations.

**Auth:** `getAuthSession()` for server-side session retrieval. All workspace routes and API routes that modify data require an authenticated session.

**Environment:** `src/lib/env.ts` exports a validated environment object — use it instead of `process.env` directly. Run `npm run verify:integrations` after changing integration config.

## Environment Setup

Copy `.env.example` to `.env.local`. Minimum required for local development:

```
DATABASE_URL          # PostgreSQL connection string
AUTH_SECRET           # Random string for NextAuth
NEXT_PUBLIC_APP_URL   # e.g. http://localhost:3000
OPENAI_API_KEY        # OpenAI-compatible API key
OPENAI_BASE_URL       # API endpoint (default: https://api.openai.com/v1)
OPENAI_MODEL          # Model ID to use
```

PDF export requires `PUPPETEER_EXECUTABLE_PATH` pointing to a Chrome/Edge binary.

Export storage defaults to local disk in dev (`EXPORT_STORAGE_DRIVER=local`); use `s3` or `r2` in production.

## Key Documentation

Extended documentation lives in `Documentation/`:
- `TechDesign.md` — architectural decisions and rationale
- `AGENTS.md` — AI implementation guidelines and scope rules (read before modifying AI layer)
- `PRD.md` — product requirements and acceptance criteria
- `DEPLOYMENT.md` + `DEPLOYMENT_CHECKLIST.md` — production deployment guide
