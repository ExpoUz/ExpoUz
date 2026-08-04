# ExpoUz — Admin Operations Runbook

For the operator (you). The "when something goes wrong / how do I safely do X" document.
Everything here reflects the **actual** deployment and code.

**Stack at a glance**
- **API:** NestJS on Railway — `https://expouz-production.up.railway.app`, base path `/v1`.
  Services on Railway: API + Postgres + Redis. Deploys via `railway up` (Dockerfile builder;
  container CMD runs `prisma migrate deploy` on boot).
- **Web apps (Vercel, team "Lynae's projects", scope `lynae-s-projectsexpo`):**
  admin `https://admin-six-zeta-62.vercel.app`, pitch-portal `https://pitch-portal-peach.vercel.app`,
  tma `https://tma-seven-pearl.vercel.app`.
- **Telegram:** `@ExpoScoreBot` (opens the player TMA).
- **Local ports:** api 3001 (`/v1`), admin 3000, pitch-portal 3002, tma 3003.

---

## 1. Check system health
- **Health endpoint:** `GET https://expouz-production.up.railway.app/v1/health`
  Returns `{ status: "ok" | "degraded", ... }` — `ok` only when both Postgres and Redis are up.
  ```bash
  curl https://expouz-production.up.railway.app/v1/health
  ```
- **Railway logs:** open the Railway project → API service → Logs (or `railway logs`). Look for boot
  errors, migration output, and request errors.
- **Queue/Redis:** reminders and rate limiting use Redis. If `health` reports Redis down, check the
  Redis service in Railway.

## 2. Apply a database migration in production (safely)
Migrations live in `packages/api/prisma/migrations/`. In production they are applied automatically:
the Docker container runs `prisma migrate deploy` on boot.

Safe procedure:
1. Add/commit the migration locally (a new folder under `prisma/migrations/` with `migration.sql`).
2. **Back up first** (see §8) if the migration is destructive.
3. Deploy the API: from repo root, `railway up`. Watch the boot logs — `migrate deploy` runs and
   prints applied migrations. Confirm no errors.
4. Verify with the health endpoint and a smoke test (log in, load the dashboard).

To apply against the prod DB manually (rarely needed), use the **public** proxy URL, not the
internal one:
```bash
DATABASE_URL="<Postgres DATABASE_PUBLIC_URL, e.g. host acela.proxy.rlwy.net:PORT>" \
  npx prisma migrate deploy
```
> The internal `postgres.railway.internal` host is **not reachable** from your laptop — always use the
> public proxy URL (`railway variables -s Postgres --kv`).

## 3. Enable payment gateways (when the merchant account is approved)
Card/gateway top-ups are gated behind an env flag and are **off by default** (the app runs on the
wallet ledger only until then).
1. Follow `PAYMENTS_GO_LIVE.md` for the merchant/gateway credentials.
2. On Railway, set:
   ```bash
   railway variables --set PAYMENT_GATEWAYS_ENABLED=true
   # plus the gateway credentials PAYMENTS_GO_LIVE.md lists
   ```
3. Redeploy if needed and test a small real top-up. With the flag off, the gateway top-up endpoint
   deliberately refuses (`wallet.controller.ts` checks `PAYMENT_GATEWAYS_ENABLED === 'true'`).

## 4. Issue a bulk refund (a venue cancels)
There is no one-click bulk refund UI. Two supported paths:
- **Per match (recommended, atomic + audited):** in the admin panel, **force-cancel each affected
  match**. This refunds every paid player's wallet in full and writes ledger + audit entries
  (`admin.cancelMatch`). Do this for each match at the cancelled venue.
- **Per user:** for one-off corrections, use **Users → Adjust wallet** (type ADMIN_ADJUSTMENT) with a
  clear reason.

Always record the reason (venue name, date, "venue closure refund"). The wallet ledger is the record.

## 5. Handle a payment / wallet discrepancy
**The wallet ledger is the source of truth.** Money is only moved through `WalletService.adjust`,
which writes an immutable `WalletTransaction` entry; balances are derived from these entries.
1. Open the affected user → review the **wallet ledger** (every entry has a type, amount, reason).
2. Compare against transactions (Transactions page: HELD / RELEASED / REFUNDED / FAILED).
3. **Never edit** a past entry or the DB directly. Correct with a **new** ADMIN_ADJUSTMENT entry and a
   reason explaining the correction.
4. If a completed match's escrow is stuck in HELD, use **Transactions → Release**.

## 6. Add a new admin
1. The person first needs an account (they can sign up as a player, or you create one).
2. **Super Admin only:** in the admin panel, open the user and **change their role** to `ADMIN` (or
   `SUPER_ADMIN`). This is `PATCH /v1/admin/users/:id/role` and is restricted to SUPER_ADMIN.
3. To give them **email + password** login, run the setup endpoint for their email (see
   `SUPER_ADMIN_GUIDE.md` §1) while `ADMIN_SETUP_KEY` is set — note that endpoint creates/resets a
   **SUPER_ADMIN**; for a plain ADMIN, set the role via step 2 after they have a password, or have
   them use phone-OTP login.
4. Confirm the role-change appears in the **audit log**.

## 7. Add a new city or district (locations)
Locations are managed in the admin panel (**Super → Locations**), backed by:
- `GET /v1/admin/locations`, `POST /v1/admin/locations`, `PATCH /v1/admin/locations/:id`,
  `DELETE /v1/admin/locations/:id`.
Add the city/district there; it becomes selectable for venues and users.

## 8. Backup / restore expectations
- **Backups:** Railway Postgres provides managed backups (check the Postgres service → Backups in the
  Railway dashboard). For a manual snapshot before a risky change:
  ```bash
  pg_dump "<DATABASE_PUBLIC_URL>" > backup_$(date +%F).sql
  ```
- **Restore:** restore from a Railway backup, or `psql "<DATABASE_PUBLIC_URL>" < backup.sql` into a
  fresh database. Test restores on a non-prod DB first.
- **Never** run `prisma migrate reset` against production unless you intend to **wipe and reseed** it
  (that is exactly what it does).

## 9. Emergency: take the app offline gracefully
There is **no built-in maintenance-mode flag** in the current code. To take the platform offline:
- **Stop the API** (Railway → API service → pause/stop, or scale to 0). The web apps will then show
  data-loading errors — they depend on the API. This is the fastest kill switch.
- To restore, start the API again; the web apps recover automatically (no redeploy needed).
- If you only need to stop **card top-ups**, unset `PAYMENT_GATEWAYS_ENABLED` instead of taking the
  whole API down.
> A proper in-app maintenance banner/mode is a recommended future addition (see §11).

## 10. Deploy checklist
- **API:** `railway up` from repo root → watch logs for `migrate deploy` success → hit `/v1/health`.
- **Web app (each):** from the app dir,
  `vercel --prod --yes --token <LYNAE_TOKEN> --scope lynae-s-projectsexpo`.
  The token is in `credentials.local` (gitignored). **Always ensure**
  `NEXT_PUBLIC_API_URL=https://expouz-production.up.railway.app/v1` is set on each Vercel project, or
  the app falls back to `localhost` and breaks for users.
- Smoke test each surface: log into admin and pitch-portal, run one real action in each.

## 11. Known gaps / limitations (as of this runbook)
These are real, verified gaps — do not document them as working features to end users:

1. **Commission/player-fee settings are not wired into pricing.** The 10% commission and 5% player
   fee used by match/booking pricing are hard-coded in the API (`matches.service.ts`,
   `bookings.service.ts`); the Settings page stores separate values that don't yet affect live
   pricing. Only the cancellation window/fee are snapshotted onto new pitch-hire bookings.
2. **No "wallet float" dashboard KPI.** It must be derived from the sum of user wallet balances.
3. **No maintenance-mode flag, no welcome-bonus/format settings in the panel.** Welcome/referral
   bonus amounts are env vars (e.g. `REFERRAL_BONUS_AMOUNT`); sport format caps are fixed in
   `format-caps.ts`. Maintenance = stop the API (§9).
4. **Pitch Owner Portal is view/monitor-focused.** Owners cannot yet, *in the portal*, add a venue,
   create a match, or check players in. Venue creation goes through the team/app (owner API
   `POST /pitches` exists but has no portal UI); match creation and check-in happen in the player
   app. The portal is currently English-only.
5. **`@ExpoUzAdminBot` is not provisioned** — admin Telegram Mini App login is coded but needs its own
   bot token. Use email + password on the web.
6. **Admin i18n is scaffolded but not wired** into pages yet (message catalogs exist under
   `apps/admin/messages/`). Pitch-portal has no i18n yet.
7. **Two refund paths exist:** match-booking refunds go through the wallet ledger; pitch-hire
   (`PitchBooking`) cancellations currently credit `User.credit` directly. Consolidating on the wallet
   ledger is recommended.
