ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_email_key;

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_email_key;

DROP INDEX IF EXISTS idx_users_active_email_unique;
DROP INDEX IF EXISTS idx_clients_active_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_active_email_unique
  ON users (LOWER(email))
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_active_email_unique
  ON clients (LOWER(email))
  WHERE is_active = true;
