# ScoreWithUs (Fubles-Uz)

**ScoreWithUs** is a sports matchmaking and booking platform for Uzbekistan. It is a TypeScript monorepo built with [Turborepo](https://turbo.build/) and [pnpm workspaces](https://pnpm.io/workspaces), containing:

| Package | Description |
|---|---|
| `apps/mobile` | React Native (Expo) mobile app |
| `packages/api` | NestJS REST + WebSocket backend |
| `packages/shared` | Shared TypeScript types and utilities |

---

## Tech Stack

- **Runtime**: Node.js ≥ 20, pnpm ≥ 8
- **Backend**: NestJS, Prisma ORM, PostgreSQL (PostGIS), Redis, BullMQ
- **Mobile**: Expo (React Native), NativeWind, Zustand, TanStack Query
- **Tooling**: Turborepo, TypeScript, Prettier

---

## Prerequisites

Make sure the following tools are installed before you begin:

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | https://nodejs.org |
| pnpm | ≥ 8 | `npm install -g pnpm` |
| Docker & Docker Compose | latest | https://docs.docker.com/get-docker |
| Expo CLI *(mobile only)* | latest | `npm install -g expo-cli` |

---

## Local Deployment

### 1. Clone the repository

```bash
git clone https://github.com/Fubles-Uz/ScoreWithUs.git
cd ScoreWithUs
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example env file for the API and fill in the required values:

```bash
cp packages/api/.env.example packages/api/.env
```

Open `packages/api/.env` and set the values relevant to your local setup. The minimum required variables for a local run are:

```dotenv
DATABASE_URL=postgresql://dev:dev@localhost:5432/fublesuz
REDIS_URL=redis://localhost:6379
JWT_SECRET=any_long_random_string
JWT_REFRESH_SECRET=any_other_long_random_string
PORT=3000
NODE_ENV=development
```

All other variables (payment gateways, Cloudinary, Sentry, etc.) are optional for local development.

### 4. Start infrastructure services

Spin up PostgreSQL (with PostGIS) and Redis using Docker Compose:

```bash
docker compose up -d
```

Verify that both containers are healthy:

```bash
docker compose ps
```

### 5. Set up the database

Generate the Prisma client and run migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

Optionally seed the database with initial data:

```bash
pnpm db:seed
```

### 6. Build the shared package

The `@fubles-uz/shared` package must be compiled before other packages can use it:

```bash
pnpm run build
```

> Turborepo will build packages in the correct dependency order automatically.

### 7. Start the API (development mode)

```bash
cd packages/api
pnpm dev
```

The API will be available at `http://localhost:3000`.  
Swagger UI is available at `http://localhost:3000/api`.

### 8. Start the mobile app

In a new terminal:

```bash
cd apps/mobile
pnpm start
```

This opens the Expo dev server. Then:
- Press **`a`** to run on an Android emulator / device
- Press **`i`** to run on an iOS simulator (macOS only)
- Scan the QR code with the **Expo Go** app on your phone

---

## Running Everything at Once

From the monorepo root you can start all packages in parallel with Turborepo:

```bash
pnpm dev
```

---

## Useful Scripts

All scripts below can be run from the monorepo root:

| Command | Description |
|---|---|
| `pnpm dev` | Start all packages in watch/dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests for all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm format` | Format all files with Prettier |

---

## Stopping the Local Environment

```bash
docker compose down
```

To also remove persisted database and Redis data:

```bash
docker compose down -v
```
