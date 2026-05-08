import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { createPost } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import { CHANNELS, FUNNEL_TAGS, CLIENT_COLORS } from '../../utils/constants'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input, { Textarea, Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { buildApprovalLink } from '../../utils/constants'
import { Copy, Check, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NewPostPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [clients, setClients] = useState([])
  const [files,   setFiles]   = useState([])
  const [selChannels, setSelChannels] = useState({})
  const [selFormats,  setSelFormats]  = useState({})
  const [funnelTag,   setFunnelTag]   = useState('')
  const [emailLink,   setEmailLink]   = useState('')
  const [form, setForm] = useState({ title:'', clientId:'', scheduledDate:'', caption:'' })
  const [loading, setLoading] = useState(false)
  const [linkModal, setLinkModal] = useState({ open:false, link:'' })
  const [copied, setCopied] = useState(false)

  useEffect(()=>{ fetchClients().then(setClients).catch(()=>{}) },[])

  const isEmail = !!selChannels['E-mail Marketing']
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  function toggleChannel(ch) {
    const chanData = CHANNELS[ch]
    if (chanData.exclusive) {
      if (selChannels[ch]) { const n={...selChannels}; delete n[ch]; setSelChannels(n) }
      else { setSelChannels({[ch]:true}); setSelFormats({}) }
    } else {
      if (selChannels['E-mail Marketing']) return
      const n = {...selChannels}
      if (n[ch]) { delete n[ch]; const f2={...selFormats}; delete f2[ch]; setSelFormats(f2) }
      else { n[ch]=true }
      setSelChannels(n)
    }
  }

  function toggleFormat(ch, fmt) {
    const cur = selFormats[ch] || []
    setSelFormats(f=>({...f, [ch]: cur.includes(fmt) ? cur.filter(x=>x!==fmt) : [...cur, fmt]}))
  }

  function handleFiles(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(f => [...f, ...newFiles])
  }

  function handleDrop(e) {
    e.preventDefault()
    const newFiles = Array.from(e.dataTransfer.files)
    setFiles(f => [...f, ...newFiles])
  }

  async function handleSave() {
    const chs = Object.keys(selChannels)
    if (!form.title || !form.clientId || !chs.length) { toast.error('Preencha título, cliente e ao menos um canal.'); return }
    if (isEmail && !emailLink) { toast.error('Adicione o link do e-mail marketing.'); return }
    if (!isEmail && !files.length) { toast.error('Adicione ao menos um arquivo.'); return }
    setLoading(true)
    try {
      const formats = {}
      chs.forEach(ch => { if (selFormats[ch]?.length) formats[ch] = selFormats[ch] })
      const post = await createPost({
        title: form.title, channels: chs, formats,
        caption: form.caption, scheduledDate: form.scheduledDate || null,
        funnelTag: funnelTag || null, emailLink: isEmail ? emailLink : null,
        clientId: form.clientId, createdById: user?.id,
      }, isEmail ? [] : files)
      const client = clients.find(c=>c.id===form.clientId)
      const token  = client?.tokens?.[0]
      const link   = token ? buildApprovalLink(token.slug) : ''
      setLinkModal({ open:true, link })
      toast.success('Postagem criada!')
    } catch(e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function copyLink() {
    navigator.clipboard.writeText(linkModal.link)
    setCopied(true); setTimeout(()=>setCopied(false),2000)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Nova Postagem</h1>

      <Card className="p-6 mb-4">
        {/* Channels */}
        <div className="mb-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-3">Canais *</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(CHANNELS).map(([ch, data]) => (
              <button key={ch} onClick={()=>toggleChannel(ch)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-medium transition-all ${selChannels[ch]?'border-mag-500 bg-mag-50 dark:bg-mag-950 text-mag-600 dark:text-mag-300':'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-mag-300'}`}>
                <span>{data.icon}</span>{ch}
              </button>
            ))}
          </div>
          {/* Formats per channel */}
          {Object.keys(selChannels).filter(ch=>!CHANNELS[ch]?.exclusive).map(ch=>(
            <div key={ch} className="mb-2 pl-3 border-l-2 border-mag-400">
              <span className="text-xs font-semibold text-mag-500 block mb-1">{CHANNELS[ch]?.icon} {ch} — Formato</span>
              <div className="flex flex-wrap gap-1.5">
                {(CHANNELS[ch]?.formats||[]).map(fmt=>(
                  <button key={fmt} onClick={()=>toggleFormat(ch,fmt)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${(selFormats[ch]||[]).includes(fmt)?'bg-mag-500 border-mag-500 text-white':'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-mag-300'}`}>
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Email link */}
        {isEmail && (
          <div className="mb-5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide block mb-2">📧 Link do E-mail Marketing</label>
            <div className="flex gap-2">
              <input value={emailLink} onChange={e=>setEmailLink(e.target.value)} placeholder="https://backend.leadconnectorhq.com/..." className="flex-1 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-blue-500" />
              {emailLink && <button onClick={()=>window.open(emailLink,'_blank')} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold">Preview</button>}
            </div>
          </div>
        )}

        {/* File upload */}
        {!isEmail && (
          <div className="mb-5">
            <div onDrop={handleDrop} onDragOver={e=>e.preventDefault()} onClick={()=>document.getElementById('file-input').click()}
              className="border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-8 text-center cursor-pointer hover:border-mag-400 dark:hover:border-mag-600 transition-colors">
              <div className="text-3xl mb-2">⬆</div>
              <div className="font-semibold text-sm mb-1">Arraste arquivos ou clique para selecionar</div>
              <div className="text-xs text-neutral-400">JPG, PNG, GIF, MP4, PDF, DOC</div>
            </div>
            <input id="file-input" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFiles} />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {files.map((f,i)=>(
                  <div key={i} className="relative w-20 h-20 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-neutral-400">{f.name.split('.').pop().toUpperCase()}</span>}
                    <button onClick={()=>setFiles(fs=>fs.filter((_,j)=>j!==i))} className="absolute top-1 right-1 w-4 h-4 bg-black/60 text-white rounded-full text-[10px] flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input label="Título *" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Ex: Post Instagram Março #12" />
          <Input label="Data de publicação" type="date" value={form.scheduledDate} onChange={e=>set('scheduledDate',e.target.value)} />
          <Select label="Cliente *" value={form.clientId} onChange={e=>set('clientId',e.target.value)}>
            <option value="">Selecionar cliente</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 block mb-2">Tag de Funil</label>
            <div className="flex gap-2">
              {FUNNEL_TAGS.map(t=>(
                <button key={t.value} onClick={()=>setFunnelTag(funnelTag===t.value?'':t.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${funnelTag===t.value?t.color+' border-current':'border-neutral-200 dark:border-neutral-700 text-neutral-400'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-5">
          <Textarea label="Legenda / Texto" value={form.caption} onChange={e=>set('caption',e.target.value)} placeholder="Cole aqui o texto da publicação..." />
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} loading={loading}>◎ Salvar e Enviar para Aprovação</Button>
          <Button variant="ghost" onClick={()=>{ setForm({title:'',clientId:'',scheduledDate:'',caption:''}); setFiles([]); setSelChannels({}); setSelFormats({}); setFunnelTag(''); setEmailLink('') }}>Limpar</Button>
        </div>
      </Card>

      {/* Link modal */}
      <Modal open={linkModal.open} onClose={()=>{ setLinkModal({open:false,link:''}); navigate('/admin/dashboard') }} title="✅ Postagem criada!" subtitle="Copie o link e envie para o cliente pelo canal de sua preferência.">
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 mb-4">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Link2 size={12}/> Link do cliente</div>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-xs text-blue-600 dark:text-blue-400 break-all font-mono leading-relaxed">{linkModal.link}</code>
            <button onClick={copyLink} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition-all flex-shrink-0 ${copied?'bg-green-500':'bg-teal-500 hover:bg-teal-600'}`}>
              {copied?<><Check size={12}/> Copiado!</>:<><Copy size={12}/> Copiar</>}
            </button>
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 mb-4">
          👉 Cole este link no WhatsApp, e-mail ou qualquer canal de comunicação com o cliente.
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1 justify-center" onClick={()=>{ setLinkModal({open:false,link:''}); navigate('/admin/dashboard') }}>Ir para o Dashboard</Button>
          <Button className="flex-1 justify-center" onClick={()=>{ setLinkModal({open:false,link:''}); setForm({title:'',clientId:'',scheduledDate:'',caption:''}); setFiles([]); setSelChannels({}); setSelFormats({}); setFunnelTag(''); setEmailLink('') }}>Nova Postagem</Button>
        </div>
      </Modal>
    </div>
  )
}
