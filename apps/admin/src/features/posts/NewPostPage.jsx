import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusSquare, UploadCloud, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { createPost } from '../../services/posts.service'
import { fetchClients, notifyClient } from '../../services/clients.service'
import { CHANNELS, FUNNEL_TAGS } from '../../utils/constants'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input, { Textarea, Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import toast from 'react-hot-toast'

function Section({ number, title, description, children }) {
  return (
    <Card className="border-neutral-200 shadow-sm dark:border-neutral-800">
      <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mag-500 text-xs font-extrabold text-white">
            {number}
          </span>
          <div>
            <div className="text-sm font-bold text-neutral-900 dark:text-white">{title}</div>
            <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{description}</div>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  )
}

export default function NewPostPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [clients, setClients] = useState([])
  const [files, setFiles] = useState([])
  const [selChannels, setSelChannels] = useState({})
  const [selFormats, setSelFormats] = useState({})
  const [funnelTag, setFunnelTag] = useState('')
  const [emailLink, setEmailLink] = useState('')
  const [form, setForm] = useState({ title: '', clientId: '', scheduledDate: '', caption: '' })
  const [loading, setLoading] = useState(false)
  const [successModal, setSuccessModal] = useState({ open: false, clientId: '' })

  useEffect(() => {
    fetchClients().then(setClients).catch(() => {})
  }, [])

  const isEmail = Boolean(selChannels['E-mail Marketing'])
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  function toggleChannel(channel) {
    const channelData = CHANNELS[channel]

    if (channelData.exclusive) {
      if (selChannels[channel]) {
        const next = { ...selChannels }
        delete next[channel]
        setSelChannels(next)
      } else {
        setSelChannels({ [channel]: true })
        setSelFormats({})
      }
      return
    }

    if (selChannels['E-mail Marketing']) return

    const nextChannels = { ...selChannels }
    if (nextChannels[channel]) {
      delete nextChannels[channel]
      const nextFormats = { ...selFormats }
      delete nextFormats[channel]
      setSelFormats(nextFormats)
    } else {
      nextChannels[channel] = true
    }
    setSelChannels(nextChannels)
  }

  function toggleFormat(channel, format) {
    const current = selFormats[channel] || []
    setSelFormats(formats => ({
      ...formats,
      [channel]: current.includes(format)
        ? current.filter(item => item !== format)
        : [...current, format],
    }))
  }

  function handleFiles(event) {
    setFiles(current => [...current, ...Array.from(event.target.files)])
  }

  function handleDrop(event) {
    event.preventDefault()
    setFiles(current => [...current, ...Array.from(event.dataTransfer.files)])
  }

  async function sendApprovalNotification(clientId) {
    try {
      await notifyClient(clientId)
      toast.success('Mensagem via WhatsApp foi enviada.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Não foi possível enviar o WhatsApp.')
    }
  }

  async function handleSave() {
    const channels = Object.keys(selChannels)
    if (!form.clientId || !form.title || !channels.length) {
      toast.error('Preencha cliente, título e ao menos um canal.')
      return
    }
    if (isEmail && !emailLink) {
      toast.error('Adicione o link do e-mail marketing.')
      return
    }
    if (!isEmail && !files.length) {
      toast.error('Adicione ao menos um arquivo.')
      return
    }

    setLoading(true)
    try {
      const formats = {}
      channels.forEach(channel => {
        if (selFormats[channel]?.length) formats[channel] = selFormats[channel]
      })

      await createPost({
        title: form.title,
        channels,
        formats,
        caption: form.caption,
        scheduledDate: form.scheduledDate || null,
        funnelTag: funnelTag || null,
        emailLink: isEmail ? emailLink : null,
        clientId: form.clientId,
        createdById: user?.id,
      }, isEmail ? [] : files)

      toast.success('Postagem criada e enviada para aprovação!')
      await sendApprovalNotification(form.clientId)
      setSuccessModal({ open: true, clientId: form.clientId })
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ title: '', clientId: '', scheduledDate: '', caption: '' })
    setFiles([])
    setSelChannels({})
    setSelFormats({})
    setFunnelTag('')
    setEmailLink('')
  }

  return (
    <div className="space-y-5 pb-20">
      <PageHeader
        icon={PlusSquare}
        title="Nova Postagem"
        subtitle="Comece pelo cliente. Depois preencha o conteúdo, escolha os canais e anexe os arquivos para aprovação."
      />

      <Section number="1" title="Cliente e planejamento" description="Defina para quem esta postagem sera enviada.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Cliente *" value={form.clientId} onChange={event => set('clientId', event.target.value)}>
            <option value="">Selecionar cliente</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
          <Input label="Data de publicacao" type="date" value={form.scheduledDate} onChange={event => set('scheduledDate', event.target.value)} />
        </div>
      </Section>

      <Section number="2" title="Conteúdo" description="Nomeie a postagem e adicione o texto que será revisado.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Título *" value={form.title} onChange={event => set('title', event.target.value)} placeholder="Ex: Post Instagram Março #12" />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Tag de Funil
              </label>
              <div className="flex gap-2">
                {FUNNEL_TAGS.map(tag => (
                  <button
                    key={tag.value}
                    onClick={() => setFunnelTag(funnelTag === tag.value ? '' : tag.value)}
                    className={`flex-1 rounded-lg border py-2.5 text-xs font-bold transition-all ${
                      funnelTag === tag.value
                        ? `${tag.color} border-current`
                        : 'border-neutral-200 text-neutral-400 hover:border-mag-300 dark:border-neutral-700'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Textarea label="Legenda / Texto" value={form.caption} onChange={event => set('caption', event.target.value)} placeholder="Cole aqui o texto da publicação..." />
        </div>
      </Section>

      <Section number="3" title="Canais e formatos" description="Escolha onde o conteúdo será publicado.">
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Canais *
        </label>
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(CHANNELS).map(([channel, data]) => (
            <button
              key={channel}
              onClick={() => toggleChannel(channel)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-all ${
                selChannels[channel]
                  ? 'border-mag-500 bg-mag-50 text-mag-600 dark:bg-mag-950 dark:text-mag-300'
                  : 'border-neutral-200 text-neutral-600 hover:border-mag-300 dark:border-neutral-700 dark:text-neutral-400'
              }`}
            >
              <span>{data.icon}</span>
              {channel}
            </button>
          ))}
        </div>

        {Object.keys(selChannels).filter(channel => !CHANNELS[channel]?.exclusive).map(channel => (
          <div key={channel} className="mb-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <span className="mb-2 block text-xs font-semibold text-mag-500">{CHANNELS[channel]?.icon} {channel} - Formato</span>
            <div className="flex flex-wrap gap-1.5">
              {(CHANNELS[channel]?.formats || []).map(format => (
                <button
                  key={format}
                  onClick={() => toggleFormat(channel, format)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                    (selFormats[channel] || []).includes(format)
                      ? 'border-mag-500 bg-mag-500 text-white'
                      : 'border-neutral-200 text-neutral-500 hover:border-mag-300 dark:border-neutral-700'
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {isEmail ? (
        <Card className="border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/30">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Link do E-mail Marketing
          </label>
          <div className="flex gap-2">
            <input
              value={emailLink}
              onChange={event => setEmailLink(event.target.value)}
              placeholder="https://backend.leadconnectorhq.com/..."
              className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-blue-700 dark:bg-neutral-800"
            />
            {emailLink && (
              <button onClick={() => window.open(emailLink, '_blank')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                Preview
              </button>
            )}
          </div>
        </Card>
      ) : (
        <Section number="4" title="Arquivos" description="Anexe as pecas que o cliente precisa aprovar.">
          <div
            onDrop={handleDrop}
            onDragOver={event => event.preventDefault()}
            onClick={() => document.getElementById('file-input').click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center transition-colors hover:border-mag-400 dark:border-neutral-700 dark:bg-neutral-950/40 dark:hover:border-mag-600"
          >
            <UploadCloud size={32} className="mx-auto mb-3 text-neutral-300" />
            <div className="mb-1 text-sm font-semibold">Arraste arquivos ou clique para selecionar</div>
            <div className="text-xs text-neutral-400">Imagens, videos, audios, PDF, Word, Excel, PowerPoint e ZIP</div>
            <div className="mt-1 text-xs text-neutral-300 dark:text-neutral-600">Maximo 200 MB por arquivo</div>
          </div>
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            className="hidden"
            onChange={handleFiles}
          />

          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {files.map((file, index) => {
                const isImage = file.type.startsWith('image/')
                const isVideo = file.type.startsWith('video/')
                const extension = file.name.split('.').pop().toUpperCase()
                const icon = isVideo ? 'Video' : file.type === 'application/pdf' ? 'PDF' :
                  file.type.startsWith('audio/') ? 'Audio' :
                    file.type.includes('word') ? 'DOC' :
                      file.type.includes('excel') || file.type.includes('sheet') ? 'XLS' :
                        file.type.includes('powerpoint') || file.type.includes('presentation') ? 'PPT' : extension

                return (
                  <div key={`${file.name}-${index}`} className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
                    {isImage ? (
                      <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                    ) : isVideo ? (
                      <video src={URL.createObjectURL(file)} className="h-full w-full object-cover" muted />
                    ) : (
                      <div className="flex flex-col items-center gap-1 p-2 text-center">
                        <span className="text-xs font-extrabold text-neutral-500">{icon}</span>
                        <span className="line-clamp-2 text-[10px] leading-tight text-neutral-400">{file.name}</span>
                      </div>
                    )}
                    <button
                      onClick={event => {
                        event.stopPropagation()
                        setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))
                      }}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200 bg-neutral-100/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:-mx-6 md:px-6">
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={resetForm}>Limpar</Button>
          <Button onClick={handleSave} loading={loading} size="lg" className="px-6">
            Salvar e Enviar para Aprovação
          </Button>
        </div>
      </div>

      <Modal open={successModal.open} onClose={() => { setSuccessModal({ open: false, clientId: '' }); navigate('/admin/dashboard') }}
        title="Postagem criada!" subtitle="A postagem foi enviada para aprovação do cliente.">
        <div className="py-4 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">O cliente já pode revisar os arquivos na área de aprovação.</p>
        </div>
        <div className="mt-2 flex gap-3">
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
