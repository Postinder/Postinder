import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { resetPassword } from '../../services/auth.service'
import Button from '../../components/ui/Button'
import toast from 'react-hot-toast'

export default function RecoverPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.success('Link enviado! Verifique seu e-mail.')
    } catch {
      toast.error('Não foi possível enviar o link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at 60% 40%, #2a0014 0%, #0d0d0d 60%, #000 100%)' }}
    >
      <div className="w-full max-w-sm mx-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-10 animate-slide-up">
        <div className="text-center mb-8">
          <KeyRound size={36} className="text-mag-500 mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-white">Recuperar Senha</h1>
          <p className="text-neutral-500 text-xs mt-1">Enviaremos um link de redefinição</p>
        </div>
        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-neutral-500 mb-2">E-mail cadastrado</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-neutral-950 border border-neutral-700 focus:border-mag-500 rounded-xl px-4 py-3.5 text-white text-sm outline-none"
              />
            </div>
            <Button type="submit" className="w-full py-4" loading={loading}>Enviar link</Button>
          </form>
        ) : (
          <div className="text-center text-neutral-300 text-sm">
            ✅ Link enviado para <strong>{email}</strong>
          </div>
        )}
        <div className="text-center mt-4">
          <Link to="/login" className="text-xs text-neutral-500 hover:text-mag-400 transition-colors">← Voltar ao login</Link>
        </div>
      </div>
    </div>
  )
}
