ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS files_retention_policy VARCHAR(20);

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS storage_deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS storage_delete_error TEXT;

UPDATE posts
SET files_retention_policy = CASE
  WHEN files_delete_after IS NULL THEN 'never'
  WHEN executed_at IS NOT NULL AND files_delete_after <= executed_at THEN 'immediate'
  WHEN executed_at IS NOT NULL AND files_delete_after = executed_at + INTERVAL '1 day' THEN '1d'
  WHEN executed_at IS NOT NULL AND files_delete_after = executed_at + INTERVAL '7 days' THEN '7d'
  WHEN executed_at IS NOT NULL AND files_delete_after = executed_at + INTERVAL '30 days' THEN '30d'
  ELSE NULL
END
WHERE status = 'executed'
  AND files_retention_policy IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_files_retention_policy_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_files_retention_policy_check
      CHECK (files_retention_policy IS NULL OR files_retention_policy IN ('immediate', '1d', '7d', '30d', 'never'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_files_storage_retention_pending
  ON files(storage_deleted_at)
  WHERE storage_deleted_at IS NULL;
