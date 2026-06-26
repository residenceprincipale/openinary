# Openinary — Agent Context

## Project
Cloudinary-compatible, self-hosted media transformation server. Monorepo with pnpm workspaces, managed by Turbo.

## Stack
- **API**: Hono + @hono/node-server (port 3000)
- **Dashboard**: Next.js 15 App Router (port 3001)
- **Database**: SQLite via better-sqlite3 (shared `auth.db`)
- **Auth**: Better Auth (session cookies for web, API keys for programmatic)
- **Image**: Sharp + @webtoon/psd + heic-convert
- **Video**: fluent-ffmpeg (async SQLite-backed job queue, auto-concurrency 1 per 2GB RAM)
- **Audio**: ffmpeg (synchronous, no queue)
- **Storage**: S3-compatible (R2/Minio/S3) with local FS fallback
- **UI**: shadcn/ui (New York), Tailwind v4, Radix primitives, lucide-react
- **State**: TanStack Query, nuqs (URL query params)
- **Logging**: pino + pino-pretty (dev)

## Structure
```
apps/api/         # Hono media server (entry: src/server.ts)
apps/web/         # Next.js 15 dashboard (App Router, standalone output for Docker)
packages/shared/  # Auth config, DB instance, shared types (export map: shared, shared/types, shared/auth, shared/auth-client)
docker/           # Dockerfiles, nginx.conf, supervisord.conf
docs/             # Mintlify documentation
scripts/          # init-env.js, secure-db.js, release.sh
```

## Commands
| Command | What it does |
|---------|-------------|
| `pnpm dev` | Runs API (3000) + web (3001) concurrently via turbo |
| `pnpm dev:api` | API only — `tsx watch src/server.ts` |
| `pnpm dev:web` | Web only — `next dev --turbopack --port 3001` |
| `pnpm build` | Builds all packages + apps |
| `pnpm type-check` | TypeScript checks across all workspaces |
| `pnpm lint` | ESLint across all workspaces |
| `pnpm clean` | Clean dist/.next for both apps |
| `docker compose --profile full up` | Full stack with nginx |
| `docker compose --profile api up` | API-only container |

**Order for changes**: `lint` → `type-check` (no test files exist in repo).

## Key Architecture
- **URL transforms**: `/t/c_fill,w_300,h_200/folder/image.jpg` or `/authenticated/s--sig--/transformations/path` (HMAC-SHA256, 16-char sig)
- **Caching**: in-memory `StorageCache` (1min TTL for existence checks) + filesystem cache (transformed results) + optional cloud cache
- **Auth middleware** (`middleware/auth.ts`): dual — Bearer API key OR session cookie. Sets `c.get('user')` (object `{id, email, name, role}`) and `c.get('apiKey')` on context
- **All API responses**: `{ success: boolean, data?: any, error?: string }`
- **Video transform**: returns original immediately + `X-Video-Status: processing`; background worker processes and caches; subsequent requests serve cached result
- **Audio transform**: synchronous (ffmpeg, no job queue)
- **Storage env vars**: `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET_NAME`, `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_URL`

## API Routes
| Route | Auth | Purpose |
|-------|------|---------|
| `GET /t/*` | Public | Image/video/audio transformation |
| `GET /authenticated/s--{sig}/*` | Public (sig) | HMAC-signed transformation |
| `GET /download/*` | Public | Direct original file |
| `GET /health` | Public | Health check |
| `GET /video-status/*` | Public | Check video processing status |
| `GET /queue/events` | Public | SSE — polls `video_jobs` every 2s |
| `POST /upload` | API key | Multipart upload with dedup |
| `GET /storage/tree` | API key | Recursive folder/file tree |
| `PUT /storage/move` | API key | Move/rename files |
| `DELETE /storage/*` | API key | Delete original + cached + video jobs |
| `POST /storage/folders` | API key | Create folder |
| `DELETE /invalidate/*` | API key | Clear cached variants |
| `GET/DELETE /cache/*` | API key | Cache management |
| `GET /queue/stats` | API key | Queue statistics |
| `POST /queue/jobs/:id/retry\|cancel` | API key | Job management |
| `DELETE /queue/jobs/:id` | API key | Delete job |
| `GET /users` | API key + admin | List/manage users |
| `GET /api-keys` | (no middleware) | API key CRUD via Better Auth |
| `GET /config` | API key | Server configuration |

## Dashboard Conventions
- **Edge middleware** (`src/middleware.ts`): validates session cookie format, redirects unauthenticated to `/login`
- **Public paths**: `/login`, `/setup`, `/api/auth/*`, `/api/check-setup`, `/api/version`
- **API routes in web** are Next.js Route Handlers (`app/api/{auth,check-setup,version}/route.ts`), used only as auth proxy + meta endpoints
- **Pages** use `nuqs` for URL-driven state (e.g., `useQueryState('asset', parseAsString)`)
- **Components**: shadcn/ui pattern — standalone files in `src/components/ui/`
- **CSS**: Tailwind v4 utility classes + CSS variables (dark/light via `next-themes`)

## Key Conventions
- **Transform params**: `c_fill,w_300,h_200,f_auto,q_80` — add new params to `IMAGE_PARAMS` in `utils/image/param-registry.ts` and `VIDEO_PARAMS` in `utils/video/param-registry.ts`
- **TransformParams type** in `packages/shared/src/types.ts` — keep in sync with registries
- **DB tables**: `user`, `session`, `account`, `verification`, `apiKey`, `video_jobs` — auto-created in `packages/shared/src/auth.ts:initializeTables()`
- **Video jobs cleanup**: `cleanupOldJobs()` runs every 10min (default: delete after 24h, configured via `VIDEO_JOB_CLEANUP_HOURS`)
- **No test files** exist — no test runner configured

## Env Vars (key ones)
- `BETTER_AUTH_SECRET` — required in production (`openssl rand -hex 32`)
- `BETTER_AUTH_URL` — public-facing URL for auth redirects/CORS
- `API_SECRET` — HMAC signing key for authenticated URLs (min 16 chars)
- `UPLOAD_DIR` — local storage path (default `./public`)
- `MAX_FILE_SIZE_MB` — upload limit (default 50)
- `CORS_ORIGIN` — allowed origin for CORS
- `DB_PATH` — SQLite path (default `./data/auth.db`)
- `MODE` — `fullstack` (default) or `api` (standalone, auto-generates API key)

## Docker Notes
- **CI pushes to**: `openinary/openinary` and `openinary/openinary-api` (Docker Hub)
- **Local build script** (`docker:push`) pushes to: `residenceprincipale/openinary` — only works for that org
- **Full image** runs nginx + API + web (supervisord). **API image** runs standalone.
- **Build-time args**: `NEXT_PUBLIC_API_BASE_URL`, `IMAGE_TAG`
- Next.js config (`next.config.ts`): `output: "standalone"`, ignores ESLint/TS errors during Docker build
