ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS content_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_revision INTEGER,
  ADD COLUMN IF NOT EXISTS executed_revision INTEGER;

-- These states prove that the legacy content entered an approval cycle, but they do
-- not prove a specific client decision. Legacy approved/executed records therefore
-- keep approved_revision/executed_revision NULL.
UPDATE posts
SET content_revision = 1
WHERE status IN ('sent', 'pending_approval', 'rejected')
  AND content_revision = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_content_revision_check'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_content_revision_check
      CHECK (content_revision >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_approved_revision_check'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_approved_revision_check
      CHECK (
        approved_revision IS NULL
        OR (
          approved_revision > 0
          AND approved_revision = content_revision
          AND status IN ('approved', 'executed')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_executed_revision_check'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_executed_revision_check
      CHECK (
        executed_revision IS NULL
        OR (
          executed_revision > 0
          AND executed_revision = content_revision
          AND approved_revision = content_revision
          AND status = 'executed'
        )
      );
  END IF;
END $$;

-- Drafts created before content revisions cannot be safely attributed to the
-- current material version. Discard them once, when the revision column is added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'portal_item_review_drafts'
      AND column_name = 'content_revision'
  ) THEN
    DELETE FROM portal_item_review_drafts;
    ALTER TABLE portal_item_review_drafts
      ADD COLUMN content_revision INTEGER NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'portal_item_review_drafts_content_revision_check'
      AND conrelid = 'portal_item_review_drafts'::regclass
  ) THEN
    ALTER TABLE portal_item_review_drafts
      ADD CONSTRAINT portal_item_review_drafts_content_revision_check
      CHECK (content_revision > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS portal_review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content_revision INTEGER NOT NULL,
  review_sequence INTEGER NOT NULL,
  decision VARCHAR(20) NOT NULL,
  approval_mode VARCHAR(20) NOT NULL,
  client_id UUID NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portal_review_decisions_content_revision_check
    CHECK (content_revision > 0),
  CONSTRAINT portal_review_decisions_sequence_check
    CHECK (review_sequence > 0),
  CONSTRAINT portal_review_decisions_decision_check
    CHECK (decision IN ('approved', 'rejected')),
  CONSTRAINT portal_review_decisions_approval_mode_check
    CHECK (approval_mode IN ('content', 'item')),
  CONSTRAINT portal_review_decisions_actor_role_check
    CHECK (NULLIF(BTRIM(actor_role), '') IS NOT NULL),
  CONSTRAINT portal_review_decisions_post_sequence_unique
    UNIQUE (post_id, review_sequence)
);

CREATE INDEX IF NOT EXISTS idx_portal_review_decisions_post_revision
  ON portal_review_decisions (post_id, content_revision);

CREATE INDEX IF NOT EXISTS idx_portal_review_decisions_client_decided
  ON portal_review_decisions (client_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS portal_review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content_revision INTEGER NOT NULL,
  action VARCHAR(30) NOT NULL,
  actor_id UUID,
  actor_role VARCHAR(50) NOT NULL,
  decision_id UUID REFERENCES portal_review_decisions(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portal_review_actions_content_revision_check
    CHECK (content_revision >= 0),
  CONSTRAINT portal_review_actions_action_check
    CHECK (action IN ('submitted', 'resubmitted', 'client_rewind', 'agency_reopen', 'soundtrack_reset')),
  CONSTRAINT portal_review_actions_actor_role_check
    CHECK (NULLIF(BTRIM(actor_role), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_portal_review_actions_post_revision
  ON portal_review_actions (post_id, content_revision);

CREATE OR REPLACE FUNCTION guard_append_only_portal_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM posts p WHERE p.id = OLD.post_id) THEN
      RAISE EXCEPTION 'Portal review history is append-only'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Keep hard-delete cascades possible: by the time the child trigger runs the
  -- parent post is no longer visible. Direct deletion while the post exists is
  -- always rejected.
  IF EXISTS (SELECT 1 FROM posts p WHERE p.id = OLD.post_id) THEN
    RAISE EXCEPTION 'Portal review history is append-only'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_portal_review_decisions_append_only ON portal_review_decisions;
CREATE TRIGGER trg_guard_portal_review_decisions_append_only
  BEFORE UPDATE OR DELETE ON portal_review_decisions
  FOR EACH ROW
  EXECUTE FUNCTION guard_append_only_portal_history();

DROP TRIGGER IF EXISTS trg_guard_portal_review_actions_append_only ON portal_review_actions;
CREATE TRIGGER trg_guard_portal_review_actions_append_only
  BEFORE UPDATE OR DELETE ON portal_review_actions
  FOR EACH ROW
  EXECUTE FUNCTION guard_append_only_portal_history();

ALTER TABLE post_soundtracks
  ADD COLUMN IF NOT EXISTS approved_content_revision INTEGER;

ALTER TABLE post_soundtrack_decisions
  ADD COLUMN IF NOT EXISTS content_revision INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'post_soundtracks_approved_content_revision_check'
      AND conrelid = 'post_soundtracks'::regclass
  ) THEN
    ALTER TABLE post_soundtracks
      ADD CONSTRAINT post_soundtracks_approved_content_revision_check
      CHECK (approved_content_revision IS NULL OR approved_content_revision > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'post_soundtrack_decisions_content_revision_check'
      AND conrelid = 'post_soundtrack_decisions'::regclass
  ) THEN
    ALTER TABLE post_soundtrack_decisions
      ADD CONSTRAINT post_soundtrack_decisions_content_revision_check
      CHECK (content_revision IS NULL OR content_revision > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_soundtracks_post_approved_revision
  ON post_soundtracks (post_id, approved_content_revision)
  WHERE approved_content_revision IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_soundtrack_decisions_post_content_revision
  ON post_soundtrack_decisions (post_id, content_revision)
  WHERE content_revision IS NOT NULL;

CREATE OR REPLACE FUNCTION guard_protected_post_material_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('sent', 'pending_approval', 'approved', 'executed')
    AND (
      NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.company_id IS DISTINCT FROM OLD.company_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.channels IS DISTINCT FROM OLD.channels
      OR NEW.formats IS DISTINCT FROM OLD.formats
      OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
      OR NEW.email_link IS DISTINCT FROM OLD.email_link
      OR NEW.content_revision IS DISTINCT FROM OLD.content_revision
    )
  THEN
    RAISE EXCEPTION 'Protected post content must be reopened before material changes'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_protected_post_material_update ON posts;
CREATE TRIGGER trg_guard_protected_post_material_update
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION guard_protected_post_material_update();

CREATE OR REPLACE FUNCTION guard_protected_post_file_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status VARCHAR(50);
  protected_parent_exists BOOLEAN;
  frozen_parent_exists BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.status
    INTO parent_status
    FROM posts p
    WHERE p.id = NEW.post_id
    FOR UPDATE;

    IF parent_status IN ('sent', 'pending_approval', 'approved', 'executed') THEN
      RAISE EXCEPTION 'Files cannot be added to a protected post before it is reopened'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT p.status
    INTO parent_status
    FROM posts p
    WHERE p.id = OLD.post_id
    FOR UPDATE;

    -- ON DELETE CASCADE reaches children after the parent row is no longer visible.
    -- Allow that hard-delete path while still rejecting direct child deletion.
    IF NOT FOUND THEN
      RETURN OLD;
    END IF;

    IF parent_status IN ('sent', 'pending_approval', 'approved', 'executed') THEN
      RAISE EXCEPTION 'Files cannot be removed from a protected post before it is reopened'
        USING ERRCODE = '23514';
    END IF;

    RETURN OLD;
  END IF;

  PERFORM 1
  FROM posts p
  WHERE p.id IN (OLD.post_id, NEW.post_id)
  ORDER BY p.id
  FOR UPDATE;

  SELECT EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.id IN (OLD.post_id, NEW.post_id)
      AND p.status IN ('sent', 'pending_approval', 'approved', 'executed')
  )
  INTO protected_parent_exists;

  SELECT EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.id IN (OLD.post_id, NEW.post_id)
      AND p.status IN ('approved', 'executed')
  )
  INTO frozen_parent_exists;

  IF frozen_parent_exists
    AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
      OR NEW.rejection_tags IS DISTINCT FROM OLD.rejection_tags
    )
  THEN
    RAISE EXCEPTION 'Approved or executed post review state is frozen until an explicit reopen'
      USING ERRCODE = '23514';
  END IF;

  IF protected_parent_exists
    AND (
      NEW.post_id IS DISTINCT FROM OLD.post_id
      OR NEW.url IS DISTINCT FROM OLD.url
      OR NEW.bucket IS DISTINCT FROM OLD.bucket
      OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
      OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
      OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
      OR NEW.original_name IS DISTINCT FROM OLD.original_name
      OR NEW.file_type IS DISTINCT FROM OLD.file_type
      OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
    )
  THEN
    RAISE EXCEPTION 'Protected post files must be reopened before material changes'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_protected_post_file_mutation ON files;
CREATE TRIGGER trg_guard_protected_post_file_mutation
  BEFORE INSERT OR DELETE OR UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION guard_protected_post_file_mutation();

CREATE OR REPLACE FUNCTION guard_protected_post_soundtrack_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status VARCHAR(50);
  protected_parent_exists BOOLEAN;
  frozen_parent_exists BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.status
    INTO parent_status
    FROM posts p
    WHERE p.id = NEW.post_id
    FOR UPDATE;

    IF parent_status IN ('sent', 'pending_approval', 'approved', 'executed') THEN
      RAISE EXCEPTION 'Soundtracks cannot be added to a protected post before it is reopened'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT p.status
    INTO parent_status
    FROM posts p
    WHERE p.id = OLD.post_id
    FOR UPDATE;

    -- Preserve hard-delete cascades from posts/clients while rejecting a direct
    -- soundtrack deletion whose protected parent still exists.
    IF NOT FOUND THEN
      RETURN OLD;
    END IF;

    IF parent_status IN ('sent', 'pending_approval', 'approved', 'executed') THEN
      RAISE EXCEPTION 'Soundtracks cannot be removed from a protected post before it is reopened'
        USING ERRCODE = '23514';
    END IF;

    RETURN OLD;
  END IF;

  PERFORM 1
  FROM posts p
  WHERE p.id IN (OLD.post_id, NEW.post_id)
  ORDER BY p.id
  FOR UPDATE;

  SELECT EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.id IN (OLD.post_id, NEW.post_id)
      AND p.status IN ('sent', 'pending_approval', 'approved', 'executed')
  )
  INTO protected_parent_exists;

  SELECT EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.id IN (OLD.post_id, NEW.post_id)
      AND p.status IN ('approved', 'executed')
  )
  INTO frozen_parent_exists;

  IF frozen_parent_exists
    AND (
      NEW.approval_status IS DISTINCT FROM OLD.approval_status
      OR NEW.approved_content_revision IS DISTINCT FROM OLD.approved_content_revision
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.adjustment_requested_at IS DISTINCT FROM OLD.adjustment_requested_at
      OR NEW.adjustment_comment IS DISTINCT FROM OLD.adjustment_comment
    )
  THEN
    RAISE EXCEPTION 'Approved or executed post soundtrack decision is frozen until an explicit reopen'
      USING ERRCODE = '23514';
  END IF;

  IF protected_parent_exists
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.post_id IS DISTINCT FROM OLD.post_id
      OR NEW.mode IS DISTINCT FROM OLD.mode
      OR NEW.source_media_id IS DISTINCT FROM OLD.source_media_id
      OR NEW.track_name IS DISTINCT FROM OLD.track_name
      OR NEW.artist IS DISTINCT FROM OLD.artist
      OR NEW.external_url IS DISTINCT FROM OLD.external_url
      OR NEW.platform IS DISTINCT FROM OLD.platform
      OR NEW.start_time_seconds IS DISTINCT FROM OLD.start_time_seconds
      OR NEW.usage_source IS DISTINCT FROM OLD.usage_source
      OR NEW.usage_notes IS DISTINCT FROM OLD.usage_notes
      OR NEW.rights_notes IS DISTINCT FROM OLD.rights_notes
      OR NEW.audio_url IS DISTINCT FROM OLD.audio_url
      OR NEW.bucket IS DISTINCT FROM OLD.bucket
      OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
      OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
      OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
      OR NEW.original_name IS DISTINCT FROM OLD.original_name
      OR NEW.revision_number IS DISTINCT FROM OLD.revision_number
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    )
  THEN
    RAISE EXCEPTION 'Protected post soundtracks must be reopened before material changes'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_protected_post_soundtrack_mutation ON post_soundtracks;
CREATE TRIGGER trg_guard_protected_post_soundtrack_mutation
  BEFORE INSERT OR DELETE OR UPDATE ON post_soundtracks
  FOR EACH ROW
  EXECUTE FUNCTION guard_protected_post_soundtrack_mutation();

COMMENT ON COLUMN posts.content_revision IS
  'Monotonic material-content revision. Zero means no versioned approval cycle has been established.';

COMMENT ON COLUMN posts.approved_revision IS
  'Content revision certified by an append-only portal review decision; NULL for uncertified legacy approvals.';

COMMENT ON COLUMN posts.executed_revision IS
  'Approved content revision recorded at execution; legacy executed posts intentionally remain NULL.';

COMMENT ON COLUMN portal_item_review_drafts.content_revision IS
  'Material-content revision to which this provisional item decision belongs.';

COMMENT ON TABLE portal_review_decisions IS
  'Logical append-only history of official client review decisions. Multiple decisions may reference one content revision.';

COMMENT ON TABLE portal_review_actions IS
  'Logical append-only history of submission, resubmission, client rewind and agency reopen actions.';

COMMENT ON COLUMN post_soundtracks.approved_content_revision IS
  'Material-content revision for which the current soundtrack approval is valid; legacy approvals remain NULL.';

COMMENT ON COLUMN post_soundtrack_decisions.content_revision IS
  'Material-content revision reviewed by this soundtrack decision; legacy decisions remain NULL.';
