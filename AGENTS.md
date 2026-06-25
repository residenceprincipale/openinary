# Openinary — Agent Context

## Project
Openinary is a Cloudinary-compatible, self-hosted media transformation server. Monorepo with pnpm workspaces, managed by Turbo.

## Stack
- **API**: Hono + @hono/node-server (port 3000)
- **Dashboard**: Next.js 15 App Router (port 3001)
- **Database**: SQLite via better-sqlite3 (shared `auth.db`)
- **Auth**: Better Auth (session cookies for web, API keys for programmatic)
- **Image processing**: Sharp + @webtoon/psd
- **Video processing**: fluent-ffmpeg (async job queue with SQLite backing)
- **Cloud storage**: S3-compatible (R2/Minio/S3) with local FS fallback
- **UI**: shadcn/ui (New York), Tailwind v4, Radix primitives, lucide-react icons
- **State**: TanStack Query (server), React state (local), nuqs (URL query params)
- **Typescript** throughout

## Structure
```
apps/
  api/     # Hono media server
  web/     # Next.js dashboard
packages/
  shared/  # Auth config, DB instance, shared types
docker/    # Dockerfiles, nginx.conf, supervisord.conf
docs/      # Mintlify documentation site (38 MDX files)
scripts/   # init-env.js, secure-db.js, release.sh
```

## Key Architecture Decisions
- **URL-based transformations**: Cloudinary-like syntax — `/t/c_fill,w_300,h_200/folder/image.jpg` or `/authenticated/s--sig--/transformations/path` with HMAC-SHA256
- **Two-tier caching**: in-memory `StorageCache` (existence checks, 1min TTL) + filesystem cache (transformed results) + optional cloud cache
- **Video queue**: SQLite-backed job queue with EventEmitter worker; concurrency auto-detected (1 per 2GB RAM)
- **Auth**: Dual auth middleware — Bearer token (API key via Better Auth plugin) OR session cookie; shared config in `packages/shared/src/auth.ts`
- **API key CRUD**: Better Auth API plugin, managed in dashboard or via `/api-keys` endpoints
- **Cache invalidation**: `DELETE /invalidate/*` clears all cached transformation variants for a path (local FS + optional cloud)
- **SSE**: `/queue/events` polls `video_jobs` table every 2s, streams JSON updates

## Critical Conventions
- **Routes** in `apps/api/src/routes/` — each file exports route definitions, mounted in `index.ts`
- **All API responses** return `{ success: boolean, data?: any, error?: string }`
- **Auth**: public routes unconditionally allowed; protected routes require `c.get('userId')` set by auth middleware
- **Storage paths**: forward-slash separated, relative to storage root; no leading slash
- **Transform params**: `c_fill,w_300,h_200,f_auto,q_80` syntax, chainable with `/`
- **DB tables**: `user`, `session`, `account`, `verification`, `apiKey`, `video_jobs` — created in `init-db.ts`
- **CSS**: Tailwind v4 utility classes + CSS variables for theming (dark/light via `next-themes`)
- **Components**: shadcn/ui pattern — each component is a standalone file in `src/components/ui/`
- **Dashboard pages** use `nuqs` for URL-driven state (e.g., `useQueryState('asset', parseAsString)` for selected asset)
- **API routes in web** are Next.js Route Handlers (`app/api/**/route.ts`), used only for auth proxy and meta endpoints
- **No test files** exist in the repo

## Important Files

### API — Core
| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | Hono app bootstrap, CORS, rate limiting, mounts all routes |
| `apps/api/src/server.ts` | Server entry: creates dirs, inits storage/video queue, starts HTTP |
| `apps/api/src/middleware/auth.ts` | Dual auth middleware (API key + session cookie) |
| `apps/api/src/services/transform.service.ts` | TransformService: cache→source→process→cache→respond pipeline |

### API — Routes
| File | Purpose |
|------|---------|
| `routes/transform.ts` | `GET /t/*` public image/video transformation |
| `routes/authenticated.ts` | `GET /authenticated/s--{sig}/...` HMAC-signed transformation |
| `routes/upload.ts` | `POST /upload` multipart upload with dedup, prewarm, video queue |
| `routes/storage.ts` | `GET /storage/tree`, `PUT /storage/move`, `DELETE /storage/*`, `POST /storage/folders` |
| `routes/download.ts` | `GET /download/*` direct original file |
| `routes/invalidate.ts` | `DELETE /invalidate/*` clear cached variants |
| `routes/queue.ts` | `GET /queue/stats`, `/queue/jobs`, retry/cancel/delete jobs |

### API — Utils
| File | Purpose |
|------|---------|
| `utils/parser.ts` | Parse `c_fill,w_300` URL params → `TransformParams` |
| `utils/cache.ts` | SmartCache with LRU eviction, access tracking |
| `utils/signature.ts` | HMAC-SHA256 sign/verify + path traversal sanitization |
| `utils/asset-deletion.ts` | `deleteAssetCompletely()` — original + all cached + video jobs |
| `utils/storage/factory.ts` | `createStorageClient()` — returns CloudStorage or null |
| `utils/video/video-worker.ts` | VideoWorker EventEmitter: polls DB, processes with concurrency |
| `utils/video/queue-db.ts` | SQLite job queue: create, poll, update, retry, cancel, cleanup |
| `utils/image/index.ts` | `transformImage()` — PSD decode + Sharp pipeline |
| `utils/video/index.ts` | `transformVideo()` — ffmpeg command builder + execution |

### Dashboard — Core
| File | Purpose |
|------|---------|
| `src/middleware.ts` | Edge middleware: route protection, session validation |
| `src/app/(dashboard)/page.tsx` | Main dashboard: sidebar + header + media-grid + details sidebar |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout: SidebarProvider + ChatbotButton |
| `src/components/media-grid.tsx` | File/folder grid with selection, batch ops, context menu, drag-drop |
| `src/components/app-sidebar.tsx` | Nav sidebar: logo, storage tree, folder mgmt, profile menu |
| `src/components/headerbar.tsx` | Top bar: breadcrumbs, folder mgmt, upload button |
| `src/components/rename-dialog.tsx` | Single file rename dialog |
| `src/components/move-dialog.tsx` | File/folder move dialog (supports batch) |
| `src/components/batch-rename-dialog.tsx` | Pattern-based batch rename |
| `src/components/media-details-sidebar.tsx` | Asset details panel |

### Dashboard — Hooks
| File | Purpose |
|------|---------|
| `hooks/use-storage-tree.ts` | Fetch storage tree → TreeDataItem[] |
| `hooks/use-queue-events.ts` | SSE to /queue/events → live job statuses |
| `hooks/use-video-status.ts` | Poll video-status endpoint |
| `hooks/use-mobile.ts` | Mobile detection for responsive sidebar |

### Shared
| File | Purpose |
|------|---------|
| `packages/shared/src/auth.ts` | Better Auth server instance + DB adapter |
| `packages/shared/src/auth-client.ts` | Auth client factory with API key plugin |
| `packages/shared/src/types.ts` | Core types: TransformParams, VideoTransformParams, etc. |

## Common Workflows

### Adding a new API endpoint
1. Create `apps/api/src/routes/<name>.ts` with Hono route definitions
2. Mount in `apps/api/src/index.ts`
3. If it needs auth middleware, use the existing dual auth from `middleware/auth.ts`
4. Add docs in `docs/api-reference/`

### Adding a new dashboard page
1. Create `apps/web/src/app/(dashboard)/<name>/page.tsx`
2. Add nav link in `app-sidebar.tsx` if needed
3. Use TanStack Query for data fetching, nuqs for URL state

### Adding a new UI component
1. Create in `apps/web/src/components/`
2. Follow existing patterns — shadcn/ui style, Tailwind v4 classes, lucide icons
3. If it's a low-level primitive, add to `src/components/ui/`

### Working with transformations
- Parse params: `parser.ts` takes the URL path segment after `/t/` or after the signature
- Process image: `transformImage()` in `utils/image/index.ts` — Sharp pipeline
- Process video: `transformVideo()` in `utils/video/index.ts` — ffmpeg pipeline
- Add new image param: extend `IMAGE_PARAMS` registry in `utils/image/param-registry.ts`
- Add new video param: extend `VIDEO_PARAMS` registry in `utils/video/param-registry.ts`
- TransformParams type is in `packages/shared/src/types.ts` — keep in sync with registries

### Working with auth
- Session auth: Better Auth sets cookies, validated by middleware → `c.get('userId')`
- API key auth: `Bearer <api-key>` header, validated via `auth.api.getApiKey()`
- Rate limiting: public endpoints only, in-memory IP-based, configured via env vars
- Audit logging: middleware logs `api_key.success` / `api_key.failure` for key auth

### Working with storage
- Local files: stored under `UPLOAD_DIR` (default: `./public`), organized in subdirectories
- Cloud storage: configured via env vars (S3-compatible), `factory.ts` returns null if not configured
- Storage tree: `GET /storage/tree` returns recursive folder/file structure for sidebar
- Move/rename: `PUT /storage/move` with `{ from: string, to: string }`
- Delete: `DELETE /storage/*path` — deletes original + cached variants + video jobs
- Unique filenames: `get-unique-file-path.ts` appends `(1)`, `(2)` suffixes on collision

### Working with video queue
- Upload with video file → `POST /upload` → creates `video_jobs` row → worker picks it up
- Monitor via `GET /queue/stats` or SSE `/queue/events`
- Retry: `POST /queue/jobs/:id/retry`
- Cancel: `POST /queue/jobs/:id/cancel`
- Cleanup: `cleanupOldJobs()` runs every 10min, deletes jobs older than 14 days
- Thumbnails: `GET /video-status/*path` checks completion, then use transform with `f_webp` or `f_jpeg`

### Building and running
- `pnpm dev` — runs both API (3000) and web (3001) concurrently with turbo
- `pnpm build` — builds all packages and apps
- `pnpm type-check` — runs TypeScript checks across all workspaces
- Docker: `docker compose --profile full up` for full stack with nginx

## Env Vars (key ones)
- `API_SECRET` — HMAC signing key for authenticated URLs
- `CORS_ORIGIN` — allowed origins for CORS
- `UPLOAD_DIR` — local storage path (default `./public`)
- `MAX_FILE_SIZE_MB` — upload limit (default 50)
- `PUBLIC_RATE_LIMIT_MAX` — rate limit per window (default 100)
- `VIDEO_MAX_CONCURRENT` — parallel video jobs (auto: 1 per 2GB RAM)
- `DB_PATH` — SQLite database path (default `./data/auth.db`)
- S3 vars: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
