export const PORTAL_SWIPE_ACTION_THRESHOLD = 90
export const PORTAL_SWIPE_MAX_OFFSET = 140
export const PORTAL_SWIPE_INTENT_THRESHOLD = 8

const HORIZONTAL_INTENT_RATIO = 1.2
const MIN_VIDEO_CONTROLS_HEIGHT = 44
const MAX_VIDEO_CONTROLS_HEIGHT = 64
const VIDEO_CONTROLS_HEIGHT_RATIO = 0.18

export function clampPortalSwipeOffset(offset) {
  return Math.max(-PORTAL_SWIPE_MAX_OFFSET, Math.min(PORTAL_SWIPE_MAX_OFFSET, offset))
}

export function getPortalSwipeIntent(deltaX, deltaY) {
  const horizontalDistance = Math.abs(deltaX)
  const verticalDistance = Math.abs(deltaY)

  if (Math.max(horizontalDistance, verticalDistance) < PORTAL_SWIPE_INTENT_THRESHOLD) return 'pending'
  if (horizontalDistance >= verticalDistance * HORIZONTAL_INTENT_RATIO) return 'horizontal'
  return 'vertical'
}

export function getPortalSwipeAction(offset) {
  if (offset >= PORTAL_SWIPE_ACTION_THRESHOLD) return 'approve'
  if (offset <= -PORTAL_SWIPE_ACTION_THRESHOLD) return 'reject'
  return null
}

export function isVideoControlsArea(clientY, videoTop, videoHeight) {
  if (![clientY, videoTop, videoHeight].every(Number.isFinite) || videoHeight <= 0) return false

  const estimatedControlsHeight = Math.min(
    videoHeight,
    Math.min(MAX_VIDEO_CONTROLS_HEIGHT, Math.max(MIN_VIDEO_CONTROLS_HEIGHT, videoHeight * VIDEO_CONTROLS_HEIGHT_RATIO)),
  )

  return clientY >= videoTop + videoHeight - estimatedControlsHeight
}
