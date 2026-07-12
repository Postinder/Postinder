ALTER TABLE files
  ADD COLUMN IF NOT EXISTS bucket VARCHAR(255),
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT;

CREATE INDEX IF NOT EXISTS idx_files_storage_identity
  ON files(bucket, storage_path)
  WHERE bucket IS NOT NULL AND storage_path IS NOT NULL;

WITH public_storage_urls AS (
  SELECT
    id,
    regexp_match(url, '/storage/v1/object/public/([^/]+)/([^?]+)') AS parts
  FROM files
  WHERE (bucket IS NULL OR storage_path IS NULL)
    AND url LIKE '%/storage/v1/object/public/%'
)
UPDATE files f
SET bucket = COALESCE(f.bucket, public_storage_urls.parts[1]),
    storage_path = COALESCE(f.storage_path, public_storage_urls.parts[2])
FROM public_storage_urls
WHERE f.id = public_storage_urls.id
  AND public_storage_urls.parts IS NOT NULL;

UPDATE files
SET bucket = COALESCE(bucket, 'local'),
    storage_path = COALESCE(storage_path, substring(url FROM '^/uploads/(.+)$'))
WHERE url LIKE '/uploads/%';
