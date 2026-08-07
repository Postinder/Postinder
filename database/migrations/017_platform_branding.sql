CREATE TABLE IF NOT EXISTS platform_branding (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_key),
  institutional_name VARCHAR(120) NOT NULL DEFAULT 'Postinder',
  logo_bucket TEXT,
  logo_storage_path TEXT,
  logo_mime_type VARCHAR(50),
  logo_size_bytes BIGINT,
  logo_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT platform_branding_logo_metadata_complete CHECK (
    (logo_bucket IS NULL AND logo_storage_path IS NULL AND logo_mime_type IS NULL AND logo_size_bytes IS NULL)
    OR
    (logo_bucket IS NOT NULL AND logo_storage_path IS NOT NULL AND logo_mime_type IS NOT NULL AND logo_size_bytes IS NOT NULL)
  ),
  CONSTRAINT platform_branding_logo_mime_allowed CHECK (
    logo_mime_type IS NULL OR logo_mime_type IN ('image/png', 'image/jpeg', 'image/webp')
  ),
  CONSTRAINT platform_branding_logo_size_allowed CHECK (
    logo_size_bytes IS NULL OR logo_size_bytes BETWEEN 1 AND 2097152
  )
);
