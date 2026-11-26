# Maisonpé

The static storefront is hosted on Vercel. Its catalog, checkout and store operations
use same-origin API paths that Vercel rewrites to the Cloudflare Worker. D1 stores
published products and order records. Until products are published, the storefront
displays its sample collection with checkout closed.

- Storefront: https://okopipeterson.vercel.app/
- Store operations: https://okopipeterson.vercel.app/operations.html
- Worker health: https://maisonpe-api.thankgododiawa6.workers.dev/health

## Configure Flutterwave

1. Open **Workers & Pages → maisonpe-api → Settings → Variables and Secrets** in
   Cloudflare. Add `FLW_SECRET_KEY` as a **Secret**. The Worker defaults to test mode
   and expects a Flutterwave v3 test secret key.
2. Choose a random webhook secret. Save it as the **Secret** `FLW_WEBHOOK_SECRET` in
   Cloudflare and as the webhook secret hash in the matching Flutterwave environment.
   Set the Flutterwave webhook URL to
   `https://maisonpe-api.thankgododiawa6.workers.dev/payments/flutterwave/webhook`.
3. Set a random admin token of at least 32 characters as the **Secret**
   `ADMIN_API_TOKEN`. Enter the token on the Store Operations page to manage
   products and review orders. Publish the approved catalog and prices there.
4. Test checkout and verify the test order appears in Store Operations. To accept
   real payments, set the Worker variable `FLW_MODE` to `live`, install the matching
   live secret key and webhook configuration, and deploy the updated settings.
   Orders retain the mode in which they were created. Never fulfill a test order.

The Worker creates a hosted payment with the order's D1 price and a unique reference.
A return or signed webhook triggers verification against Flutterwave. The Worker checks
the transaction ID, reference, successful status, currency and exact amount before
marking the order paid. Checkout stays closed until both Flutterwave secrets for the
configured mode are available.

## Development

Run Cloudflare commands from `backend/`. Install with `npm ci` and check the Worker
with `npm run check` and `npx cf build`. Database migrations are in
`backend/migrations/`. The deployed D1 database has both migrations applied.

## Store operations

Use **Settings** for the standard delivery fee, **Shipping zones** for regional fees,
and **Discounts** to activate unique percentage codes. If regions exist, buyers must
choose one. Checkout calculates and confirms the total before creating the Flutterwave link.

Use **Content & pages** to publish a page at `/pages/<slug>`. Drafts stay private.
Link published pages from **Navigation**. The owner can issue and revoke individual
staff tokens. Viewer tokens provide read access; manager tokens can edit store records.
Owner access is required to manage staff, send email, or control paid campaigns.

An active automation can write a run to the dashboard when payment is verified.
It runs once per successful order status transition.

Email broadcasts need the Worker secret `MAISONPE_RESEND_KEY` and verified sender
`MAISONPE_EMAIL_FROM`. Enter an opted-in Resend segment ID in **Email & newsletters**.
Resend adds the unsubscribe link. A send requires explicit confirmation.

**Marketing & advertising** can review, activate, and pause existing, fully configured
Meta campaigns. Supply the Worker secret `MAISONPE_META_TOKEN`, the Maisonpé ad
account ID in `MAISONPE_META_AD_ACCOUNT`, and the supported Graph version in
`MAISONPE_META_API_VERSION` (for example `v27.0`). The token must have ads
management access to that account. Confirming activation may start ad spending.
