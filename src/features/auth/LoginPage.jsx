import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Flame } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { loginAdmin, loginClient } from '../../services/auth.service'
import Button from '../../components/ui/Button'
import ThemeToggle from '../../components/ui/ThemeToggle'
import toast from 'react-hot-toast'

// Particle animation
function Particles() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const items = []
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.cssText = `
        left:${Math.random()*100}%;bottom:${Math.random()*30}%;
        width:${2+Math.random()*4}px;height:${2+Math.random()*4}px;
        animation-duration:${3+Math.random()*4}s;
        animation-delay:${Math.random()*4}s;
      `
      c.appendChild(p)
      items.push(p)
    }
    return () => items.forEach(p => p.remove())
  }, [])
  return <div ref={ref} className="absolute inset-0 pointer-events-none" />
}

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) { toast.error('Preencha e-mail e senha.'); return }
    setLoading(true)
    try {
      // Try admin first, then client
      let user
      try {
        const res = await loginAdmin(email, password)
        user = res.user
        user.type = 'admin'
      } catch {
        const res = await loginClient(email, password)
        user = res
        user.type = 'client'
      }
      setUser(user)
      navigate(user.type === 'admin' ? '/admin/dashboard' : '/aprovar')
    } catch (err) {
      toast.error(err.message || 'E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 60% 40%, #2a0014 0%, #0d0d0d 60%, #000 100%)' }}
    >
      <Particles />

      {/* Theme toggle top-right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 animate-slide-up">
          {/* Logo */}
          <div className="text-center mb-8">
            <Flame size={36} className="text-mag-500 mx-auto mb-3 animate-float" />
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Post<span className="text-mag-500">inder</span>
            </h1>
            <p className="text-neutral-500 text-xs mt-1 tracking-wider">
              Plataforma de Aprovação de Conteúdo
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-neutral-500 mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full bg-neutral-950 border border-neutral-700 focus:border-mag-500 rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-colors placeholder:text-neutral-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-neutral-500 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-mag-500 rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-colors placeholder:text-neutral-600 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full py-4 text-base mt-2" loading={loading}>
              Entrar
            </Button>
          </form>

          <div className="text-center mt-4">
            <Link to="/recover" className="text-xs text-neutral-500 hover:text-mag-400 transition-colors">
              Esqueci minha senha
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
