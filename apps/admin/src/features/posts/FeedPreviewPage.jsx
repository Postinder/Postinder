import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Grid } from 'lucide-react'
import { fetchPosts, computePostStatus } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import Card from '../../components/ui/Card'
import toast from 'react-hot-toast'

const STATUS_DOT = {
  draft:            'bg-neutral-300',
  pending_approval: 'bg-amber-400',
  approved:         'bg-green-500',
  rejected:         'bg-red-500',
}

export default function FeedPreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts]     = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  const filter = searchParams.get('client') || ''

  function setFilter(id) {
    if (id) setSearchParams({ client: id })
    else    setSearchParams({})
  }

  useEffect(() => {
    Promise.all([fetchPosts(), fetchClients()])
      .then(([p, c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter ? posts.filter(p => p.client_id === filter || p.clientId === filter) : posts

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Grid size={20} className="text-mag-500" />
        <h1 className="text-xl font-bold">Prévia do Feed</h1>
      </div>

      <div className="mb-5">
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none">
          <option value="">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-neutral-400">
          <div className="text-4xl mb-3">🖼️</div>
          <p className="text-sm">Nenhuma postagem encontrada.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 max-w-sm mb-4">
            {filtered.map(p => {
              const st  = computePostStatus(p)
              const url = p.files?.[0]?.url || p.files?.[0]?.storage_url
              return (
                <div key={p.id} title={p.title}
                  className="aspect-square relative bg-neutral-100 dark:bg-neutral-800 rounded overflow-hidden flex items-center justify-center">
                  {url
                    ? <img src={url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-2xl">{p.email_link ? '📧' : '🖼️'}</span>
                  }
                  <div className={`absolute top-1.5 right-1.5 w-3 h-3 rounded-full border-2 border-white shadow ${STATUS_DOT[st] || 'bg-neutral-400'}`} />
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 flex-wrap text-xs text-neutral-400">
            {[['bg-green-500','Aprovado'],['bg-red-500','Recusado'],['bg-amber-400','Aguardando'],['bg-neutral-300','Rascunho']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${c}`}/>{l}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
