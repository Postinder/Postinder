export const PORTAL_REVISION_CONFLICT_MESSAGE = 'Este conteúdo foi atualizado. Recarregamos a versão mais recente para você revisar antes de tentar novamente.'

export function getPostContentRevision(post) {
  const value = post?.contentRevision ?? post?.content_revision
  if (value === null || value === undefined || value === '') return null

  const revision = Number(value)
  return Number.isInteger(revision) && revision > 0 ? revision : null
}

export function isPortalRevisionConflict(error) {
  const status = Number(error?.response?.status)
  const code = String(error?.response?.data?.code || '').trim().toLowerCase()
  return status === 409 && code === 'revision_conflict'
}

export async function reloadAfterPortalRevisionConflict(error, reload) {
  if (!isPortalRevisionConflict(error)) return { handled: false, reloaded: false }

  try {
    await reload()
    return { handled: true, reloaded: true }
  } catch (reloadError) {
    return { handled: true, reloaded: false, reloadError }
  }
}
