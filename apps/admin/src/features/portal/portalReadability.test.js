import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getPendingPortalProjects } from './portalStatus.js'

const portalPageSource = readFileSync(new URL('./ClientPortalPage.jsx', import.meta.url), 'utf8')
const channelChipsSource = readFileSync(new URL('./PortalChannelChips.jsx', import.meta.url), 'utf8')
const contentSelectorSource = readFileSync(new URL('./PortalContentSelector.jsx', import.meta.url), 'utf8')
const metricsSource = readFileSync(new URL('./PortalMetricsBar.jsx', import.meta.url), 'utf8')
const reviewHeaderSource = readFileSync(new URL('./PortalReviewHeader.jsx', import.meta.url), 'utf8')
const reviewActionsSource = readFileSync(new URL('./PortalReviewActions.jsx', import.meta.url), 'utf8')
const portalServicesSource = readFileSync(new URL('../../services/portal.service.js', import.meta.url), 'utf8')
const authenticatedPortalServicesSource = readFileSync(new URL('../../services/clientPortal.service.js', import.meta.url), 'utf8')

test('client portal strengthens secondary text hierarchy in dark mode', () => {
  assert.match(portalPageSource, /text-neutral-400 dark:text-neutral-300\/80/)
  assert.match(portalPageSource, /text-neutral-500 dark:text-neutral-300/)
  assert.match(contentSelectorSource, /dark:text-neutral-300\/80/)
  assert.match(metricsSource, /dark:text-neutral-300\/80/)
  assert.match(reviewHeaderSource, /dark:text-neutral-300\/80/)
})

test('portal defaults to a guided queue and restores peripheral navigation only in detailed mode', () => {
  assert.match(portalPageSource, /const showPostList = portalSettings\.show_post_list === true/)
  assert.match(portalPageSource, /const sequentialApproval = portalSettings\.sequential_approval !== false/)
  assert.match(portalPageSource, /showPostList=\{showPostList\}/)
  assert.match(portalPageSource, /sequentialApproval=\{sequentialApproval\}/)
  assert.match(portalPageSource, /: projects\[0\]/)
  assert.match(portalPageSource, /Tudo em dia/)
  assert.match(portalPageSource, /soundtrackEnabled && selectedProject\.soundtrack/)
})

test('guided queue preserves backend order and advances only after the post is officially concluded', () => {
  const posts = [
    { id: 'first', status: 'sent', files: [{ id: 'file-1', status: 'pending' }] },
    { id: 'second', status: 'sent', files: [], emailLink: 'https://example.test/email' },
    { id: 'done', status: 'approved', files: [], emailLink: 'https://example.test/done' },
  ]
  assert.deepEqual(getPendingPortalProjects(posts).map(post => post.id), ['first', 'second'])
  posts[0].files[0].status = 'approved'
  assert.deepEqual(getPendingPortalProjects(posts).map(post => post.id), ['first', 'second'])
  posts[0].status = 'approved'
  assert.deepEqual(getPendingPortalProjects(posts).map(post => post.id), ['second'])
  posts[1].status = 'rejected'
  assert.deepEqual(getPendingPortalProjects(posts), [])
})

test('portal exposes safe email preview and explicit attachment navigation without decision propagation', () => {
  assert.match(portalPageSource, /Abrir prévia do e-mail/)
  assert.match(portalPageSource, /rel="noopener noreferrer"/)
  assert.match(portalPageSource, /getSafeEmailPreviewUrl/)
  assert.match(portalPageSource, /aria-label="Anexo anterior"/)
  assert.match(portalPageSource, /aria-label="Próximo anexo"/)
  assert.match(portalPageSource, /event\.stopPropagation\(\)/)
  assert.match(portalPageSource, /canPrevious/)
  assert.match(portalPageSource, /canNext/)
})

test('client portal chips gain definition without changing semantic actions', () => {
  assert.match(channelChipsSource, /dark:text-neutral-300/)
  assert.match(channelChipsSource, /dark:ring-neutral-700\/70/)
  assert.match(reviewActionsSource, /bg-green-600/)
  assert.match(reviewActionsSource, /bg-red-50/)
  assert.match(contentSelectorSource, /bg-amber-100/)
})

test('item review is editable, navigable and only concludes after every draft decision', () => {
  assert.match(portalPageSource, /ReviewDots/)
  assert.match(portalPageSource, /aria-current/)
  assert.match(portalPageSource, /isItemReviewComplete\(files\)/)
  assert.match(portalPageSource, /disabled=\{!canCompleteItemReview \|\| busy\}/)
  assert.match(portalPageSource, /Concluir análise/)
  assert.match(portalServicesSource, /complete-review/)
  assert.match(reviewActionsSource, /aria-pressed=\{normallyApproved\}/)
  assert.match(reviewActionsSource, /aria-label="Adorei"/)
  assert.match(reviewActionsSource, /positiveReaction === 'loved'/)
  assert.match(reviewActionsSource, /aria-pressed=\{decision === 'rejected'\}/)
})

test('portal review mutations use the selected content revision and refresh stale state', () => {
  assert.match(portalPageSource, /getPostContentRevision\(posts\.find\(post => post\.id === projectId\)\)/)
  assert.match(portalPageSource, /reloadAfterPortalRevisionConflict\(error, reload\)/)
  assert.match(portalPageSource, /PORTAL_REVISION_CONFLICT_MESSAGE/)
  assert.match(portalPageSource, /return false/)
  assert.match(portalServicesSource, /withExpectedRevision\(expectedRevision/)
  assert.match(authenticatedPortalServicesSource, /withExpectedRevision\(expectedRevision/)
  assert.match(portalServicesSource, /soundtrack\/reset/)
  assert.match(authenticatedPortalServicesSource, /soundtrack\/reset/)
})

test('portal presents complete client-facing content without technical filenames', () => {
  assert.doesNotMatch(portalPageSource, />\{fileName\}</)
  assert.doesNotMatch(portalPageSource, /Ver mais|line-clamp-2 md:line-clamp-1/)
  assert.match(reviewHeaderSource, /Data de publicação:/)
  assert.match(channelChipsSource, /import ChannelIcon/)
  assert.match(reviewActionsSource, /Solicitar ajuste/)
})
