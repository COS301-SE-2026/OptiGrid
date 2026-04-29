FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY backend/core/package.json ./backend/core/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --no-frozen-lockfile

COPY backend/core ./backend/core

RUN pnpm --filter @optigrid/core build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY backend/core/package.json ./backend/core/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --prod --no-frozen-lockfile

COPY --from=builder /app/backend/core ./backend/core

EXPOSE 4000

CMD ["pnpm", "--filter", "@optigrid/core", "start"]
