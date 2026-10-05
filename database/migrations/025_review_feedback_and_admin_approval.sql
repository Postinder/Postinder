ALTER TABLE portal_item_review_drafts ADD COLUMN IF NOT EXISTS positive_feedback TEXT;
ALTER TABLE portal_review_decisions ADD COLUMN IF NOT EXISTS positive_feedback TEXT;
ALTER TABLE portal_review_actions
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

CREATE OR REPLACE FUNCTION valid_positive_feedback(value TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  -- Match JavaScript trim whitespace, including non-breaking and Unicode spaces.
  SELECT value IS NULL OR (
    length(btrim(value, E' \t\n\r\f' || chr(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0
    AND char_length(value) <= 5000
  );
$$;

CREATE OR REPLACE FUNCTION valid_item_positive_feedback(snapshot JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item JSONB;
BEGIN
  IF jsonb_typeof(snapshot) <> 'array' THEN RETURN FALSE; END IF;
  FOR item IN SELECT jsonb_array_elements(snapshot) LOOP
    IF item ? 'positiveFeedback' AND item->'positiveFeedback' <> 'null'::jsonb THEN
      IF jsonb_typeof(item->'positiveFeedback') <> 'string'
        OR NOT valid_positive_feedback(item->>'positiveFeedback')
        OR (item->>'decision' = 'approved' AND item->>'positiveReaction' = 'loved') IS NOT TRUE
      THEN RETURN FALSE; END IF;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

ALTER TABLE portal_item_review_drafts
  ADD CONSTRAINT portal_item_review_drafts_positive_feedback_check CHECK (
    valid_positive_feedback(positive_feedback)
    AND (positive_feedback IS NULL OR (decision = 'approved' AND positive_reaction = 'loved') IS TRUE)
  );
ALTER TABLE portal_review_decisions
  ADD CONSTRAINT portal_review_decisions_positive_feedback_check CHECK (
    valid_positive_feedback(positive_feedback)
    AND (positive_feedback IS NULL OR
      (decision = 'approved' AND positive_reaction = 'loved' AND approval_mode = 'content') IS TRUE)
    AND valid_item_positive_feedback(item_snapshot)
  );

ALTER TABLE portal_review_actions DROP CONSTRAINT portal_review_actions_action_check;
ALTER TABLE portal_review_actions ADD CONSTRAINT portal_review_actions_action_check CHECK (
  action IN ('submitted', 'resubmitted', 'client_rewind', 'agency_reopen', 'soundtrack_reset', 'admin_approved')
);
ALTER TABLE portal_review_actions ADD CONSTRAINT portal_review_actions_admin_approval_check CHECK (
  action <> 'admin_approved' OR (
    content_revision > 0 AND actor_id IS NOT NULL AND actor_role = 'admin'
    AND decision_id IS NOT NULL AND justification IS NOT NULL
    AND valid_positive_feedback(justification)
    AND idempotency_key IS NOT NULL AND request_fingerprint IS NOT NULL
    AND request_fingerprint ~ '^[a-f0-9]{64}$'
  )
);
CREATE UNIQUE INDEX idx_portal_admin_approval_revision
  ON portal_review_actions(post_id, content_revision) WHERE action = 'admin_approved';
CREATE UNIQUE INDEX idx_portal_admin_approval_idempotency
  ON portal_review_actions(post_id, idempotency_key) WHERE action = 'admin_approved';

COMMENT ON COLUMN posts.approved_revision IS
  'Current revision certified by an official client decision or an admin_approved action; legacy uncertified approvals remain NULL.';
COMMENT ON COLUMN portal_review_actions.justification IS
  'Internal administrative justification; never exposed by client portal projections.';
COMMENT ON COLUMN portal_review_decisions.positive_feedback IS
  'Optional client praise bound to this immutable content-mode approved+loved decision.';
