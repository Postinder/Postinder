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
  const [successModal, setSuccessModal] = useState({ open: false, clientId: '' })

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
      await createPost({
        title: form.title, channels: chs, formats,
        caption: form.caption, scheduledDate: form.scheduledDate || null,
        funnelTag: funnelTag || null, emailLink: isEmail ? emailLink : null,
        clientId: form.clientId, createdById: user?.id,
      }, isEmail ? [] : files)
      toast.success('Postagem criada e enviada para aprovação!')
      setSuccessModal({ open: true, clientId: form.clientId })
    } catch(e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function resetForm() {
    setForm({ title:'', clientId:'', scheduledDate:'', caption:'' })
    setFiles([]); setSelChannels({}); setSelFormats({}); setFunnelTag(''); setEmailLink('')
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
              <div className="text-xs text-neutral-400">Imagens · Vídeos · Áudios · PDF · Word · Excel · PowerPoint · ZIP</div>
              <div className="text-xs text-neutral-300 dark:text-neutral-600 mt-1">Máximo 200 MB por arquivo</div>
            </div>
            <input id="file-input" type="file" multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
              className="hidden" onChange={handleFiles} />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {files.map((f,i)=>{
                  const isImg = f.type.startsWith('image/')
                  const isVid = f.type.startsWith('video/')
                  const ext   = f.name.split('.').pop().toUpperCase()
                  const icon  = isVid ? '🎬' : f.type === 'application/pdf' ? '📄' :
                                f.type.startsWith('audio/') ? '🎵' :
                                f.type.includes('word') ? '📝' :
                                f.type.includes('excel') || f.type.includes('sheet') ? '📊' :
                                f.type.includes('powerpoint') || f.type.includes('presentation') ? '📋' : '📎'
                  return (
                    <div key={i} className="relative w-20 h-20 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      {isImg
                        ? <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        : isVid
                          ? <video src={URL.createObjectURL(f)} className="w-full h-full object-cover" muted />
                          : <div className="flex flex-col items-center gap-1 p-1">
                              <span className="text-2xl">{icon}</span>
                              <span className="text-[9px] font-bold text-neutral-500 text-center leading-tight">{ext}</span>
                            </div>
                      }
                      <button onClick={()=>setFiles(fs=>fs.filter((_,j)=>j!==i))} className="absolute top-1 right-1 w-4 h-4 bg-black/60 text-white rounded-full text-[10px] flex items-center justify-center">✕</button>
                    </div>
                  )
                })}
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
          <Button variant="ghost" onClick={resetForm}>Limpar</Button>
        </div>
      </Card>

      <Modal open={successModal.open} onClose={() => { setSuccessModal({ open: false, clientId: '' }); navigate('/admin/dashboard') }}
        title="✅ Postagem criada!" subtitle="A postagem foi enviada para aprovação do cliente.">
        <div className="text-center py-4">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">O cliente já pode revisar os arquivos na área de aprovação.</p>
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="secondary" className="flex-1 justify-center"
            onClick={() => { setSuccessModal({ open: false, clientId: '' }); navigate(`/admin/dashboard?client=${successModal.clientId}`) }}>
            Ver posts do cliente
          </Button>
          <Button className="flex-1 justify-center"
            onClick={() => { setSuccessModal({ open: false, clientId: '' }); resetForm() }}>
            Nova Postagem
          </Button>
        </div>
      </Modal>
    </div>
  )
}
