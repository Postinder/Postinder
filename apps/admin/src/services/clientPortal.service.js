import { apiClient } from '../lib/axios'

function withExpectedRevision(expectedRevision, payload = {}) {
  if (!Number.isInteger(expectedRevision) || expectedRevision <= 0) {
    throw new TypeError('expectedRevision must be a positive integer')
  }
  return { ...payload, expectedRevision }
}

export function createClientPortalService(client = apiClient) {
  return {
    async fetchAuthenticatedPortal() {
      const { data } = await client.get('/client-portal')
      return data
    },

    async approveAuthenticatedPortalPost(postId, expectedRevision) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/approve`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },

    async rejectAuthenticatedPortalPost(postId, comment, tags = [], expectedRevision) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/reject`,
        withExpectedRevision(expectedRevision, { comment, tags }),
      )
      return data
    },

    async saveAuthenticatedPortalItemDecision(postId, fileId, decision, comment = '', tags = [], expectedRevision) {
      const { data } = await client.put(
        `/client-portal/posts/${postId}/items/${fileId}/decision`,
        withExpectedRevision(expectedRevision, { decision, comment, tags }),
      )
      return data
    },

    async completeAuthenticatedPortalItemReview(postId, expectedRevision) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/complete-review`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },

    async reopenAuthenticatedPortalPost(postId, expectedRevision) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/reopen`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },

    async sendAuthenticatedPortalFeedback(payload) {
      const { data } = await client.post('/client-portal/feedback', payload)
      return data
    },

    async approveAuthenticatedPortalFile(fileId) {
      const { data } = await client.post(`/client-portal/files/${fileId}/approve`)
      return data
    },

    async rejectAuthenticatedPortalFile(fileId, comment, tags = []) {
      const { data } = await client.post(`/client-portal/files/${fileId}/reject`, { comment, tags })
      return data
    },

    async resetAuthenticatedPortalFile(fileId) {
      const { data } = await client.post(`/client-portal/files/${fileId}/reset`)
      return data
    },

    async updateAuthenticatedPortalFileFeedback(fileId, comment, tags = []) {
      const { data } = await client.patch(`/client-portal/files/${fileId}/feedback`, { comment, tags })
      return data
    },

    async approveAuthenticatedPortalSoundtrack(postId, expectedRevision) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/soundtrack/approve`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },

    async adjustAuthenticatedPortalSoundtrack(postId, comment, expectedRevision) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/soundtrack/adjust`,
        withExpectedRevision(expectedRevision, { comment }),
      )
      return data
    },

    async resetAuthenticatedPortalSoundtrack(postId, expectedRevision) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/soundtrack/reset`,
        withExpectedRevision(expectedRevision),
      )
      return data
    },
  }
}

const clientPortalService = createClientPortalService()

export const {
  fetchAuthenticatedPortal,
  approveAuthenticatedPortalPost,
  rejectAuthenticatedPortalPost,
  saveAuthenticatedPortalItemDecision,
  completeAuthenticatedPortalItemReview,
  reopenAuthenticatedPortalPost,
  sendAuthenticatedPortalFeedback,
  approveAuthenticatedPortalFile,
  rejectAuthenticatedPortalFile,
  resetAuthenticatedPortalFile,
  updateAuthenticatedPortalFileFeedback,
  approveAuthenticatedPortalSoundtrack,
  adjustAuthenticatedPortalSoundtrack,
  resetAuthenticatedPortalSoundtrack,
} = clientPortalService
