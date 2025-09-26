# Project Overview

- Purpose: Zeroichi monorepo with Next.js 15 App Router frontend (apps/frontend) integrated with Supabase (Auth/DB) and Vercel deployments. Implements multi-tenant auth + membership management and Dify integrations later.
- Tech stack: TypeScript, Next.js 15 (App Router), Supabase JS v2, Vitest, ESLint/Prettier, pnpm workspace, Tailwind CSS.
- Structure: apps/frontend is the Next app root used by Vercel. Shared lib resides under apps/frontend/src/lib. API Route Handlers live in apps/frontend/src/app/api.
- Coding style: 2-space TS, camelCase names, PascalCase types/classes. Lint: ESLint, Format: Prettier. Keep modules small and cohesive.
- Testing: Vitest for unit tests; target 80%+ coverage longer term; tests live next to sources under src/ with .test.ts.
- Deployment: Git-only production deploy via CI to Vercel; preview deploys from PRs. vercel.json builds with pnpm --filter frontend build.
- Security: No secrets committed. Use NEXT_PUBLIC_SUPABASE_URL/ANON_KEY for browser and SUPABASE_URL/SERVICE_ROLE_KEY server-side.
