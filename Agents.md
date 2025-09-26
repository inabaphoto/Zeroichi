# Repository Guidelines

## Project Structure & Module Organization
- `src/` – application code (create per feature/module). 
- `tests/` – unit/integration tests mirroring `src/` paths.
- `docs/` – product and technical docs; PRD lives in `docs/prd.md`.
- `scripts/` – developer tooling (format, lint, CI helpers).
- `assets/` – static files (images, fixtures, sample data).

Keep modules small and cohesive. Prefer `feature_name/` folders with `index` (entry), `types`/`model`, and `utils` where relevant.

## Build, Test, and Development Commands
No toolchain is committed yet. When adding one, provide `make` wrappers:
- `make setup` – install dependencies and pre-commit hooks.
- `make build` – compile or package; output to `dist/` or `build/`.
- `make test` – run unit tests with coverage report.
- `make dev` – start local dev server or hot-reload loop.

Examples (pick what matches your stack):
- Node: `npm ci`, `npm run dev`, `npm test -- --watch`, `npm run build`.
- Python: `uv venv && uv pip install -r requirements.txt`, `pytest -q`, `ruff check`, `python -m build`.

Document the chosen commands in the README once added.

## Coding Style & Naming Conventions
- Indentation: 2 spaces (JS/TS), 4 spaces (Python). 
- Filenames: `kebab-case` for scripts/assets, `snake_case.py` (Python), `camelCase` identifiers, `PascalCase` types/classes.
- Formatting/Linting (recommended): Prettier + ESLint (JS/TS) or Ruff + Black (Python). Expose `format` and `lint` commands.

## Testing Guidelines
- Frameworks: Jest/Vitest (JS/TS) or Pytest (Python). Place tests in `tests/` mirroring `src/` structure.
- Names: `*_test.py` or `*.test.ts` next to or under `tests/`.
- Coverage: target 80%+ lines and branches. Include CI check.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Branches: `type/scope-short-desc` (e.g., `feat/auth-login`).
- PRs: clear description, linked issue, test evidence (logs/screenshots), and notes on migration/config changes.

## Security & Configuration Tips
- Never commit secrets; use `.env.local` and sample `.env.example`.
- Gate new endpoints/features behind feature flags when unsure.
- Minimal permissions for any API keys or service accounts.

## Agent-Specific Instructions
- Scope: This file applies to the repo root. Keep changes focused, avoid unrelated refactors, and update docs/tests for code you touch. Prefer small, reviewable PRs.
- Taskmasterとの同期: 作業開始時は `task-master set-status --id=<id> --status=in-progress`、完了時は `--status=done` を必ず実行し、タスク状態と実作業を一致させる。

## Git連動デプロイ（厳密なコミット紐付け）
- 原則: 本番デプロイは「コミット（mainへのpush）」を唯一のトリガーとする。
- 禁止: ローカル状態からの `vercel deploy --prebuilt --prod` 直デプロイ（コミット非同期）が発生しないようにする。
- フロー:
  1. 変更→`pnpm lint && pnpm typecheck && pnpm test` で合格
  2. Conventional Commits でコミット
  3. `git push origin main`
  4. GitHub Actions CI が走り、合格後に Vercel へ自動デプロイ
- Secrets 設定（GitHub > Settings > Secrets and variables > Actions）
  - `VERCEL_TOKEN`: VercelのPersonal Token
  - `VERCEL_ORG_ID`: Vercel の Organization ID
  - `VERCEL_PROJECT_ID`: Vercel の Project ID
- 参考: `.github/workflows/ci.yml` の `deploy` ジョブ、`vercel.json` のビルド設定

## Vercel / Monorepo 注意点
- 本リポジトリは `apps/frontend` をNextアプリのルートとする。
- `vercel.json` で `buildCommand: pnpm --filter frontend build` を指定し、成果物は `apps/frontend/.next` を参照。
- VercelのGit連携（推奨）がある場合は、mainへのpushでProduction、PRでPreviewが作成される。

