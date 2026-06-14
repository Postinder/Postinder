UPDATE posts p
SET status = 'archived',
    updated_at = NOW()
FROM clients c
WHERE p.client_id = c.id
  AND c.is_active = false
  AND p.deleted_at IS NULL
  AND p.status <> 'archived';

UPDATE client_portal_tokens t
SET revoked_at = NOW()
FROM clients c
WHERE t.client_id = c.id
  AND c.is_active = false
  AND t.revoked_at IS NULL;
