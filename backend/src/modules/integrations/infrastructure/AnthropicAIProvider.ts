import { Environment } from '../../../config/environment'
import { AppException } from '../../../shared/exceptions/AppException'
import { AIProvider, AIProviderRequest } from '../domain/AIInsight'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_UPSTREAM_BODY_LENGTH = 100_000
const MAX_RESPONSE_TEXT_LENGTH = 20_000
const ALLOWED_MODELS = new Set([DEFAULT_MODEL])

type FetchImplementation = typeof fetch

type AnthropicProviderOptions = Readonly<{
  apiKey?: string
  model?: string
  timeoutMs?: string | number
}>

type ResolvedConfig = Readonly<{
  apiKey: string
  model: string
  timeoutMs: number
}>

function resolveConfig(options: AnthropicProviderOptions): ResolvedConfig | null {
  const apiKey = options.apiKey?.trim()
  const model = options.model?.trim() || DEFAULT_MODEL
  const timeoutMs = typeof options.timeoutMs === 'number'
    ? options.timeoutMs
    : Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)

  if (!apiKey || !ALLOWED_MODELS.has(model)) return null
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30_000) return null

  return { apiKey, model, timeoutMs }
}

export function anthropicOptionsFromEnvironment(environment: Environment): AnthropicProviderOptions {
  return {
    apiKey: environment.ANTHROPIC_API_KEY,
    model: environment.ANTHROPIC_MODEL,
    timeoutMs: environment.ANTHROPIC_TIMEOUT_MS,
  }
}

export class AnthropicAIProvider implements AIProvider {
  private readonly config: ResolvedConfig | null

  constructor(
    options: AnthropicProviderOptions,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {
    this.config = resolveConfig(options)
  }

  async generate(request: AIProviderRequest): Promise<string> {
    if (!this.config) {
      throw new AppException(
        'AI integration unavailable',
        503,
        'INTEGRATION_UNAVAILABLE',
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await this.fetchImplementation(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new AppException('AI provider unavailable', 502, 'UPSTREAM_ERROR')
      }

      const rawBody = await response.text()
      if (rawBody.length > MAX_UPSTREAM_BODY_LENGTH) {
        throw new AppException('AI provider returned an invalid response', 502, 'UPSTREAM_INVALID_RESPONSE')
      }

      let body: unknown
      try {
        body = JSON.parse(rawBody)
      } catch {
        throw new AppException('AI provider returned an invalid response', 502, 'UPSTREAM_INVALID_RESPONSE')
      }

      const content = (body as any)?.content
      const text = Array.isArray(content)
        ? content.find(item => item?.type === 'text' && typeof item?.text === 'string')?.text
        : undefined

      if (
        typeof text !== 'string'
        || text.trim().length === 0
        || text.length > MAX_RESPONSE_TEXT_LENGTH
      ) {
        throw new AppException('AI provider returned an invalid response', 502, 'UPSTREAM_INVALID_RESPONSE')
      }

      return text.trim()
    } catch (error) {
      if (error instanceof AppException) throw error
      if (controller.signal.aborted || (error as any)?.name === 'AbortError') {
        throw new AppException('AI provider timed out', 504, 'UPSTREAM_TIMEOUT')
      }
      throw new AppException('AI provider unavailable', 502, 'UPSTREAM_ERROR')
    } finally {
      clearTimeout(timeout)
    }
  }
}
