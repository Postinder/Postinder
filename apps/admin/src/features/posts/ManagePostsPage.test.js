import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeEmailPreviewUrl } from '../../utils/emailPreview.js'
import {
  canEditPostDirectly,
  canExecutePost,
  getBulkSelectionState,
  getBulkSendEligiblePosts,
  getPostEditingAction,
  getPostMutationErrorMessage,
  getSelectedBulkSendPosts,
  requiresPostReopenForEditing,
  toggleAllBulkSendPosts,
} from './postBulkSelection.js'

const managePostsSource = readFileSync(new URL('./ManagePostsPage.jsx', import.meta.url), 'utf8')
const newPostSource = readFileSync(new URL('./NewPostPage.jsx', import.meta.url), 'utf8')
const constantsSource = readFileSync(new URL('../../utils/constants.js', import.meta.url), 'utf8')
const channelIconSource = readFileSync(new URL('../../components/posts/ChannelIcon.jsx', import.meta.url), 'utf8')
const feedPreviewSource = readFileSync(new URL('./FeedPreviewPage.jsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('../dashboard/DashboardPage.jsx', import.meta.url), 'utf8')
const approvalsSource = readFileSync(new URL('../approvals/ApprovalsPage.jsx', import.meta.url), 'utf8')
const postsServiceSource = readFileSync(new URL('../../services/posts.service.js', import.meta.url), 'utf8')

test('post list strengthens secondary text hierarchy in dark mode', () => {
  assert.match(managePostsSource, /text-neutral-500 dark:text-neutral-300/)
  assert.match(managePostsSource, /text-neutral-400 dark:text-neutral-300\/80/)
  assert.match(managePostsSource, /dark:disabled:opacity-60/)
})

test('email preview accepts only trimmed HTTP URLs and remains editable with optional attachments', () => {
  assert.equal(normalizeEmailPreviewUrl('  https://example.test/preview  '), 'https://example.test/preview')
  assert.equal(normalizeEmailPreviewUrl('http://example.test'), 'http://example.test')
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'example.test']) {
    assert.equal(normalizeEmailPreviewUrl(value), null)
  }
  assert.match(newPostSource, /Link de pré-visualização do e-mail/)
  assert.match(newPostSource, /isEmailOnly/)
  assert.match(managePostsSource, /emailLink: hasEmail \? normalizedEmailLink : null/)
})

test('channel choices use controlled vector icons, remove 3A3R and preserve safe Instagram formats', () => {
  assert.doesNotMatch(constantsSource, /['"]3A3R['"]\s*:/)
  assert.doesNotMatch(constantsSource, /[📷💼🎵🎬📍📱🚀🌐📧]/u)
  assert.match(constantsSource, /formats: \['Card', 'Carrossel', 'Stories', 'Reels', 'Foto'\]/)
  assert.doesNotMatch(constantsSource, /formats: \[[^\]]*'Feed'/)
  assert.match(channelIconSource, /Instagram/)
  assert.match(channelIconSource, /Facebook/)
  assert.match(managePostsSource, /<ChannelIcon channel=\{channel\}/)
})

test('soundtrack controls follow the feature flag while attachment arrows remain', () => {
  assert.match(newPostSource, /settings\.features\.soundtrack \? \(/)
  assert.match(newPostSource, /<SoundtrackEditor/)
  assert.match(managePostsSource, /settings\.features\.soundtrack \? \(/)
  assert.match(managePostsSource, /<SoundtrackEditor/)
  assert.match(managePostsSource, /SortableAttachments/)
  assert.match(managePostsSource, /onMove=/)
  assert.doesNotMatch(feedPreviewSource, /SoundtrackEditor/)
  assert.match(feedPreviewSource, /Todos status/)
  assert.doesNotMatch(feedPreviewSource, /Todos os estados/)
})

test('post channel chips and actions remain distinct in dark mode', () => {
  assert.match(managePostsSource, /dark:ring-neutral-700\/70/)
  assert.match(managePostsSource, /dark:hover:text-mag-200/)
  assert.match(managePostsSource, /dark:hover:text-teal-100/)
  assert.match(managePostsSource, /dark:hover:text-blue-300/)
  assert.match(managePostsSource, /dark:hover:text-green-300/)
  assert.match(managePostsSource, /dark:hover:text-amber-300/)
  assert.match(managePostsSource, /dark:hover:text-red-300/)
})

const bulkPosts = [
  { id: 'draft', status: 'draft', clientId: 'a', files: [{ id: 'f1' }] },
  { id: 'ready', status: 'ready', clientId: 'a', channels: ['E-mail Marketing'], emailLink: 'https://example.test/email' },
  { id: 'rejected', status: 'rejected', clientId: 'b', files: [{ id: 'f2' }] },
  { id: 'pending', status: 'pending_approval', clientId: 'a', files: [{ id: 'f3' }] },
  { id: 'approved', status: 'approved', clientId: 'a', files: [{ id: 'f4' }] },
  { id: 'empty', status: 'ready', clientId: 'a', files: [] },
]
const statusOf = post => post.status

test('select all adds every eligible visible post and never adds ineligible records', () => {
  const eligible = getBulkSendEligiblePosts(bulkPosts, statusOf)
  assert.deepEqual(eligible.map(post => post.id), ['draft', 'ready'])
  assert.deepEqual(toggleAllBulkSendPosts([], eligible, true), ['draft', 'ready'])
})

test('select all can be cleared and reports partial selection as indeterminate', () => {
  const eligible = getBulkSendEligiblePosts(bulkPosts, statusOf)
  assert.deepEqual(getBulkSelectionState(eligible, ['draft']), {
    checked: false,
    indeterminate: true,
    selectedCount: 1,
  })
  assert.deepEqual(toggleAllBulkSendPosts(['draft', 'ready', 'outside-filter'], eligible, false), ['outside-filter'])
})

test('select all respects the filtered list and batch send receives exactly its selected eligible ids', () => {
  const filtered = bulkPosts.filter(post => post.clientId === 'a')
  const eligible = getBulkSendEligiblePosts(filtered, statusOf)
  const selected = toggleAllBulkSendPosts(['rejected'], eligible, true)
  assert.deepEqual(selected, ['rejected', 'draft', 'ready'])
  assert.deepEqual(
    getSelectedBulkSendPosts(filtered, selected, statusOf).map(post => post.id),
    ['draft', 'ready'],
  )
})

test('bulk eligibility mirrors the backend reviewable-content requirement', () => {
  const candidates = [
    { id: 'media', status: 'draft', files: [{ id: 'file' }] },
    { id: 'email', status: 'ready', channels: ['E-mail Marketing'], email_link: 'https://example.test/email' },
    { id: 'empty', status: 'ready', files: [] },
    { id: 'email-without-url', status: 'ready', channels: ['E-mail Marketing'] },
    { id: 'mixed-email', status: 'ready', channels: ['E-mail Marketing', 'Instagram'], emailLink: 'https://example.test/email' },
  ]
  assert.deepEqual(getBulkSendEligiblePosts(candidates, statusOf).map(post => post.id), ['media', 'email'])
})

test('master checkbox is wired to an indeterminate state and visible eligibility copy', () => {
  assert.match(managePostsSource, /selectAllRef\.current\.indeterminate = bulkSelectionState\.indeterminate/)
  assert.match(managePostsSource, /Selecionar todos/)
  assert.match(managePostsSource, /elegíveis nesta lista/)
})

test('raw post status controls edit, correction and explicit reopening independently from derived file state', () => {
  const cases = [
    [{ status: 'draft', files: [{ status: 'approved' }] }, 'edit'],
    [{ status: 'ready', files: [{ status: 'rejected' }] }, 'edit'],
    [{ status: 'rejected', files: [{ status: 'approved' }] }, 'resubmit'],
    [{ status: 'sent', files: [{ status: 'rejected' }] }, 'reopen'],
    [{ status: 'pending_approval', files: [{ status: 'approved' }] }, 'reopen'],
    [{ status: 'approved', soundtrack: { approval_status: 'adjustment_requested' } }, 'reopen'],
    [{ status: 'executed' }, 'blocked'],
    [{ status: 'unknown' }, 'blocked'],
    [null, 'blocked'],
  ]

  for (const [post, action] of cases) assert.equal(getPostEditingAction(post), action)
  assert.equal(canEditPostDirectly({ status: 'rejected' }), true)
  assert.equal(canEditPostDirectly({ status: 'approved' }), false)
  assert.equal(requiresPostReopenForEditing({ status: 'approved' }), true)
})

test('execute action requires a certified current approval seal', () => {
  assert.equal(canExecutePost({ status: 'approved', contentRevision: 0, approvedRevision: null }), false)
  assert.equal(canExecutePost({ status: 'approved', content_revision: 1, approved_revision: null }), false)
  assert.equal(canExecutePost({ status: 'approved', contentRevision: 2, approvedRevision: 1 }), false)
  assert.equal(canExecutePost({ status: 'approved', contentRevision: 2, approvedRevision: 2 }), true)
  assert.equal(canExecutePost({ status: 'approved', content_revision: 3, approved_revision: 3 }), true)
  assert.equal(canExecutePost({ status: 'executed', contentRevision: 3, approvedRevision: 3 }), false)
})

test('reopen-required backend conflicts receive actionable copy', () => {
  const error = { response: { status: 409, data: { code: 'POST_REOPEN_REQUIRED', error: 'raw' } } }
  assert.match(getPostMutationErrorMessage(error), /Reabrir para edição/)
  assert.equal(getPostMutationErrorMessage(new Error('Falhou')), 'Falhou')
})

test('manage and dashboard expose explicit reopen without allowing protected posts into editors', () => {
  assert.match(postsServiceSource, /\/posts\/\$\{postId\}\/reopen-for-editing/)
  assert.match(managePostsSource, /Reabrir para edição/)
  assert.match(managePostsSource, /canEditPostDirectly\(post\)/)
  assert.match(dashboardSource, /getPostEditingAction\(post\)/)
  assert.match(dashboardSource, /Reabrir para edição/)
  assert.match(dashboardSource, /if \(resubmitted\)/)
  assert.doesNotMatch(managePostsSource, /Este post ja foi aprovado\. Deseja alterar mesmo assim/)
  assert.doesNotMatch(managePostsSource, /Post aprovado: edite apenas se realmente precisar/)
})

test('approvals preserves resubmit only for raw rejected posts', () => {
  assert.match(approvalsSource, /getPostEditingAction\(post\) !== 'resubmit'/)
  assert.match(approvalsSource, /getPostEditingAction\(post\) === 'resubmit'/)
  assert.match(approvalsSource, /\['sent', 'pending_approval', 'rejected'\]\.includes\(getRawPostStatus\(post\)\)/)
})
