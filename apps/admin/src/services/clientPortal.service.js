import { apiClient } from '../lib/axios'

function withExpectedRevision(expectedRevision, payload = {}, expectedReviewSequence = 0) {
  if (!Number.isInteger(expectedRevision) || expectedRevision <= 0) {
    throw new TypeError('expectedRevision must be a positive integer')
  }
  if (!Number.isInteger(expectedReviewSequence) || expectedReviewSequence < 0) throw new TypeError('Invalid review sequence')
  return { ...payload, expectedRevision, expectedReviewSequence }
}

function withPositiveReaction(payload, positiveReaction) {
  if (positiveReaction == null) return payload
  if (positiveReaction !== 'loved') throw new TypeError('positiveReaction must be loved when provided')
  return { ...payload, positiveReaction }
}

export function createClientPortalService(client = apiClient) {
  return {
    async fetchAuthenticatedPortal() {
      const { data } = await client.get('/client-portal')
      return data
    },

    async approveAuthenticatedPortalPost(postId, expectedRevision, positiveReaction = null, positiveFeedback = null, expectedReviewSequence = 0) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/approve`,
        withExpectedRevision(expectedRevision, withPositiveReaction({ positiveFeedback }, positiveReaction), expectedReviewSequence),
      )
      return data
    },

    async rejectAuthenticatedPortalPost(postId, comment, tags = [], expectedRevision, expectedReviewSequence = 0) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/reject`,
        withExpectedRevision(expectedRevision, { comment, tags }, expectedReviewSequence),
      )
      return data
    },

    async saveAuthenticatedPortalItemDecision(postId, fileId, decision, comment = '', tags = [], expectedRevision, positiveReaction = null, positiveFeedback = null, expectedReviewSequence = 0) {
      const { data } = await client.put(
        `/client-portal/posts/${postId}/items/${fileId}/decision`,
        withExpectedRevision(expectedRevision, withPositiveReaction({ decision, comment, tags, positiveFeedback }, positiveReaction), expectedReviewSequence),
      )
      return data
    },

    async completeAuthenticatedPortalItemReview(postId, expectedRevision, expectedReviewSequence = 0) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/complete-review`,
        withExpectedRevision(expectedRevision, {}, expectedReviewSequence),
      )
      return data
    },

    async reopenAuthenticatedPortalPost(postId, expectedRevision, expectedReviewSequence = 0, expectedDecisionId) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/reopen`,
        withExpectedRevision(expectedRevision, { expectedDecisionId }, expectedReviewSequence),
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

    async approveAuthenticatedPortalSoundtrack(postId, expectedRevision, expectedReviewSequence = 0) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/soundtrack/approve`,
        withExpectedRevision(expectedRevision, {}, expectedReviewSequence),
      )
      return data
    },

    async adjustAuthenticatedPortalSoundtrack(postId, comment, expectedRevision, expectedReviewSequence = 0) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/soundtrack/adjust`,
        withExpectedRevision(expectedRevision, { comment }, expectedReviewSequence),
      )
      return data
    },

    async resetAuthenticatedPortalSoundtrack(postId, expectedRevision, expectedReviewSequence = 0) {
      const { data } = await client.post(
        `/client-portal/posts/${postId}/soundtrack/reset`,
        withExpectedRevision(expectedRevision, {}, expectedReviewSequence),
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
