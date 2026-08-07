import { apiClient } from '../../lib/axios.js'
import { createAIIntegrationClient } from './ai.core.js'

export {
  buildAggregateMetrics,
  buildChatPayload,
  buildPerformancePayload,
  createAIIntegrationClient,
} from './ai.core.js'

const aiClient = createAIIntegrationClient(apiClient)

export const analyzePerformance = aiClient.analyzePerformance
export const chatWithMetrics = aiClient.chatWithMetrics
