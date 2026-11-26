# Maisonpé

The storefront is static HTML, CSS, and JavaScript. Open index.html to preview it. Its shopping bag, demo catalog, and demo admin remain local to the browser.

## Cloudflare backend

The Worker in `backend/` uses Cloudflare D1. The deployed API is
[maisonpe-api.thankgododiawa6.workers.dev](https://maisonpe-api.thankgododiawa6.workers.dev/health).

| Method and path | Behavior |
| --- | --- |
| GET /health | Verify the Worker can read both D1 tables. |
| GET /api/products | List published products with NGN prices in kobo. |
| POST /api/orders | Record an unpaid order from product IDs, sizes and quantities when ordering is enabled. |
| GET /api/admin/products | List all products, including unpublished ones. |
| PUT /api/admin/products/{id} | Create or update a product. |
| GET /api/admin/orders?page=1 | List orders and their original line items. |
| POST /api/admin/orders/{id}/cancel | Cancel an unpaid order. |

Admin endpoints require a Bearer token. Store a random token of at least 32 characters as the
`ADMIN_API_TOKEN` Worker secret and use it only from a trusted server or operator client.
Admin endpoints stay disabled until that secret is set.

A product accepts `name`, `category`, `price_minor` (kobo), and a boolean `active`.
Optional fields are `description` and `image_url` (HTTPS). The public catalog starts
empty for approved products and prices to be entered separately.

Order requests require a fresh UUID v4 in the `Idempotency-Key` header and a JSON body
with `email` and `items`. Each item contains `id`, `size`, and `quantity`. Reuse the key
when retrying the same order. The Worker prices each order from D1 and saves a snapshot
of the line items. Customer ordering is disabled until the storefront and Flutterwave
payment verification are integrated. Production payment credentials belong in Worker secrets.

Run Cloudflare commands from `backend/`. Install with `npm ci` and check the Worker with
`npm run check` and `npx cf build`. SQL migrations are in `backend/migrations/`.
The deployed D1 database already has the initial schema.
