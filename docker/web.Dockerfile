# Web-only image: the Next.js standalone dashboard, no API, no nginx.
# Compose runs it beside the API image and a small nginx proxy.

FROM node:22.23.4-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS web-builder
ARG NEXT_PUBLIC_API_BASE_URL="/api"
ARG IMAGE_TAG="latest"
RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY patches/ ./patches/

COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY apps/web/ ./apps/web/
COPY apps/api/package.json ./apps/api/
# --frozen-lockfile compares the lockfile against every workspace project, so
# the apps this stage never builds still need their manifest present.
COPY apps/marketing/package.json ./apps/marketing/
COPY apps/docs/package.json ./apps/docs/
COPY apps/telemetry/package.json ./apps/telemetry/
COPY apps/cloud/server/package.json ./apps/cloud/server/
COPY apps/cloud/web/package.json ./apps/cloud/web/
COPY apps/cloud/admin/package.json ./apps/cloud/admin/

RUN pnpm install --filter web... --frozen-lockfile --prod=false
RUN pnpm --filter "web^..." build

ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN mkdir -p /app/apps/web/public && cp /app/apps/web/src/app/favicon.ico /app/apps/web/public/favicon.ico
RUN pnpm --filter web build

FROM node:22.23.4-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libjemalloc2 && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf "$(dpkg -L libjemalloc2 | grep 'libjemalloc\.so\.2$')" /usr/lib/libjemalloc.so.2

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV DB_PATH=/app/data/auth.db
ENV MALLOC_ARENA_MAX=2
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

WORKDIR /app
COPY --from=web-builder /app/apps/web/.next/standalone /app
COPY --from=web-builder /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=web-builder /app/apps/web/public /app/apps/web/public

RUN mkdir -p /app/data && chown -R node:node /app/data /app/apps/web
USER node
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
