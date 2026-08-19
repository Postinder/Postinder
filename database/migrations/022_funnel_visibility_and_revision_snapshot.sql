ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS post_field_client_visibility JSONB NOT NULL
    DEFAULT '{"funnel_tag":false}'::jsonb;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS review_field_visibility JSONB NOT NULL
    DEFAULT '{"funnel_tag":false}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_settings_post_field_client_visibility_check'
      AND conrelid = 'platform_settings'::regclass
  ) THEN
    ALTER TABLE platform_settings
      ADD CONSTRAINT platform_settings_post_field_client_visibility_check
      CHECK (
        jsonb_typeof(post_field_client_visibility) = 'object'
        AND post_field_client_visibility ? 'funnel_tag'
        AND jsonb_typeof(post_field_client_visibility->'funnel_tag') = 'boolean'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_review_field_visibility_check'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_review_field_visibility_check
      CHECK (
        jsonb_typeof(review_field_visibility) = 'object'
        AND review_field_visibility ? 'funnel_tag'
        AND jsonb_typeof(review_field_visibility->'funnel_tag') = 'boolean'
      );
  END IF;
END $$;

-- The snapshot, rather than the current global setting, decides whether changing
-- funnel_tag would alter content already shown to the client.
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
      OR NEW.review_field_visibility IS DISTINCT FROM OLD.review_field_visibility
      OR (
        COALESCE((OLD.review_field_visibility->>'funnel_tag')::boolean, FALSE)
        AND NEW.funnel_tag IS DISTINCT FROM OLD.funnel_tag
      )
    )
  THEN
    RAISE EXCEPTION 'Protected post content must be reopened before material changes'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN platform_settings.post_field_client_visibility IS
  'Global client-visibility policy for configurable post fields. Hidden fields are effectively not visible.';

COMMENT ON COLUMN posts.review_field_visibility IS
  'Snapshot of configurable fields exposed to the client in the current submitted content revision.';
