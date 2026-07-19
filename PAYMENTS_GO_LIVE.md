# Turning on real card payments

ExpoUz launches on a **wallet-first** model. The wallet is the single internal
currency; every balance change is recorded in an immutable `WalletTransaction`
ledger. Payment gateways (Payme / Click / Uzum) are **built but disabled** behind
the `PAYMENT_GATEWAYS_ENABLED` flag. When they are on, they only **fund the
wallet** — they are never a parallel money path, so the ledger stays the one
source of truth.

## Prerequisite (business/legal — only the human can do this)

Real card payments in Uzbekistan require a **registered business entity** (an
Individual Entrepreneur "YT" at 4% turnover tax is the lightest path, or an
LLC/MChJ) and an **approved merchant account** with each gateway. This takes
days-to-weeks and needs your documents. No code can bypass it.

## The switch-on procedure (no code changes required)

When the merchant account is approved:

```bash
# 1. Enable the gateway path
railway variables set PAYMENT_GATEWAYS_ENABLED=true

# 2. Add the gateway credentials you were issued
railway variables set PAYME_MERCHANT_ID=...  PAYME_SECRET_KEY=...
railway variables set CLICK_SERVICE_ID=...   CLICK_MERCHANT_ID=...  CLICK_SECRET_KEY=...
railway variables set UZUM_MERCHANT_ID=...    UZUM_SECRET_KEY=...

# 3. Redeploy the API (or let the variable change trigger a redeploy)
```

4. Register each gateway's webhook URL in its merchant dashboard:
   - Payme: `{API}/v1/payments/payme/webhook`
   - Click: `{API}/v1/payments/click/webhook`
   - Uzum:  `{API}/v1/payments/uzum/webhook`

Online top-up via Payme/Click/Uzum now appears in the app automatically.

## Until then (wallet-first launch)

You can onboard real users today. Get credit into wallets via:

- **Welcome bonus** — every new user is credited `WELCOME_BONUS_AMOUNT` (default
  50 000 UZS) on registration, once, recorded as a `WELCOME_BONUS` ledger entry.
- **Referral bonus** — `REFERRAL_BONUS_AMOUNT` to both the inviter and the new
  user when someone joins via a referral code.
- **Admin manual top-up** — process an offline bank transfer, then credit the
  user from the admin panel: `POST /v1/admin/users/:id/wallet`
  `{ "amount": 100000, "description": "Bank transfer 2026-06-23" }`.
  This writes a `TOPUP` (or `ADMIN_ADJUSTMENT`) ledger row.

## Guardrails

- Wallet ledger rows are **immutable**. Corrections are new `ADMIN_ADJUSTMENT`
  entries, never edits.
- Gateways are enabled **only** via the env flag — never hard-code them on.
- All wallet movements go through `WalletService.adjust`, which is atomic and
  ledgered.
