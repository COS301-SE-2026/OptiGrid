FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY frontend/package.json ./frontend/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY frontend ./frontend

RUN pnpm --filter @optigrid/frontend build

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY frontend/package.json ./frontend/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

COPY --from=builder /app/frontend ./frontend

EXPOSE 3000
USER node

CMD ["pnpm", "--filter", "@optigrid/frontend", "start"]
