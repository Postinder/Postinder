import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const portalPageSource = readFileSync(new URL('./ClientPortalPage.jsx', import.meta.url), 'utf8')
const channelChipsSource = readFileSync(new URL('./PortalChannelChips.jsx', import.meta.url), 'utf8')
const contentSelectorSource = readFileSync(new URL('./PortalContentSelector.jsx', import.meta.url), 'utf8')
const metricsSource = readFileSync(new URL('./PortalMetricsBar.jsx', import.meta.url), 'utf8')
const reviewHeaderSource = readFileSync(new URL('./PortalReviewHeader.jsx', import.meta.url), 'utf8')
const soundtrackSource = readFileSync(new URL('./SoundtrackReviewCard.jsx', import.meta.url), 'utf8')
const reviewActionsSource = readFileSync(new URL('./PortalReviewActions.jsx', import.meta.url), 'utf8')

test('client portal strengthens secondary text hierarchy in dark mode', () => {
  assert.match(portalPageSource, /text-neutral-400 dark:text-neutral-300\/80/)
  assert.match(portalPageSource, /text-neutral-500 dark:text-neutral-300/)
  assert.match(contentSelectorSource, /dark:text-neutral-300\/80/)
  assert.match(metricsSource, /dark:text-neutral-300\/80/)
  assert.match(reviewHeaderSource, /dark:text-neutral-300\/80/)
  assert.match(soundtrackSource, /dark:text-neutral-300\/80/)
})

test('client portal chips gain definition without changing semantic actions', () => {
  assert.match(channelChipsSource, /dark:text-neutral-300/)
  assert.match(channelChipsSource, /dark:ring-neutral-700\/70/)
  assert.match(reviewActionsSource, /bg-green-600/)
  assert.match(reviewActionsSource, /bg-red-50/)
  assert.match(contentSelectorSource, /bg-amber-100/)
})
