import { useState } from 'react'
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Lightbulb, MessageSquare, Send } from 'lucide-react'
import { analyzePerformance, chatWithMetrics } from '../../services/integrations/ai.integration'
import Card from '../ui/Card'
import Button from '../ui/Button'

function ScoreBadge({ score }) {
  const color = score >= 80 ? 'text-green-600 bg-green-50 dark:bg-green-950' :
                score >= 60 ? 'text-amber-600 bg-amber-50 dark:bg-amber-950' :
                              'text-red-600 bg-red-50 dark:bg-red-950'
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-lg ${color}`}>
      <span>{score}</span>
      <span className="text-sm font-normal">/100</span>
    </div>
  )
}

export default function AIInsightsPanel({ posts = [], clients = [], period = 'month' }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [chatMsg,  setChatMsg]  = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [chatLoading, setChatLoading] = useState(false)

  async function handleAnalyze() {
    setLoading(true)
    try {
      const result = await analyzePerformance({ posts, clients, period })
      setAnalysis(result)
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleChat() {
    if (!chatMsg.trim()) return
    const question = chatMsg.trim()
    setChatMsg('')
    setChatHistory(h => [...h, { role: 'user', text: question }])
    setChatLoading(true)
    try {
      const context = { posts, clients, period }
      const answer = await chatWithMetrics(question, context)
      setChatHistory(h => [...h, { role: 'ai', text: answer }])
    } catch (e) {
      setChatHistory(h => [...h, { role: 'ai', text: `Erro: ${e.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-mag-500" />
            <h3 className="font-bold">Análise com Inteligência Artificial</h3>
            <span className="text-xs bg-mag-100 dark:bg-mag-950 text-mag-600 dark:text-mag-300 px-2 py-0.5 rounded-full font-semibold">Claude AI</span>
          </div>
          <Button size="sm" icon={loading ? undefined : <RefreshCw size={14}/>} onClick={handleAnalyze} loading={loading}>
            {analysis ? 'Reanalisar' : 'Analisar agora'}
          </Button>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          Ao executar, sua pergunta, métricas agregadas e Clientes pseudonimizados serão processados pelo provedor de IA configurado.
        </p>
      </Card>

      {/* Analysis result */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Score + Summary */}
          <Card className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <ScoreBadge score={analysis.score} />
              <div>
                <div className="font-bold text-sm">{analysis.classificacao}</div>
                <div className="text-xs text-neutral-400">desempenho geral</div>
              </div>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{analysis.resumo}</p>
            {analysis.cliente_destaque && (
              <div className="mt-3 text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg">
                🏆 Destaque: <strong>{analysis.cliente_destaque}</strong>
              </div>
            )}
            {analysis.cliente_atencao && (
              <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg">
                ⚠️ Atenção: <strong>{analysis.cliente_atencao}</strong>
              </div>
            )}
          </Card>

          {/* Pontos fortes e atenção */}
          <Card className="p-5">
            {analysis.pontos_fortes?.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 text-green-600 font-semibold text-sm mb-2">
                  <TrendingUp size={14}/> Pontos fortes
                </div>
                <ul className="space-y-1">
                  {analysis.pontos_fortes.map((p, i) => (
                    <li key={i} className="text-sm text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.pontos_atencao?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-sm mb-2">
                  <AlertTriangle size={14}/> Pontos de atenção
                </div>
                <ul className="space-y-1">
                  {analysis.pontos_atencao.map((p, i) => (
                    <li key={i} className="text-sm text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Recomendações */}
          {analysis.recomendacoes?.length > 0 && (
            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center gap-1.5 text-mag-500 font-semibold text-sm mb-3">
                <Lightbulb size={14}/> Recomendações da IA
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {analysis.recomendacoes.map((r, i) => (
                  <div key={i} className="bg-mag-50 dark:bg-mag-950/30 rounded-xl p-3 text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="text-mag-500 font-bold mr-1">{i+1}.</span>{r}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Chat with metrics */}
      <Card className="p-5">
        <div className="flex items-center gap-1.5 font-semibold text-sm mb-4">
          <MessageSquare size={14} className="text-teal-500"/> Pergunte à IA sobre suas métricas
        </div>
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 mb-3 min-h-[100px] max-h-60 overflow-y-auto space-y-3">
          {chatHistory.length === 0 && (
            <p className="text-xs text-neutral-400 text-center pt-4">
              Ex: "Qual cliente tem mais recusas?" · "Como melhorar a taxa de aprovação?"
            </p>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-mag-500 text-white'
                  : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm text-neutral-400">
                Analisando<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={chatMsg}
            onChange={e => setChatMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
            placeholder="Faça uma pergunta sobre suas métricas..."
            className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500"
          />
          <Button size="sm" onClick={handleChat} loading={chatLoading} icon={<Send size={14}/>}>
            Enviar
          </Button>
        </div>
      </Card>
    </div>
  )
}
