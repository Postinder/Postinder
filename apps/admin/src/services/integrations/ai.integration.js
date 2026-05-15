// src/services/integrations/ai.integration.js
// ─────────────────────────────────────────────────────────────────
// INTEGRAÇÃO: Claude AI (Anthropic)
//
// Para ativar:
// 1. Acesse https://console.anthropic.com
// 2. Crie uma API Key
// 3. Adicione no .env: VITE_ANTHROPIC_API_KEY=sk-ant-...
//
// NOTA: Em produção, a chamada deve passar por um backend
// para não expor a chave no frontend.
// ─────────────────────────────────────────────────────────────────

import { isEnabled } from './registry'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL   = 'claude-sonnet-4-20250514'

// ── Core request ──
async function callClaude(systemPrompt, userPrompt, maxTokens = 1024) {
  if (!isEnabled('ai')) {
    throw new Error('IA não configurada. Adicione VITE_ANTHROPIC_API_KEY no .env')
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erro na API de IA: ${res.status}`)
  }

  const data = await res.json()
  return data.content[0]?.text || ''
}

// ── Parse JSON from AI response safely ──
function parseJSON(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// ANÁLISE 1: Resumo executivo de desempenho
// ─────────────────────────────────────────────────────────────────
export async function analyzePerformance({ posts, clients, period }) {
  const approved = posts.filter(p => p._status === 'approved').length
  const rejected = posts.filter(p => p._status === 'rejected').length
  const pending  = posts.filter(p => p._status === 'pending').length
  const total    = posts.length

  const clientStats = clients.map(c => {
    const cp = posts.filter(p => p.client_id === c.id)
    return { name: c.name, total: cp.length, approved: cp.filter(p => p._status === 'approved').length }
  })

  const system = `Você é um analista de desempenho para agências de comunicação.
Analise métricas de aprovação de conteúdo e forneça insights acionáveis em português do Brasil.
Seja objetivo, direto e use linguagem profissional mas acessível.
Responda APENAS em JSON válido, sem markdown extra.`

  const prompt = `Analise estas métricas de aprovação de conteúdo para o período: ${period}

Dados gerais:
- Total de posts: ${total}
- Aprovados: ${approved} (${total ? Math.round(approved/total*100) : 0}%)
- Reprovados: ${rejected} (${total ? Math.round(rejected/total*100) : 0}%)
- Pendentes: ${pending}

Por cliente: ${JSON.stringify(clientStats)}

Retorne JSON com esta estrutura exata:
{
  "score": 0-100,
  "classificacao": "Excelente|Bom|Regular|Atenção Necessária",
  "resumo": "2-3 frases sobre o desempenho geral",
  "pontos_fortes": ["ponto 1", "ponto 2"],
  "pontos_atencao": ["ponto 1", "ponto 2"],
  "recomendacoes": ["ação 1", "ação 2", "ação 3"],
  "cliente_destaque": "nome do cliente com melhor taxa",
  "cliente_atencao": "nome do cliente que precisa mais atenção"
}`

  const text = await callClaude(system, prompt, 800)
  return parseJSON(text) || { score: 0, resumo: text, recomendacoes: [] }
}

// ─────────────────────────────────────────────────────────────────
// ANÁLISE 2: Classificação de feedbacks
// ─────────────────────────────────────────────────────────────────
export async function classifyFeedbacks(feedbacks) {
  if (!feedbacks.length) return []

  const system = `Você classifica feedbacks de clientes sobre conteúdo de marketing em português.
Responda APENAS em JSON válido.`

  const prompt = `Classifique estes feedbacks de reprovação de conteúdo:

${feedbacks.map((f, i) => `${i+1}. Tags: [${(f.tags||[]).join(', ')}] | Comentário: "${f.comment || 'sem comentário'}"`).join('\n')}

Para cada feedback, retorne um array com objetos:
{
  "index": número,
  "sentimento": "negativo|neutro",
  "urgencia": "alta|media|baixa",
  "categoria": "visual|texto|estrategia|tecnico|outro",
  "resumo": "resumo de 1 linha do problema",
  "sugestao": "sugestão de correção objetiva"
}`

  const text = await callClaude(system, prompt, 1024)
  return parseJSON(text) || []
}

// ─────────────────────────────────────────────────────────────────
// ANÁLISE 3: Sugestão de estratégia de conteúdo
// ─────────────────────────────────────────────────────────────────
export async function suggestContentStrategy({ client, posts, feedbacks, period }) {
  const rejectedPosts = posts.filter(p => p._status === 'rejected')
  const approvalRate  = posts.length ? Math.round(posts.filter(p => p._status === 'approved').length / posts.length * 100) : 0
  const channels      = [...new Set(posts.flatMap(p => p.channels || []))]
  const rejTags       = feedbacks.flatMap(f => f.tags || [])
  const tagCounts     = rejTags.reduce((acc, t) => { acc[t] = (acc[t]||0)+1; return acc }, {})

  const system = `Você é um estrategista de conteúdo para agências de marketing digital.
Com base nos dados de aprovação, sugira melhorias estratégicas específicas para o cliente.
Use linguagem profissional e acionável. Responda APENAS em JSON válido.`

  const prompt = `Analise o histórico do cliente "${client.name}" (${client.segment || 'sem segmento definido'}):

- Taxa de aprovação: ${approvalRate}%
- Total de posts no período: ${posts.length}
- Posts reprovados: ${rejectedPosts.length}
- Canais utilizados: ${channels.join(', ')}
- Principais motivos de reprovação: ${JSON.stringify(tagCounts)}

Retorne JSON:
{
  "diagnostico": "análise em 2-3 frases do padrão de aprovação deste cliente",
  "pontos_criticos": ["problema 1", "problema 2"],
  "estrategia_canais": {
    "manter": ["canal 1"],
    "otimizar": ["canal 2"],
    "explorar": ["canal 3"]
  },
  "melhores_formatos": ["formato 1", "formato 2"],
  "dicas_aprovacao": ["dica 1", "dica 2", "dica 3"],
  "meta_proxima": "meta realista para o próximo mês"
}`

  const text = await callClaude(system, prompt, 900)
  return parseJSON(text) || { diagnostico: text }
}

// ─────────────────────────────────────────────────────────────────
// ANÁLISE 4: Resposta em chat livre sobre métricas
// ─────────────────────────────────────────────────────────────────
export async function chatWithMetrics(question, context) {
  const system = `Você é um assistente de análise de métricas para a agência 20Cinco Comunicação.
Responda perguntas sobre os dados de aprovação de conteúdo em português.
Seja conciso, analítico e ofereça insights práticos.
Contexto dos dados: ${JSON.stringify(context)}`

  return callClaude(system, question, 600)
}
