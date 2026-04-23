# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS pnpm-base

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable

WORKDIR /workspace

FROM pnpm-base AS workspace-manifests

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json

FROM workspace-manifests AS workspace-install

RUN pnpm install --frozen-lockfile

FROM workspace-install AS workspace-source

COPY . .

FROM workspace-source AS server-builder

RUN pnpm --filter @runa/types build \
	&& pnpm --filter @runa/utils build \
	&& pnpm --filter @runa/db build \
	&& pnpm --filter @runa/server build

FROM workspace-manifests AS server-production-deps

RUN pnpm install --frozen-lockfile --prod

FROM node:22-bookworm-slim AS server-runtime

ENV NODE_ENV=production

WORKDIR /workspace

COPY --from=server-production-deps /workspace/node_modules ./node_modules
COPY --from=server-builder /workspace/package.json ./package.json
COPY --from=server-production-deps /workspace/apps/server/node_modules ./apps/server/node_modules
COPY --from=server-builder /workspace/apps/server/package.json ./apps/server/package.json
COPY --from=server-builder /workspace/apps/server/dist ./apps/server/dist
COPY --from=server-production-deps /workspace/packages/db/node_modules ./packages/db/node_modules
COPY --from=server-builder /workspace/packages/db/package.json ./packages/db/package.json
COPY --from=server-builder /workspace/packages/db/dist ./packages/db/dist
COPY --from=server-builder /workspace/packages/types/package.json ./packages/types/package.json
COPY --from=server-builder /workspace/packages/types/dist ./packages/types/dist
COPY --from=server-builder /workspace/packages/utils/package.json ./packages/utils/package.json
COPY --from=server-builder /workspace/packages/utils/dist ./packages/utils/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "-e", "const port = Number(process.env.PORT ?? 3000); fetch(`http://127.0.0.1:${port}/health`).then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "-e", "const port = Number(process.env.PORT ?? 3000); import('./apps/server/dist/index.js').then(({ startServer }) => startServer({ host: '0.0.0.0', port })).catch((error) => { console.error(error); process.exit(1); });"]
