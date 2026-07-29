import { z } from 'zod'

const metricCountSchema = z.number().int().min(0).max(1_000_000)

const clientMetricSchema = z.object({
  label: z.string().regex(/^Cliente [1-9]\d{0,2}$/),
  total: metricCountSchema,
  approved: metricCountSchema,
}).strict().refine(value => value.approved <= value.total, {
  message: 'Approved count cannot exceed total',
})

const aggregateMetricsSchema = z.object({
  totalPosts: metricCountSchema,
  approved: metricCountSchema,
  rejected: metricCountSchema,
  pending: metricCountSchema,
  clientCount: z.number().int().min(0).max(1000),
  clients: z.array(clientMetricSchema).max(100),
}).strict().refine(value =>
  value.approved + value.rejected + value.pending <= value.totalPosts,
{
  message: 'Status counts cannot exceed total posts',
})

const commonRequestFields = {
  period: z.enum(['week', 'month', 'year']),
  metrics: aggregateMetricsSchema,
}

export const aiInsightRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('performance'),
    ...commonRequestFields,
  }).strict(),
  z.object({
    action: z.literal('chat'),
    question: z.string().trim().min(1).max(500),
    ...commonRequestFields,
  }).strict(),
])

const shortText = z.string().trim().min(1).max(1000)
const listText = z.string().trim().min(1).max(300)
const clientLabel = z.string().regex(/^Cliente [1-9]\d{0,2}$/)

export const performanceInsightSchema = z.object({
  score: z.number().int().min(0).max(100),
  classificacao: z.enum(['Excelente', 'Bom', 'Regular', 'Atenção Necessária']),
  resumo: shortText,
  pontos_fortes: z.array(listText).max(5).default([]),
  pontos_atencao: z.array(listText).max(5).default([]),
  recomendacoes: z.array(listText).max(5).default([]),
  cliente_destaque: clientLabel.optional(),
  cliente_atencao: clientLabel.optional(),
}).strip()

export type AIInsightRequest = z.infer<typeof aiInsightRequestSchema>
export type PerformanceInsight = z.infer<typeof performanceInsightSchema>

export type AIProviderRequest = Readonly<{
  system: string
  prompt: string
  maxTokens: number
}>

export interface AIProvider {
  generate(request: AIProviderRequest): Promise<string>
}
