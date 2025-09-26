# Suggested Commands

- Install deps: `pnpm i` (root) or `pnpm --filter frontend i`
- Dev server: `pnpm --filter frontend dev`
- Typecheck: `pnpm --filter frontend typecheck`
- Lint: `pnpm --filter frontend lint`
- Unit tests: `pnpm --filter frontend test`
- Build: `pnpm --filter frontend build`

# Environment
- Browser: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server: set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

# Task Master
- View tasks: `task-master get-tasks`
- Set status: `task-master set-status --id=<id> --status=<in-progress|done>`

# Git/Vercel
- Commit (Conventional Commits): e.g. `feat: tenant membership APIs`
- Push: `git push origin main` (triggers CI + Vercel)
