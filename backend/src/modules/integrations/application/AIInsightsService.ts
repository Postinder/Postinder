import { AppException } from '../../../shared/exceptions/AppException'
import {
  AIInsightRequest,
  AIProvider,
  aiInsightRequestSchema,
  performanceInsightSchema,
} from '../domain/AIInsight'

function parseProviderJson(text: string): unknown {
  const normalized = text.replace(/```json|```/gi, '').trim()
  try {
    return JSON.parse(normalized)
  } catch {
    throw new AppException(
      'AI provider returned an invalid response',
      502,
      'UPSTREAM_INVALID_RESPONSE',
    )
  }
}

function buildPerformancePrompt(input: Extract<AIInsightRequest, { action: 'performance' }>) {
  return [
    `Período: ${input.period}`,
    `Total de postagens: ${input.metrics.totalPosts}`,
    `Aprovadas: ${input.metrics.approved}`,
    `Rejeitadas: ${input.metrics.rejected}`,
    `Pendentes: ${input.metrics.pending}`,
    `Quantidade de Clientes: ${input.metrics.clientCount}`,
    `Métricas pseudonimizadas por Cliente: ${JSON.stringify(input.metrics.clients)}`,
    '',
    'Retorne JSON com score (0-100), classificacao (Excelente, Bom, Regular ou Atenção Necessária),',
    'resumo, pontos_fortes, pontos_atencao, recomendacoes e, opcionalmente,',
    'cliente_destaque e cliente_atencao usando somente os rótulos recebidos.',
  ].join('\n')
}

function buildChatPrompt(input: Extract<AIInsightRequest, { action: 'chat' }>) {
  return [
    `Período: ${input.period}`,
    `Métricas agregadas: ${JSON.stringify({
      totalPosts: input.metrics.totalPosts,
      approved: input.metrics.approved,
      rejected: input.metrics.rejected,
      pending: input.metrics.pending,
      clientCount: input.metrics.clientCount,
    })}`,
    `Pergunta do usuário: ${input.question}`,
  ].join('\n')
}

export class AIInsightsService {
  constructor(private readonly provider: AIProvider) {}

  async generate(rawInput: unknown) {
    const input = aiInsightRequestSchema.parse(rawInput)

    if (input.action === 'performance') {
      const text = await this.provider.generate({
        system: [
          'Você analisa métricas agregadas de aprovação de conteúdo.',
          'Responda em português do Brasil e somente em JSON válido.',
          'Não tente identificar pessoas ou organizações.',
        ].join(' '),
        prompt: buildPerformancePrompt(input),
        maxTokens: 800,
      })

      const parsed = performanceInsightSchema.safeParse(parseProviderJson(text))
      if (!parsed.success) {
        throw new AppException(
          'AI provider returned an invalid response',
          502,
          'UPSTREAM_INVALID_RESPONSE',
        )
      }
      return { action: 'performance' as const, result: parsed.data }
    }

    const answer = await this.provider.generate({
      system: [
        'Você responde perguntas sobre métricas agregadas de aprovação de conteúdo.',
        'Seja conciso, profissional e não tente identificar pessoas ou organizações.',
      ].join(' '),
      prompt: buildChatPrompt(input),
      maxTokens: 600,
    })

    return { action: 'chat' as const, answer: answer.slice(0, 4000) }
  }
}
