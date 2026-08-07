export function applySoundtrackStartTime(audio, startTimeSeconds) {
  const start = Number(startTimeSeconds || 0)
  if (audio && start > 0 && Number.isFinite(audio.duration) && start < audio.duration) {
    audio.currentTime = start
  }
}

export async function playExclusiveSoundtrack(audio, soundtrackId, eventTarget = window) {
  eventTarget.dispatchEvent(new CustomEvent('postinder:soundtrack-play', { detail: soundtrackId }))
  await audio.play()
}

export function stopSoundtrack(audio) {
  audio?.pause()
}

export function toggleSoundtrackMute(audio) {
  if (!audio) return false
  audio.muted = !audio.muted
  return audio.muted
}

