ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS portal_approval_mode VARCHAR(20) NOT NULL DEFAULT 'content';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_settings_portal_approval_mode_check'
      AND conrelid = 'platform_settings'::regclass
  ) THEN
    ALTER TABLE platform_settings
      ADD CONSTRAINT platform_settings_portal_approval_mode_check
      CHECK (portal_approval_mode IN ('content', 'item'));
  END IF;
END $$;

-- Funnel classification remains available for historical records and integrations, but
-- is no longer an operational input in Postinder.
ALTER TABLE platform_settings
  ALTER COLUMN post_field_policies
  SET DEFAULT '{"description":"optional","scheduled_date":"optional","funnel_tag":"hidden"}'::jsonb;

UPDATE platform_settings
SET post_field_policies = jsonb_set(post_field_policies, '{funnel_tag}', '"hidden"'::jsonb, true),
    updated_at = NOW()
WHERE post_field_policies->>'funnel_tag' IS DISTINCT FROM 'hidden';

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_post_id_id
  ON files (post_id, id);

CREATE TABLE IF NOT EXISTS portal_item_review_drafts (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  file_id UUID NOT NULL,
  decision VARCHAR(20) NOT NULL,
  rejection_reason TEXT,
  rejection_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, file_id),
  CONSTRAINT portal_item_review_drafts_file_post_fk
    FOREIGN KEY (post_id, file_id) REFERENCES files(post_id, id) ON DELETE CASCADE,
  CONSTRAINT portal_item_review_drafts_decision_check
    CHECK (decision IN ('approved', 'rejected')),
  CONSTRAINT portal_item_review_drafts_rejection_reason_check
    CHECK (decision <> 'rejected' OR NULLIF(BTRIM(rejection_reason), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS portal_post_reviews (
  post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  completed_status VARCHAR(20),
  completed_at TIMESTAMP,
  rewind_used BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portal_post_reviews_status_check
    CHECK (completed_status IS NULL OR completed_status IN ('approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_portal_post_reviews_completed
  ON portal_post_reviews (completed_at DESC);

COMMENT ON COLUMN platform_settings.portal_approval_mode IS
  'Global client approval unit: content (one decision per post) or item (draft decisions finalized together).';

COMMENT ON TABLE portal_item_review_drafts IS
  'Autosaved item-level choices. They are provisional and must never be counted as official decisions.';

COMMENT ON TABLE portal_post_reviews IS
  'Official portal review completion and one-time post-level rewind state.';
