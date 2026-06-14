CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id UUID,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_client_id ON client_portal_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_hash ON client_portal_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_expires_at ON client_portal_tokens(expires_at);
