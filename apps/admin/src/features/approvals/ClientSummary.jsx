import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'
import { fetchClientQueue } from '../../services/approvals.service'

export default function ClientSummary() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [approved, setApproved] = useState([])

  useEffect(() => {
    fetchClientQueue(user.id).then(q => {
      // get all approved from the full post list
    })
  }, [])

  return (
    <div>
      <button onClick={() => navigate('/aprovar')} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-mag-500 mb-4 transition-colors">
        <ArrowLeft size={16} /> Voltar
      </button>
      <h2 className="text-xl font-bold mb-4">Conteúdos Aprovados</h2>
      {approved.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <div className="text-4xl mb-3">📭</div>
          <p>Nenhum conteúdo aprovado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {approved.map((item, i) => (
            <div key={i} className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden relative">
              {item.file?.storage_url
                ? <img src={item.file.storage_url} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
              }
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 truncate">
                {item.post?.title}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
