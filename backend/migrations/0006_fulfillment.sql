ALTER TABLE orders ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'processing'
  CHECK (fulfillment_status IN ('processing','packed','shipped','delivered'));
ALTER TABLE orders ADD COLUMN carrier TEXT;
ALTER TABLE orders ADD COLUMN shipment_reference TEXT;
ALTER TABLE orders ADD COLUMN fulfillment_updated_at TEXT;
