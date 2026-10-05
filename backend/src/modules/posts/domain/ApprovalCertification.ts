/** Shared by administrative/portal projections and the execution gate. Alias is internal, never user input. */
export function approvalSourceSql(alias = 'p') {
  return `CASE WHEN ${alias}.status IN ('approved', 'executed')
    AND ${alias}.content_revision > 0 AND ${alias}.approved_revision = ${alias}.content_revision THEN
    CASE WHEN EXISTS (
      SELECT 1 FROM portal_review_actions a
      JOIN portal_review_decisions origin ON origin.id = a.decision_id
      WHERE a.post_id = ${alias}.id AND a.content_revision = ${alias}.content_revision
        AND a.action = 'admin_approved' AND a.actor_role = 'admin' AND a.actor_id IS NOT NULL
        AND origin.post_id = ${alias}.id AND origin.client_id = ${alias}.client_id
        AND origin.decision = 'rejected' AND origin.content_revision = a.content_revision - 1
    ) THEN 'admin' WHEN (
      SELECT d.decision FROM portal_review_decisions d
      WHERE d.post_id = ${alias}.id AND d.content_revision = ${alias}.content_revision
        AND d.client_id = ${alias}.client_id
      ORDER BY d.review_sequence DESC LIMIT 1
    ) = 'approved' THEN 'client' ELSE NULL END ELSE NULL END`;
}
