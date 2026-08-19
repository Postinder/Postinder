import { apiClient } from '../lib/axios'

function withExpectedRevision(expectedRevision, payload = {}) {
  if (!Number.isInteger(expectedRevision) || expectedRevision <= 0) {
    throw new TypeError('expectedRevision must be a positive integer')
  }
  return { ...payload, expectedRevision }
}

function withPositiveReaction(payload, positiveReaction) {
  if (positiveReaction == null) return payload
  if (positiveReaction !== 'loved') throw new TypeError('positiveReaction must be loved when provided')
  return { ...payload, positiveReaction }
}

export function createPortalService(client = apiClient) {
  return {
    async fetchPortal(token) {
      const { data } = await client.get(`/portal/${token}`)
      return data
    },

    async approvePortalPost(token, postId, expectedRevision, positiveReaction = null) {
      const { data } = await client.post(
        `/portal/${token}/posts/${postId}/approve`,
        withExpectedRevision(expectedRevision, withPositiveReaction({}, positiveReaction)),
      )
      return data
    },

    async rejectPortalPost(token, postId, comment, tags = [], expectedRevision) {
      const { data } = await client.post(
        `/portal/${token}/posts/${postId}/reject`,
        withExpectedRevision(expectedRevision, { comment, tags }),
      )
      return data
    },

    async savePortalItemDecision(token, postId, fileId, decision, comment = '', tags = [], expectedRevision, positiveReaction = null) {
      const { data } = await client.put(
        `/portal/${token}/posts/${postId}/items/${fileId}/decision`,
        withExpectedRevision(expectedRevision, withPositiveReaction({ decision, comment, tags }, positiveReaction)),
      )
      return data
    },

    async completePortalItemReview(token, postId, expectedRevision) {
      const { data } = await client.post(
        `/portal/${token}/posts/${postId}/complete-review`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },

    async reopenPortalPost(token, postId, expectedRevision) {
      const { data } = await client.post(
        `/portal/${token}/posts/${postId}/reopen`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },

    async sendPortalFeedback(token, payload) {
      const { data } = await client.post(`/portal/${token}/feedback`, payload)
      return data
    },

    async approvePortalFile(token, fileId) {
      const { data } = await client.post(`/portal/${token}/files/${fileId}/approve`)
      return data
    },

    async rejectPortalFile(token, fileId, comment, tags = []) {
      const { data } = await client.post(`/portal/${token}/files/${fileId}/reject`, { comment, tags })
      return data
    },

    async resetPortalFile(token, fileId) {
      const { data } = await client.post(`/portal/${token}/files/${fileId}/reset`)
      return data
    },

    async updatePortalFileFeedback(token, fileId, comment, tags = []) {
      const { data } = await client.patch(`/portal/${token}/files/${fileId}/feedback`, { comment, tags })
      return data
    },

    async approvePortalSoundtrack(token, postId, expectedRevision) {
      const { data } = await client.post(
        `/portal/${token}/posts/${postId}/soundtrack/approve`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },

    async adjustPortalSoundtrack(token, postId, comment, expectedRevision) {
      const { data } = await client.post(
        `/portal/${token}/posts/${postId}/soundtrack/adjust`,
        withExpectedRevision(expectedRevision, { comment }),
      )
      return data
    },

    async resetPortalSoundtrack(token, postId, expectedRevision) {
      const { data } = await client.post(
        `/portal/${token}/posts/${postId}/soundtrack/reset`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },
  }
}

const portalService = createPortalService()

export const {
  fetchPortal,
  approvePortalPost,
  rejectPortalPost,
  savePortalItemDecision,
  completePortalItemReview,
  reopenPortalPost,
  sendPortalFeedback,
  approvePortalFile,
  rejectPortalFile,
  resetPortalFile,
  updatePortalFileFeedback,
  approvePortalSoundtrack,
  adjustPortalSoundtrack,
  resetPortalSoundtrack,
} = portalService
