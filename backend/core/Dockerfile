FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY backend/core/package.json ./backend/core/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY backend/core ./backend/core

RUN pnpm --filter @optigrid/core build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/core ./backend/core

EXPOSE 4000

CMD ["node", "backend/core/dist/src/server.js"]
