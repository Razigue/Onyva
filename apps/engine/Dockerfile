# syntax=docker/dockerfile:1
# Engine service image, multi-architecture (linux/amd64, linux/arm64).
# Build context: repository root. The snapshot is never baked in: mount it read-only on /data/engine.
#   docker buildx build --platform linux/amd64,linux/arm64 -f apps/engine/Dockerfile -t onyva-engine .

# The bundle is plain JavaScript: build it once on the build machine, whatever the target architecture.
FROM --platform=$BUILDPLATFORM node:24.15.0-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/engine/package.json apps/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/fairness/package.json packages/fairness/
COPY packages/transit-engine/package.json packages/transit-engine/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @onyva/engine...
COPY packages/shared/src packages/shared/src
COPY packages/fairness/src packages/fairness/src
COPY packages/transit-engine/src packages/transit-engine/src
COPY apps/engine/src apps/engine/src
RUN pnpm --filter @onyva/engine build

FROM node:24.15.0-bookworm-slim
ENV NODE_ENV=production ENGINE_HOST=0.0.0.0 ENGINE_PORT=8787 ENGINE_SNAPSHOT=/data/engine
WORKDIR /app
COPY --from=build /repo/apps/engine/dist/ ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s CMD ["node", "-e", "fetch('http://127.0.0.1:8787/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "main.mjs"]
