ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS archived_by_client_deactivation BOOLEAN DEFAULT false;

UPDATE posts
SET archived_by_client_deactivation = true
WHERE status = 'archived'
  AND files_delete_after IS NOT NULL;
