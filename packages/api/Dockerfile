# ─── Build stage ─────────────────────────────────────────────────────────────
# Debian slim (not alpine): Prisma's engines need OpenSSL/libssl, which alpine
# lacks by default and causes "failed to detect libssl" engine load errors.
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@8

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile --filter @expouz/api --filter @expouz/shared

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Generate Prisma client and build
WORKDIR /app/packages/api
RUN npx prisma generate
RUN pnpm run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@8

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile --prod --filter @expouz/api --filter @expouz/shared

COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

WORKDIR /app/packages/api

# Generate the Prisma client in the runner. With pnpm the client lives in the
# symlinked .pnpm store (not a flat node_modules/.prisma), so it can't be copied
# from the builder by path — regenerate it against the prod install instead.
RUN npx prisma generate

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

EXPOSE 3001
