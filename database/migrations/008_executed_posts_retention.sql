ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS files_delete_after TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_posts_executed_at ON posts(executed_at);
CREATE INDEX IF NOT EXISTS idx_posts_files_delete_after ON posts(files_delete_after);
