ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_detailed_view BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE client_portal_tokens
  ADD COLUMN IF NOT EXISTS token_ciphertext TEXT;

CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_active_client_created
  ON client_portal_tokens(client_id, created_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON COLUMN clients.portal_detailed_view IS
  'Restores the detailed portal navigation and overview for this client when true.';

COMMENT ON COLUMN client_portal_tokens.token_ciphertext IS
  'AES-GCM encrypted portal token used only for authorized administrative recovery; token_hash remains authoritative for validation.';
