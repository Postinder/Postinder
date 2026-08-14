ALTER TABLE portal_item_review_drafts
  ADD COLUMN IF NOT EXISTS positive_reaction VARCHAR(20);

ALTER TABLE portal_review_decisions
  ADD COLUMN IF NOT EXISTS positive_reaction VARCHAR(20),
  ADD COLUMN IF NOT EXISTS item_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'portal_item_review_drafts_positive_reaction_check'
      AND conrelid = 'portal_item_review_drafts'::regclass
  ) THEN
    ALTER TABLE portal_item_review_drafts
      ADD CONSTRAINT portal_item_review_drafts_positive_reaction_check
      CHECK (
        positive_reaction IS NULL
        OR (decision = 'approved' AND positive_reaction = 'loved')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'portal_review_decisions_positive_reaction_check'
      AND conrelid = 'portal_review_decisions'::regclass
  ) THEN
    ALTER TABLE portal_review_decisions
      ADD CONSTRAINT portal_review_decisions_positive_reaction_check
      CHECK (
        positive_reaction IS NULL
        OR (
          decision = 'approved'
          AND approval_mode = 'content'
          AND positive_reaction = 'loved'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'portal_review_decisions_item_snapshot_check'
      AND conrelid = 'portal_review_decisions'::regclass
  ) THEN
    ALTER TABLE portal_review_decisions
      ADD CONSTRAINT portal_review_decisions_item_snapshot_check
      CHECK (
        jsonb_typeof(item_snapshot) = 'array'
        AND (approval_mode = 'item' OR item_snapshot = '[]'::jsonb)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portal_review_decisions_positive_reaction
  ON portal_review_decisions (client_id, decided_at DESC)
  WHERE positive_reaction = 'loved';

COMMENT ON COLUMN portal_item_review_drafts.positive_reaction IS
  'Optional positive signal for an approved provisional item. NULL is a normal approval; loved represents Adorei.';

COMMENT ON COLUMN portal_review_decisions.positive_reaction IS
  'Optional positive signal for a content-mode approval. Operational decision remains approved.';

COMMENT ON COLUMN portal_review_decisions.item_snapshot IS
  'Immutable item-mode completion snapshot, including each item positive_reaction when present.';
