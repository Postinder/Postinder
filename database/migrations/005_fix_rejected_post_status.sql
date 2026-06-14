UPDATE posts p
SET status = 'rejected',
    updated_at = NOW()
WHERE p.status = 'approved'
  AND EXISTS (
    SELECT 1
    FROM files f
    WHERE f.post_id = p.id
      AND f.status = 'rejected'
  );
