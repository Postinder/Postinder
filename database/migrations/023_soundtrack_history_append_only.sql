CREATE OR REPLACE FUNCTION guard_append_only_soundtrack_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Soundtrack history is append-only'
      USING ERRCODE = '23514';
  END IF;

  -- A direct history deletion can only observe both FK parents. During a
  -- legitimate ON DELETE CASCADE, either the soundtrack aggregate or its post
  -- has already disappeared from this transaction's view.
  IF EXISTS (
    SELECT 1 FROM post_soundtracks soundtrack
    WHERE soundtrack.id = OLD.soundtrack_id
  ) AND EXISTS (
    SELECT 1 FROM posts post
    WHERE post.id = OLD.post_id
  ) THEN
    RAISE EXCEPTION 'Soundtrack history is append-only'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_post_soundtrack_versions_append_only
  ON post_soundtrack_versions;
CREATE TRIGGER trg_guard_post_soundtrack_versions_append_only
  BEFORE UPDATE OR DELETE ON post_soundtrack_versions
  FOR EACH ROW
  EXECUTE FUNCTION guard_append_only_soundtrack_history();

DROP TRIGGER IF EXISTS trg_guard_post_soundtrack_decisions_append_only
  ON post_soundtrack_decisions;
CREATE TRIGGER trg_guard_post_soundtrack_decisions_append_only
  BEFORE UPDATE OR DELETE ON post_soundtrack_decisions
  FOR EACH ROW
  EXECUTE FUNCTION guard_append_only_soundtrack_history();

COMMENT ON FUNCTION guard_append_only_soundtrack_history() IS
  'Rejects direct mutation of soundtrack history while preserving post and soundtrack hard-delete cascades.';
