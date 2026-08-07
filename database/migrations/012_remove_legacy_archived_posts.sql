-- Storage objects are removed first by backend/scripts/cleanupLegacyArchivedPosts.ts.
DELETE FROM activity_events
WHERE post_id IN (SELECT id FROM posts WHERE status = 'archived');

DO $$
BEGIN
  IF to_regclass('public.post_notes') IS NOT NULL THEN
    DELETE FROM post_notes
    WHERE post_id IN (SELECT id FROM posts WHERE status = 'archived');
  END IF;
END $$;

DELETE FROM posts WHERE status = 'archived';
