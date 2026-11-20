# Openinary — Agent Context

## Project
Cloudinary-compatible, self-hosted media transformation server. Monorepo with
pnpm workspaces, managed by Turbo.

## Stack
- **API**: Hono on Node (`apps/api`, port 3000)
- **Engine**: `@openinary/core` — URL grammar, transform pipeline, storage,
  video job queue, delivery routes
- **Dashboard**: Next.js App Router (`apps/web`, port 3001), built from
  `@openinary/dashboard` (shell, pages) and `@openinary/ui` (media browser,
  details sidebar, settings widgets)
- **Cloud**: `apps/cloud/*` (server, web, admin) on Cloudflare Workers/Neon
- **Database**: SQLite via better-sqlite3 (`packages/shared/src/db.ts`)
- **Auth**: Better Auth (session cookies + API keys), roles `admin` / `user`
- **Media**: sharp for images, fluent-ffmpeg for video, S3-compatible storage
  with local filesystem fallback
- **UI**: Base UI / Radix, Tailwind v4, lucide-react, TanStack Query

## Structure
```
apps/api/           Hono media server (self-hosted)
apps/web/           Next.js dashboard (self-hosted)
apps/cloud/         Cloud server, web dashboard and admin
apps/docs/          Astro documentation
packages/core/      Engine: URL parsing, transforms, storage, routes, queue
packages/dashboard/ Shared dashboard shell and pages
packages/ui/        Shared media browser, details sidebar, settings widgets
packages/shared/    Auth config, DB, telemetry schema
packages/cli/       create-openinary CLI
docker/             Dockerfiles, nginx, supervisord
scripts/            init-env, secure-db, release helpers
```

## Commands
| Command | What it does |
|---------|-------------|
| `pnpm dev` | API + web (turbo) |
| `pnpm dev:api` / `pnpm dev:web` | One side only |
| `pnpm type-check` | Build + TypeScript across workspaces |
| `pnpm test` | Node test runner via turbo |
| `pnpm check` | Biome (only `apps/cloud/**` is configured) |
| `pnpm db:push` / `db:studio` | Cloud Drizzle database |

Type-check and tests both depend on `^build`; run them before pushing.

## URL and engine
- Delivery: `/t/<transform>/<path>` (e.g. `/t/c_fill,w_300,q_80/photo.jpg`)
- Signed delivery: `/authenticated/s--<sig>--/<transform>/<path>`
- Raw original: `/download/<path>` (Range-capable)
- Transforms are parsed in `packages/core/src/url/grammar.ts`; add a key to
  `TRANSFORM_VALUE_PATTERNS`, the `TransformKey` union and `parseTransform`,
  then to `packages/core/src/types.ts`.
- Image pipeline: `packages/core/src/utils/image/*`; video pipeline:
  `packages/core/src/utils/video/*` (thumbnail → trim → downscale → resize →
  overlay → quality → volume).
- Video transcodes run in the SQLite-backed job queue. A request returns 202
  with an ETA; `/video-status/<transform>/<path>` reports progress.
- Audio and 3D files are stored and delivered as originals, not transcoded.

## Self-hosted API routes
| Route | Auth | Purpose |
|-------|------|---------|
| `GET /t/*` | public | Transform / thumbnail / deliver |
| `GET /download/*`, `/download-folder/*`, `/download-zip` | public/key | Originals |
| `GET /video-status/*`, `/queue/events` | public | Job status and SSE |
| `POST /upload`, `/upload/sign`, `/upload/createfolder` | key/signature | Uploads |
| `GET /storage?path=` | key | One directory level |
| `PATCH/DELETE /storage/*`, `POST /storage/*/move|copy` | key | Mutations |
| `GET/POST/DELETE /storage/permissions` | key | Folder sharing |
| `PUT /storage/replace/*` | key | Replace a file in place |
| `GET /queue/stats`, `/queue/jobs`, `/queue/worker/stats` | key | Queue |
| `GET/DELETE /cache/*` | key | Local and cloud cache |
| `GET/PUT /config/transforms`, `GET /config/server` | key | Runtime defaults |
| `GET/POST/PATCH/DELETE /users` | key + admin | User management |
| `GET /api-keys`, `/activity`, `/onboarding` | key | Dashboard support |

## Database
Tables are created/migrated in `packages/shared/src/db.ts`: `user` (with
`role`), `session`, `account`, `verification`, `apiKey`, `folder_permissions`,
`video_jobs`, `app_state`, `delivery_log`, `delivery_counts`. The first account
created becomes `admin`; later accounts default to `user`.

## Dashboard conventions
- `packages/ui` owns the media grid, details sidebar, queue widgets and
  reusable dialogs; `apps/web` only wires routes, session and API base URLs.
- Settings pages live in `apps/web/src/components/settings/settings-pages.tsx`
  and render through `SettingsPage` from `@openinary/dashboard`.
- Client components use `useOpeninary()` for `apiBaseUrl` / `transformBaseUrl`
  and the authenticated `fetch`, never `process.env` at render time.
- Folder access: the API passes a `StorageAccess` hook to the core storage
  route; admins see everything, other users see granted folders (and their
  ancestors) only.

## Environment
`BETTER_AUTH_SECRET` (required in production), `BETTER_AUTH_URL`, `API_SECRET`
(signed URLs), `DB_PATH`, `MODE` (`fullstack` or `api`), `MAX_FILE_SIZE_MB`,
`STORAGE_LIMIT_MB` (0 = unlimited), `STORAGE_*` for S3, `CORS_ORIGIN`.
Runtime transform defaults are saved by the Transforms page to
`data/transforms.json` (next to `DB_PATH`).
