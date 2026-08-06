# Phone Verification — Setup & Operations

ExpoUz captures a **verified phone number** from players at the moment it's actually
needed (before a first booking, before hosting a match, before wallet movements).
Opening the Mini App still requires **no** phone — `initData` remains the login.

There are three delivery tiers, in order of preference:

| Tier | Method | Cost | User experience |
|---|---|---|---|
| 1 | Telegram `requestContact` | Free | One tap, no code |
| 2 | Telegram Gateway OTP | ~$0.01 / delivered code | Types number → code arrives in Telegram |
| 3 | Eskiz SMS (fallback) | Higher, needs business reg | Types number → SMS |

Tier 1 covers most users and needs **no configuration**. Tiers 2–3 are optional and
feature-flagged.

---

## Tier 1 — Telegram contact share (no setup)

Works out of the box using the existing `TELEGRAM_BOT_TOKEN`. The signed contact
payload is validated server-side (HMAC-SHA256), and the shared contact's Telegram
user id must match the authenticated account. Nothing to configure.

---

## Tier 2 — Telegram Gateway OTP (optional)

Used when a user declines the one-tap share or wants to register a different number.

### One-time account setup (manual — the operator does this)

1. Go to <https://gateway.telegram.org> and sign in with your Telegram account.
2. Complete the business details.
3. Fund the account via Fragment (start small — **$10 covers ~1,000 verifications**).
4. Generate an API token.
5. **Sending codes to your OWN number is free** — use that to test.

### Environment variables

```bash
railway variables set TELEGRAM_GATEWAY_TOKEN="<token from gateway.telegram.org>"
railway variables set TELEGRAM_GATEWAY_ENABLED=true
```

The Gateway is only attempted when **both** are set (`TELEGRAM_GATEWAY_ENABLED=true`
and a non-empty token). Codes are generated and validated **by Telegram**
(`checkVerificationStatus`), so a plaintext code never touches our servers or DB.

---

## Tier 3 — Eskiz SMS fallback (optional, off by default)

Only used if the Gateway is disabled/undeliverable **and** SMS is explicitly enabled.
Reuses the existing `ESKIZ_EMAIL` / `ESKIZ_PASSWORD` credentials.

```bash
railway variables set SMS_ENABLED=true
```

SMS codes are stored only as a bcrypt hash and verified locally. Numbers and codes
are never logged.

---

## Security guarantees (enforced in code)

- Contact payload signature validated server-side (HMAC-SHA256, `WebAppData` secret).
- The contact's `user_id` must match the caller's `telegramId` (`CONTACT_MISMATCH`).
- Numbers normalised to E.164 before storage/comparison.
- **One phone = one account** — reuse is rejected with `PHONE_ALREADY_USED`.
- Codes are never stored in plaintext (Telegram-side verification for Gateway).
- Rate limits: **3** code requests / hour / user, **5** verify attempts / 15 min.
- Verification records expire (5 min) and are single-use.
- Phone numbers and codes are never logged.

## Admin

- **Users** table shows a **Verified** column (✓ / method / date).
- A user's detail page can **manually mark a phone verified** (method = `ADMIN`),
  which is written to the audit log.
- The **dashboard** shows an **Unverified Phones** count.

## Migration of existing users

The migration adds `phoneVerified = false` to every existing row. Users with a
placeholder phone (e.g. `+998000…`) keep app access and are simply prompted at their
next gated action. No existing user loses access.
