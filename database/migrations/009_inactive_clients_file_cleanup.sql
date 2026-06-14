ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS archived_by_client_deactivation BOOLEAN DEFAULT false;

UPDATE posts p
SET files_delete_after = COALESCE(p.files_delete_after, NOW() + INTERVAL '1 day'),
    archived_by_client_deactivation = CASE WHEN p.status = 'archived' THEN archived_by_client_deactivation ELSE true END,
    updated_at = NOW()
FROM clients c
WHERE p.client_id = c.id
  AND c.is_active = false
  AND p.deleted_at IS NULL;
