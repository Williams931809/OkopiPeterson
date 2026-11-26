CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price_minor INTEGER NOT NULL CHECK (price_minor BETWEEN 1 AND 100000000000),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  total_minor INTEGER NOT NULL CHECK (total_minor > 0),
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'cancelled')),
  payment_reference TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS orders_created_at ON orders(created_at DESC, id DESC);
