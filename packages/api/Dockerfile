FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @ziggy/api --filter @ziggy/shared

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

# Build
RUN pnpm --filter @ziggy/shared build && pnpm --filter @ziggy/api build

# ─── Production stage ─────────────────────────────────────────────────
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN pnpm install --frozen-lockfile --prod --filter @ziggy/api --filter @ziggy/shared

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/api/dist packages/api/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
