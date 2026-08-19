import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  EDITABLE_POST_STATUSES,
  REOPENABLE_POST_STATUSES,
  classifyPostMutation,
  isAgencyReopenAllowed,
  isMaterialMutationAllowed,
} from './PostMutationPolicy'
import { PostStatus } from './PostStatus'

test('material mutations are restricted to draft, ready and rejected posts', () => {
  assert.deepEqual(EDITABLE_POST_STATUSES, [
    PostStatus.DRAFT,
    PostStatus.READY,
    PostStatus.REJECTED,
  ])

  for (const status of EDITABLE_POST_STATUSES) {
    assert.equal(classifyPostMutation(status), 'editable')
    assert.equal(isMaterialMutationAllowed(status), true)
    assert.equal(isAgencyReopenAllowed(status), false)
  }
})

test('sent, pending approval and approved posts require an explicit agency reopen', () => {
  assert.deepEqual(REOPENABLE_POST_STATUSES, [
    PostStatus.SENT,
    PostStatus.PENDING_APPROVAL,
    PostStatus.APPROVED,
  ])

  for (const status of REOPENABLE_POST_STATUSES) {
    assert.equal(classifyPostMutation(status), 'reopen_required')
    assert.equal(isMaterialMutationAllowed(status), false)
    assert.equal(isAgencyReopenAllowed(status), true)
  }
})

test('executed posts are immutable and cannot be reopened', () => {
  assert.equal(classifyPostMutation(PostStatus.EXECUTED), 'executed')
  assert.equal(isMaterialMutationAllowed(PostStatus.EXECUTED), false)
  assert.equal(isAgencyReopenAllowed(PostStatus.EXECUTED), false)
})

test('scheduled, published and unknown states are unsupported and blocked', () => {
  for (const status of [PostStatus.SCHEDULED, PostStatus.PUBLISHED, 'archived', '', null, undefined]) {
    assert.equal(classifyPostMutation(status), 'unsupported')
    assert.equal(isMaterialMutationAllowed(status), false)
    assert.equal(isAgencyReopenAllowed(status), false)
  }
})

test('every declared post status has an explicit mutation classification', () => {
  const expected = new Map<PostStatus, ReturnType<typeof classifyPostMutation>>([
    [PostStatus.DRAFT, 'editable'],
    [PostStatus.READY, 'editable'],
    [PostStatus.SENT, 'reopen_required'],
    [PostStatus.PENDING_APPROVAL, 'reopen_required'],
    [PostStatus.APPROVED, 'reopen_required'],
    [PostStatus.REJECTED, 'editable'],
    [PostStatus.EXECUTED, 'executed'],
    [PostStatus.SCHEDULED, 'unsupported'],
    [PostStatus.PUBLISHED, 'unsupported'],
  ])

  for (const status of Object.values(PostStatus)) {
    assert.equal(classifyPostMutation(status), expected.get(status))
  }
})

test('migration guards every material child mutation while preserving operational updates and hard-delete cascades', () => {
  const migration = readFileSync(
    path.resolve(process.cwd(), '..', 'database', 'migrations', '021_content_revision_and_review_history.sql'),
    'utf8',
  )
  const funnelMigration = readFileSync(
    path.resolve(process.cwd(), '..', 'database', 'migrations', '022_funnel_visibility_and_revision_snapshot.sql'),
    'utf8',
  )
  const protectedStatuses = /'sent', 'pending_approval', 'approved', 'executed'/

  const postGuard = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION guard_protected_post_material_update()'),
    migration.indexOf('CREATE OR REPLACE FUNCTION guard_protected_post_file_mutation()'),
  )
  assert.match(postGuard, protectedStatuses)
  for (const field of ['client_id', 'company_id', 'title', 'description', 'channels', 'formats', 'scheduled_date', 'email_link', 'content_revision']) {
    assert.match(postGuard, new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`))
  }
  assert.doesNotMatch(postGuard, /NEW\.funnel_tag IS DISTINCT FROM OLD\.funnel_tag/)
  assert.match(postGuard, /DROP TRIGGER IF EXISTS trg_guard_protected_post_material_update ON posts/)
  assert.match(postGuard, /BEFORE UPDATE ON posts/)

  const fileGuard = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION guard_protected_post_file_mutation()'),
    migration.indexOf('CREATE OR REPLACE FUNCTION guard_protected_post_soundtrack_mutation()'),
  )
  assert.match(fileGuard, protectedStatuses)
  assert.match(fileGuard, /TG_OP = 'INSERT'/)
  assert.match(fileGuard, /TG_OP = 'DELETE'/)
  assert.match(fileGuard, /IF NOT FOUND THEN\s+RETURN OLD/)
  for (const field of ['post_id', 'url', 'bucket', 'storage_path', 'mime_type', 'size_bytes', 'original_name', 'file_type', 'sort_order']) {
    assert.match(fileGuard, new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`))
  }
  for (const frozen of ['status', 'rejection_reason', 'rejection_tags']) {
    assert.match(fileGuard, new RegExp(`NEW\.${frozen} IS DISTINCT FROM OLD\.${frozen}`))
  }
  for (const allowed of ['storage_deleted_at', 'storage_delete_error']) {
    assert.doesNotMatch(fileGuard, new RegExp(`NEW\\.${allowed} IS DISTINCT FROM OLD\\.${allowed}`))
  }
  assert.match(fileGuard, /DROP TRIGGER IF EXISTS trg_guard_protected_post_file_mutation ON files/)
  assert.match(fileGuard, /BEFORE INSERT OR DELETE OR UPDATE ON files/)

  const soundtrackGuard = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION guard_protected_post_soundtrack_mutation()'),
    migration.indexOf('COMMENT ON COLUMN posts.content_revision'),
  )
  assert.match(soundtrackGuard, protectedStatuses)
  assert.match(soundtrackGuard, /TG_OP = 'INSERT'/)
  assert.match(soundtrackGuard, /TG_OP = 'DELETE'/)
  assert.match(soundtrackGuard, /IF NOT FOUND THEN\s+RETURN OLD/)
  for (const field of [
    'post_id', 'mode', 'source_media_id', 'track_name', 'audio_url', 'rights_notes',
    'start_time_seconds', 'revision_number', 'deleted_at',
  ]) {
    assert.match(soundtrackGuard, new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`))
  }
  for (const frozen of [
    'approval_status', 'approved_at', 'adjustment_requested_at', 'adjustment_comment',
    'approved_content_revision',
  ]) {
    assert.match(soundtrackGuard, new RegExp(`NEW\.${frozen} IS DISTINCT FROM OLD\.${frozen}`))
  }
  for (const allowed of ['storage_deleted_at', 'storage_delete_error', 'updated_at']) {
    assert.doesNotMatch(soundtrackGuard, new RegExp(`NEW\\.${allowed} IS DISTINCT FROM OLD\\.${allowed}`))
  }
  assert.match(soundtrackGuard, /DROP TRIGGER IF EXISTS trg_guard_protected_post_soundtrack_mutation ON post_soundtracks/)
  assert.match(soundtrackGuard, /BEFORE INSERT OR DELETE OR UPDATE ON post_soundtracks/)

  assert.match(migration, /CREATE OR REPLACE FUNCTION guard_append_only_portal_history\(\)/)
  assert.match(migration, /BEFORE UPDATE OR DELETE ON portal_review_decisions/)
  assert.match(migration, /BEFORE UPDATE OR DELETE ON portal_review_actions/)

  const conditionalFunnelGuard = funnelMigration.slice(
    funnelMigration.indexOf('CREATE OR REPLACE FUNCTION guard_protected_post_material_update()'),
    funnelMigration.indexOf('COMMENT ON COLUMN platform_settings.post_field_client_visibility'),
  )
  assert.match(conditionalFunnelGuard, /NEW\.review_field_visibility IS DISTINCT FROM OLD\.review_field_visibility/)
  assert.match(conditionalFunnelGuard, /OLD\.review_field_visibility->>'funnel_tag'/)
  assert.match(conditionalFunnelGuard, /AND NEW\.funnel_tag IS DISTINCT FROM OLD\.funnel_tag/)
})
