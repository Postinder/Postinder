ALTER TABLE files ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ordered_files AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at, id) AS position
  FROM files
  WHERE sort_order IS NULL
)
UPDATE files
SET sort_order = ordered_files.position
FROM ordered_files
WHERE files.id = ordered_files.id;

CREATE INDEX IF NOT EXISTS idx_files_post_sort_order ON files(post_id, sort_order);
