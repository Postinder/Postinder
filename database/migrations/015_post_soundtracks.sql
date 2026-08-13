CREATE TABLE IF NOT EXISTS post_soundtracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  mode VARCHAR(32) NOT NULL,
  source_media_id UUID REFERENCES files(id) ON DELETE SET NULL,
  track_name VARCHAR(255),
  artist VARCHAR(255),
  external_url TEXT,
  platform VARCHAR(120),
  start_time_seconds INTEGER NOT NULL DEFAULT 0,
  usage_source VARCHAR(40),
  usage_notes TEXT,
  rights_notes TEXT,
  audio_url TEXT,
  bucket VARCHAR(255),
  storage_path TEXT,
  mime_type VARCHAR(255),
  size_bytes BIGINT,
  original_name VARCHAR(255),
  approval_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP,
  adjustment_requested_at TIMESTAMP,
  adjustment_comment TEXT,
  revision_number INTEGER NOT NULL DEFAULT 1,
  storage_deleted_at TIMESTAMP,
  storage_delete_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  CONSTRAINT post_soundtracks_mode_check
    CHECK (mode IN ('none', 'embedded', 'uploaded', 'external_reference')),
  CONSTRAINT post_soundtracks_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'adjustment_requested')),
  CONSTRAINT post_soundtracks_start_time_check
    CHECK (start_time_seconds >= 0),
  CONSTRAINT post_soundtracks_revision_check
    CHECK (revision_number > 0),
  CONSTRAINT post_soundtracks_usage_source_check
    CHECK (
      usage_source IS NULL OR usage_source IN (
        'platform_library',
        'licensed_bank',
        'client_provided',
        'original_production',
        'other'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_soundtracks_active_post
  ON post_soundtracks(post_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_soundtracks_source_media
  ON post_soundtracks(source_media_id)
  WHERE source_media_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_soundtracks_storage_identity
  ON post_soundtracks(bucket, storage_path)
  WHERE bucket IS NOT NULL AND storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_soundtracks_retention_pending
  ON post_soundtracks(storage_deleted_at)
  WHERE storage_deleted_at IS NULL AND storage_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS post_soundtrack_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soundtrack_id UUID NOT NULL REFERENCES post_soundtracks(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  reason VARCHAR(80) NOT NULL,
  snapshot JSONB NOT NULL,
  actor_id UUID,
  actor_role VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(soundtrack_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_post_soundtrack_versions_post
  ON post_soundtrack_versions(post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_soundtrack_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soundtrack_id UUID NOT NULL REFERENCES post_soundtracks(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  decision VARCHAR(32) NOT NULL,
  comment TEXT,
  actor_id UUID,
  actor_role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT post_soundtrack_decisions_decision_check
    CHECK (decision IN ('approved', 'adjustment_requested')),
  CONSTRAINT post_soundtrack_adjustment_comment_check
    CHECK (decision <> 'adjustment_requested' OR LENGTH(TRIM(COALESCE(comment, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_post_soundtrack_decisions_post
  ON post_soundtrack_decisions(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_soundtrack_decisions_soundtrack
  ON post_soundtrack_decisions(soundtrack_id, revision_number, created_at DESC);
