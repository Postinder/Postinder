import { useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import PageHeader from '../../components/ui/PageHeader'
import { resetDemoData } from '../../services/maintenance.service'
import { useAuthStore } from '../../store/authStore'

export default function ResetDataPage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)

  const canReset = confirmation === 'RESETAR'

  async function handleReset() {
    if (!canReset) {
      toast.error('Digite RESETAR para confirmar.')
      return
    }
    if (!confirm('Isto vai apagar os dados de teste e restaurar os acessos padrao. Continuar?')) return

    setLoading(true)
    try {
      await resetDemoData(confirmation)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      logout()
      toast.success('Dados resetados. Entre novamente com o usuario padrao.')
      navigate('/login', { replace: true })
    } catch (error) {
      const unavailable = error.response?.status === 404
      toast.error(unavailable
        ? 'O reset nao esta disponivel neste ambiente.'
        : error.response?.data?.error || error.message || 'Nao foi possivel resetar os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={RotateCcw}
        title="Reset de testes"
        subtitle="Limpe os dados criados no ambiente de teste e restaure os acessos padrao."
      />

      <Card className="max-w-3xl p-6">
        <div className="flex items-start gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={22} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-extrabold">Esta acao apaga os dados de teste.</div>
            <p className="mt-1 text-sm leading-6">
              Serao removidos clientes, postagens, arquivos, aprovacoes, feedbacks, atividades,
              notificacoes e links de portal. Em seguida, o sistema recria o admin e o cliente padrao.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <div className="font-bold text-neutral-900 dark:text-white">Acessos restaurados</div>
            <div className="mt-2 text-neutral-500">
              Admin: <span className="font-semibold text-neutral-700 dark:text-neutral-200">admin@postinder.local</span> / <span className="font-semibold text-neutral-700 dark:text-neutral-200">Admin@123456</span>
            </div>
            <div className="mt-1 text-neutral-500">
              Cliente: <span className="font-semibold text-neutral-700 dark:text-neutral-200">cliente@example.com</span> / <span className="font-semibold text-neutral-700 dark:text-neutral-200">Cliente@123456</span>
            </div>
          </div>

          <Input
            label="Digite RESETAR para confirmar"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            placeholder="RESETAR"
          />

          <div className="flex justify-end">
            <Button
              onClick={handleReset}
              disabled={!canReset}
              loading={loading}
              icon={<RotateCcw size={16} />}
              className="bg-red-600 hover:bg-red-700"
            >
              Limpar dados de teste
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
