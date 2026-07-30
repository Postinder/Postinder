import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PORTAL_SWIPE_ACTION_THRESHOLD,
  PORTAL_SWIPE_INTENT_THRESHOLD,
  PORTAL_SWIPE_MAX_OFFSET,
  clampPortalSwipeOffset,
  getPortalSwipeAction,
  getPortalSwipeIntent,
  isVideoControlsArea,
} from './portalSwipe.js'

test('portal swipe preserves the official action threshold and maximum displacement', () => {
  assert.equal(PORTAL_SWIPE_ACTION_THRESHOLD, 90)
  assert.equal(PORTAL_SWIPE_MAX_OFFSET, 140)
  assert.equal(clampPortalSwipeOffset(200), 140)
  assert.equal(clampPortalSwipeOffset(-200), -140)
  assert.equal(clampPortalSwipeOffset(42), 42)
})

test('portal swipe distinguishes horizontal intent from clicks and vertical scrolling', () => {
  assert.equal(getPortalSwipeIntent(PORTAL_SWIPE_INTENT_THRESHOLD - 1, 0), 'pending')
  assert.equal(getPortalSwipeIntent(24, 4), 'horizontal')
  assert.equal(getPortalSwipeIntent(-24, 4), 'horizontal')
  assert.equal(getPortalSwipeIntent(4, 24), 'vertical')
  assert.equal(getPortalSwipeIntent(12, 11), 'vertical')
})

test('portal swipe maps only offsets beyond the official threshold to actions', () => {
  assert.equal(getPortalSwipeAction(89), null)
  assert.equal(getPortalSwipeAction(90), 'approve')
  assert.equal(getPortalSwipeAction(-89), null)
  assert.equal(getPortalSwipeAction(-90), 'reject')
})

test('portal swipe excludes the estimated native video controls area', () => {
  assert.equal(isVideoControlsArea(330, 100, 300), false)
  assert.equal(isVideoControlsArea(370, 100, 300), true)
  assert.equal(isVideoControlsArea(100, 100, 0), false)
})
