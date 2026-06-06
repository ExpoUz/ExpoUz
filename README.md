# ScoreWithUs

Sports matchmaking and booking platform for Uzbekistan — find opponents, book pitches, manage escrow payments.

## Architecture

| Service | Stack | Port |
|---|---|---|
| **API** | NestJS 10 + Prisma + PostgreSQL | 3001 |
| **Admin Panel** | Next.js 14 + TanStack Query | 3000 |
| **Mobile / Mini App** | Expo SDK 51 + expo-router | 8081 |
| **Database** | PostgreSQL 16 (PostGIS) | 5433 |
| **Queue / Cache** | Redis 7 | 6379 |

## Local Development

### Prerequisites
- Node.js 20+, pnpm 8+, Docker Desktop

### Start infrastructure
```sh
docker compose up -d
```

### Install dependencies
```sh
pnpm install
```

### Start API
```sh
pnpm --filter @playwithus/api run start:dev
```

### Start Admin Panel
```sh
pnpm --filter @playwithus/admin run dev
```

### Start Mobile (Expo)
```sh
pnpm --filter @playwithus/mobile run start
```

### Seed database
```sh
pnpm --filter @playwithus/api run prisma:seed
```

## Environment Variables

Copy `.env.production.example` to `.env.production` and fill in all secrets before deploying.

The admin panel reads `NEXT_PUBLIC_API_URL` from `apps/admin/.env.local` (defaults to `http://localhost:3001/v1`).

Test credentials: phone `+998900000000`, OTP `000000` (bypass), role `SUPER_ADMIN`.

## Deployment

```sh
cp .env.production.example .env.production
# Fill in all secrets in .env.production
bash scripts/deploy.sh
```

The deploy script will:
1. Build the Expo web bundle (Telegram Mini App)
2. Issue SSL certificates via Let's Encrypt
3. Build and start all Docker containers
4. Run database migrations

## Telegram Mini App

After deploying, configure your bot with [@BotFather](https://t.me/BotFather):
1. `/newapp` → set **Web App URL** to `https://app.scorewithus.uz`
2. Users open the Mini App inside Telegram and are auto-authenticated

## Admin Panel

Accessible at `https://admin.scorewithus.uz` (prod) or `http://localhost:3000` (dev).

Only users with role `ADMIN` or `SUPER_ADMIN` can log in. Super Admins have access to additional management pages for pitch owners, locations, and platform settings.
