CREATE TABLE IF NOT EXISTS staff_access (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('viewer', 'manager')),
  token_hash TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS automation_activity (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS maisonpe_order_payment_activity
AFTER UPDATE OF status ON orders
WHEN NEW.status = 'paid' AND OLD.status <> 'paid'
BEGIN
  INSERT INTO automation_activity (name)
  SELECT substr(json_extract(rule.value, '$.name'),1,120) || ' · Verified order ' || NEW.id
  FROM admin_settings, json_each(admin_settings.value) AS rule
  WHERE admin_settings.name = 'automation'
    AND json_extract(rule.value, '$.trigger') = 'payment_verified'
    AND json_extract(rule.value, '$.action') = 'activity_log'
    AND json_extract(rule.value, '$.status') = 'Active';
END;

CREATE TABLE IF NOT EXISTS campaign_sends (
  id TEXT PRIMARY KEY,
  provider_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
