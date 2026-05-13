FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY backend/configuration/package.json ./backend/configuration/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY backend/configuration ./backend/configuration

RUN pnpm --filter @optigrid/configuration build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY backend/configuration/package.json ./backend/configuration/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

COPY --from=builder /app/backend/configuration ./backend/configuration

EXPOSE 4000

CMD ["pnpm", "--filter", "@optigrid/configuration", "start"]
