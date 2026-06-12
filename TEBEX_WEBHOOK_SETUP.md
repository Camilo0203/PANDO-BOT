# Tebex Webhook Setup

TON618 uses the webhook hosted by `ton618-bot` as the canonical purchase and
activation path.

## Endpoint

Configure this URL in **Tebex > Developers > Webhooks**:

```text
https://ton618bot.xyz/webhook-tebex
```

Enable these events:

- `payment.completed`
- `payment.refunded`
- `payment.dispute.lost`
- `recurring-payment.renewed`
- `recurring-payment.ended`

Tebex also sends `validation.webhook` automatically when the endpoint is
created.

## Required Environment Variables

Configure values only in the production secret manager. Never paste real
values into this repository.

```text
TEBEX_SECRET_KEY=<webhook-secret>
TEBEX_PUBLIC_TOKEN=<headless-store-public-token>
SUPABASE_URL=<project-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Optional overrides:

```text
TEBEX_ALLOWED_PKG_IDS=<comma-separated-package-ids>
TEBEX_PACKAGE_TIER_MAP={"package-id":"pro_monthly"}
```

Supported tier values are `pro_monthly`, `pro_yearly`, and `lifetime`.

## Verification

The health endpoint never returns secret values:

```bash
curl -fsS https://ton618bot.xyz/webhook-tebex/health
```

Expected shape:

```json
{"status":"ok","configured":true,"packageTierMap":["..."]}
```

After a sandbox purchase, verify:

1. The buyer receives a bilingual Discord DM with an activation code.
2. `/premium activate <code>` works only for the server owner.
3. `/premium status` shows the correct plan and expiration.
4. A duplicate webhook does not create another usable code.
5. A refund or ended recurring payment removes PRO.

## Security

- Rotate any webhook secret that has ever been committed or shared.
- Validate the official `X-Signature` against the raw request body.
- Keep technical errors in server logs; never include secrets in responses.
- Do not configure the legacy Supabase role-assignment webhook as a second
  purchase endpoint.
