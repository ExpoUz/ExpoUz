# ExpoUz — Super Admin Guide

For platform operators. This guide describes **what the software actually does today**.
Where a feature commonly expected is not built yet, it says so plainly.

---

## 1. Getting in

### The admin URL
- **Production:** https://admin-six-zeta-62.vercel.app
- **Local dev:** http://localhost:3000 (API must be running on http://localhost:3001/v1)

### How to log in (email + password)
1. Open the admin URL.
2. Enter your **admin email** and **password**.
3. Click **Sign in**.

Only accounts with role **ADMIN** or **SUPER_ADMIN** can sign in. Any other account is rejected
with "Access denied. Admin accounts only."

> **Default dev credentials** (created by the seed script): `admin@expouz.uz` / `ChangeMe123!`
> Change this password immediately in any real environment (see below).

The same seeded account also has phone `+998901111111`, which can log in by OTP through the
Telegram/phone flow, but **email + password is the primary admin login**.

> **Note on the Telegram admin bot:** the login page will auto-sign-in if opened inside a Telegram
> admin Mini App (`@ExpoUzAdminBot`). That bot is **not provisioned in production yet** (it needs its
> own bot token). Until it is, use email + password on the web.

### If you're locked out — create or reset a Super Admin

There is a gated setup endpoint. It is **inert unless the `ADMIN_SETUP_KEY` environment variable is
set** on the API server. This is the documented recovery path.

1. On the API host (Railway), set the env var to a strong secret:
   ```bash
   railway variables --set ADMIN_SETUP_KEY=<a-long-random-secret>
   ```
   (Railway will redeploy. For local dev, put `ADMIN_SETUP_KEY=...` in `packages/api/.env`.)

2. Call the setup endpoint (creates a new Super Admin, or resets the password of an existing account
   with that email and promotes it to SUPER_ADMIN):
   ```bash
   curl -X POST https://expouz-production.up.railway.app/v1/auth/admin/setup \
     -H "Content-Type: application/json" \
     -d '{
       "setupKey": "<the-same-secret>",
       "email": "admin@expouz.uz",
       "password": "<new-strong-password>",
       "firstName": "Platform",
       "lastName": "Owner"
     }'
   ```
   A `201` with `{ id, email, role: "SUPER_ADMIN" }` means success. You can now log in with that
   email + password.

3. **Disable the endpoint again** by unsetting the variable (this is what "disabled after first use"
   means in practice — the operator removes the key):
   ```bash
   railway variables --unset ADMIN_SETUP_KEY
   ```
   To re-enable it later (e.g. a future lockout), set the variable again and repeat.

Security notes: the endpoint rejects any request when the key is unset or wrong (constant-time
compare), passwords are stored only as bcrypt hashes, and this is the only way to bootstrap the
first admin without database access.

### How to log out (and why)
Click **Log out / Sign out** in the sidebar. This clears the stored token from the browser
(`localStorage` + the `admin_token` cookie the middleware checks) and returns you to the login page.
**Always log out on shared or public computers** — anyone with the browser open can otherwise act as
you until the token expires.

---

## 2. Roles: who can do what

There are four roles (`UserRole`): **PLAYER**, **PITCH_OWNER**, **ADMIN**, **SUPER_ADMIN**.
(There is no separate "support/read-only" role today.)

| Action | ADMIN | SUPER_ADMIN |
|---|---|---|
| View dashboard, users, matches, pitches, transactions, analytics, activity | ✅ | ✅ |
| Ban/unban users, adjust wallets, verify pitches, cancel matches, resolve disputes | ✅ | ✅ |
| Send announcements, edit settings | ✅ | ✅ |
| **Change a user's role** | ❌ | ✅ (SUPER_ADMIN only) |
| Manage pitch-admins, locations | ✅ | ✅ |

All admin API routes are protected by an authentication guard + a role guard; the whole admin panel
is behind middleware that blocks every route except `/login` when there is no valid token.

---

## 3. Reading the dashboard

The dashboard shows platform KPIs (from `GET /admin/dashboard`):

- **Total users** — non-deleted, non-banned accounts.
- **Active matches** — matches in OPEN / FULL / CONFIRMED / IN_PROGRESS.
- **Revenue today / this month** — sum of transaction amounts in status HELD or RELEASED for the
  period. (HELD = money in escrow; RELEASED = paid out.)
- **Pending pitches** — venues awaiting your verification.
- **Failed transactions** — count of transactions in FAILED.
- **Daily active users** — bookings confirmed today (a proxy).
- **Sport breakdown** — football vs padel: match counts, pitch counts, and (padel) assessed players.

> **"Wallet float" (money you owe users):** there is **no single dashboard tile** for this yet. The
> float is the sum of all users' wallet balances — every top-up, welcome/referral bonus, and refund
> credited but not yet spent is money the platform is holding on behalf of users. You can see
> individual balances on each user's detail page (wallet ledger). Treat this as a liability: it is
> real money owed, separate from your fee income.

---

## 4. Daily operations

### Approve (or reject) a new venue
1. Go to **Pitches → Pending** (or the pending list on the dashboard).
2. Open the venue. Before approving, check: real name, sensible address/district, a plausible hourly
   rate, at least one photo, correct sport and court/surface type, and that the owner is a real
   `PITCH_OWNER` account.
3. **Approve** → the venue becomes verified and visible to players.
   **Reject** → provide a reason; it is stored on the venue (`rejectionReason`) and the venue stays
   hidden.

New venues are created as **unverified** and never shown to players until you approve them.

### Handle a user complaint (find → inspect → refund/credit)
1. **Users** → search by name, phone, or email.
2. Open the user. Their detail page shows profile, bookings, transactions, and activity.
3. To make it right, use **manual wallet adjust** (next section) to refund or credit them, always
   with a clear reason.

### Force-cancel a match (and what happens to the money)
1. **Matches** → filter to the match → **Force cancel**.
2. The system, in one atomic transaction:
   - sets the match to **CANCELLED**;
   - sets every confirmed booking to **CANCELLED_REFUND**;
   - for each paid booking (transaction HELD or RELEASED), marks it **REFUNDED** and credits that
     player's **wallet in full** with a ledger entry ("Match cancelled by admin — full refund").
3. The response tells you how many players were refunded.

> Confirm before you click: this refunds **every paid player in full**. Example: a full 4-player
> padel match at 45 000 UZS each → four wallet refunds totalling **180 000 UZS**.

### Resolve a disputed (padel) result
1. **Moderation / Disputes** → open the disputed result.
2. **Confirm** → the result is accepted (`isConfirmed`), the match is marked COMPLETED, and **padel
   level changes are applied** (ELO recalculated for the players).
   **Dismiss** → the dispute flag is cleared and no level change is applied.

### Manually top up / adjust a user's wallet (offline bank transfers)
Use this when a user pays you by bank transfer/cash and you credit their in-app wallet.

1. **Users** → open the user → **Adjust wallet**.
2. Enter an **amount** (positive to credit, negative to claw back) and a **reason (description)**.
3. Choose a **type**:
   - **TOPUP** — a normal credit (cannot push the balance negative).
   - **ADMIN_ADJUSTMENT** — a correction that *may* push the balance negative (e.g. reversing a
     bonus).
4. Submit. The change is written to the **immutable wallet ledger** with your reason.

> **Why the reason matters:** the ledger is the source of truth for money owed. Six months later,
> "why is this user's balance 200 000?" is answered only by the reasons on each entry. A blank reason
> makes reconciliation impossible. Always write *why* (e.g. "Bank transfer 2026-08-02, ref 12345").

---

## 5. Money

### Commission and player fee (with a worked example)
- **Platform commission = 10%** of the pitch cost (the platform's cut of venue revenue).
- **Player fee = 5%** added on top of each player's share.

Worked example — a 2-hour padel court at 90 000 UZS/hour, 4 players:
- Pitch cost = 90 000 × 2 = **180 000 UZS**.
- Platform commission (10%) = **18 000 UZS** (platform keeps this from the venue side).
- Each player's base share = 180 000 ÷ 4 = 45 000 UZS.
- Player fee (5%) on each share = 2 250 UZS → **each joining player pays ≈ 47 250 UZS**.

> **Important — settings vs. pricing:** the commission (10%) and player fee (5%) used by the match/
> booking pricing engine are currently **hard-coded** in the API. The **Settings page** stores its own
> commission/fee values, but editing them there does **not yet change live pricing**. Treat the
> settings page values as configuration that is not fully wired into pricing. (This is a known gap —
> see the runbook.)

### The 5-hour / 50% cancellation policy (with an example)
For **pitch-hire bookings** (a host booking a whole court):
- Cancel **more than 5 hours** before start → **full refund**.
- Cancel **within 5 hours** of start → **50% penalty** (50% refunded).
- **After start / no-show** → **no refund**.

Example: a 200 000 UZS court booking cancelled 3 hours before start → 50% penalty = 100 000 UZS kept,
100 000 UZS refunded.

The 5-hour window and 50% fee are captured on the booking at creation time.

### Reading the transactions ledger
**Transactions** lists every payment with user, linked match, amount, and **status**:
- **HELD** — money is in escrow (player paid, match not yet completed).
- **RELEASED** — escrow paid out (to the venue owner) after completion.
- **REFUNDED** — returned to the player.
- **FAILED** — payment did not complete.

### Running pitch-owner payouts
When a match completes, its escrowed transaction is **released** (owner gets paid). If a transaction
is stuck in HELD after a completed match, open it in **Transactions** and use **Release** — this
marks it RELEASED and the booking COMPLETED.

### Why ledger entries are never edited
Wallet entries are **append-only**. You never edit or delete a past entry. A mistake is corrected by
adding a **new** entry (an ADMIN_ADJUSTMENT with a reason). This preserves a complete, auditable
money history.

---

## 6. Settings & safety

### What each setting does (and the risk)
The Settings page exposes four platform values (`AppSettings`):

| Setting | Meaning | Risk if changed |
|---|---|---|
| Commission rate | Platform's cut of pitch revenue (default 0.10) | See gap above — not yet wired into live pricing |
| Platform fee rate | Fee added to players (default 0.05) | Same — informational until wired |
| Cancellation fee rate | Penalty for late cancels (default 0.50) | Affects new pitch-hire bookings' snapshot |
| Cancellation window (hours) | Late-cancel threshold (default 5) | Affects new pitch-hire bookings' snapshot |

> There is currently **no** in-settings toggle for welcome bonus, maintenance mode, or sport
> formats/caps. Welcome/referral bonus amounts are environment variables; sport format caps are fixed
> in code (`format-caps.ts`). See the runbook for how to change those.

### The audit log — who did what
Every **admin write action** (any create/update/delete in the admin panel) is recorded to an
immutable audit trail: the acting admin, the action, the target id, a sanitized snapshot of the
request, and a timestamp.

- View it under **Activity** in the panel, or via
  `GET /v1/admin/activity-log?category=ADMIN_ACTION`.
- Filter by admin (`userId`), action text, entity, or date range.
- Password-like fields are redacted in the stored snapshot.

### Rules
- **Never share credentials.** Each admin has their own account (audit entries are per-admin).
- **Never edit the database directly** for money — always use the panel so it's ledgered and audited.
- **Always use the panel**, not raw SQL, for bans, refunds, and role changes.

---

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Can't log in ("Invalid email or password") | Wrong email/password, or the account isn't ADMIN/SUPER_ADMIN, or has no password set. Use the setup endpoint (§1) to reset. |
| Logged in but data won't load | API down or wrong `NEXT_PUBLIC_API_URL` on the web app. Check the API health endpoint and Railway logs (see runbook). |
| Action fails / spins forever | Check Railway API logs for the error; confirm the API is reachable and the DB is up. |
| Redirected to login immediately | Token expired or cookie cleared — just log in again. |
| Locked out entirely | Setup-endpoint recovery in §1. |

**Escalation:** infrastructure/API issues → check Railway (API + Postgres + Redis services) and the
`ADMIN_OPERATIONS_RUNBOOK.md`. Payments going live → `PAYMENTS_GO_LIVE.md`.

**Support contact:** _(set your team's Telegram/email here)_ — e.g. Telegram @ExpoUzSupport.
