import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusSquare, UploadCloud } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { createPost } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import { CHANNELS, FUNNEL_TAGS } from '../../utils/constants'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input, { Textarea, Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import SortableAttachments, { moveAttachment } from '../../components/posts/SortableAttachments'
import ChannelIcon from '../../components/posts/ChannelIcon'
import { prepareUploadFiles } from '../../utils/uploadValidation'
import { normalizeEmailPreviewUrl } from '../../utils/emailPreview'
import toast from 'react-hot-toast'
import { usePlatformSettings } from '../../hooks/usePlatformSettings'
import { isFieldRequired, isFieldVisible, putVisibleField, requiredFieldIsMissing } from '../../utils/fieldPolicies'
import SoundtrackEditor from '../../components/posts/SoundtrackEditor'
import { emptySoundtrackDraft, validateSoundtrackDraft } from '../../utils/soundtrack'
import { getMediaKind } from '../../components/media/MediaPreview'

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
  const [uploadProgress, setUploadProgress] = useState(null)
  const [successModal, setSuccessModal] = useState({ open: false, clientId: '', status: 'draft' })
  const [soundtrack, setSoundtrack] = useState(() => emptySoundtrackDraft())
  const { settings } = usePlatformSettings()
  const postFields = settings.post_fields

  useEffect(() => {
    fetchClients().then(setClients).catch(() => {})
  }, [])

  const isEmail = Boolean(selChannels['E-mail Marketing'])
  const isEmailOnly = isEmail && Object.keys(selChannels).length === 1
  const emailPreviewUrl = normalizeEmailPreviewUrl(emailLink)
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

  function addFiles(fileList) {
    const { accepted, errors } = prepareUploadFiles(fileList)
    if (accepted.length) setFiles(current => [...current, ...accepted])
    errors.forEach(error => toast.error(error))
  }

  function handleFiles(event) {
    addFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    addFiles(event.dataTransfer.files)
  }

  async function handleSave(status = 'draft', keepCreating = false) {
    const channels = Object.keys(selChannels)
    if (!form.clientId || !form.title || !channels.length) {
      toast.error('Preencha cliente, título e ao menos um canal.')
      return
    }
    const normalizedEmailLink = emailPreviewUrl
    if (isEmail && !normalizedEmailLink) {
      toast.error('Informe um Link de pre-visualizacao do e-mail valido, iniciado por http:// ou https://.')
      return
    }
    if (!isEmailOnly && !files.length) {
      toast.error('Adicione ao menos um arquivo.')
      return
    }
    for (const [policy, value] of [
      [postFields.description, form.caption],
      [postFields.scheduled_date, form.scheduledDate],
      [postFields.funnel_tag, funnelTag],
    ]) {
      if (requiredFieldIsMissing(policy, value)) {
        toast.error('Preencha todos os campos obrigatorios da postagem.')
        return
      }
    }
    if (settings.features.soundtrack) {
      const soundtrackError = validateSoundtrackDraft(soundtrack, files
        .map((item, index) => ({ key: item.id || item.localId || `file-${index}`, isVideo: getMediaKind(item) === 'video' }))
        .filter(item => item.isVideo))
      if (soundtrackError) {
        toast.error(soundtrackError)
        return
      }
    }

    setLoading(true)
    setUploadProgress(null)
    try {
      const formats = {}
      channels.forEach(channel => {
        if (selFormats[channel]?.length) formats[channel] = selFormats[channel]
      })

      const payload = {
        title: form.title,
        status,
        channels,
        formats,
        emailLink: isEmail ? normalizedEmailLink : null,
        clientId: form.clientId,
        createdById: user?.id,
      }
      putVisibleField(payload, 'caption', form.caption, postFields.description)
      putVisibleField(payload, 'scheduledDate', form.scheduledDate || null, postFields.scheduled_date)
      putVisibleField(payload, 'funnelTag', funnelTag || null, postFields.funnel_tag)
      await createPost(payload, files.map((item, index) => ({ ...item, sortOrder: index + 1 })), {
        onUploadProgress: setUploadProgress,
        soundtrack: settings.features.soundtrack ? soundtrack : emptySoundtrackDraft(),
      })

      toast.success(status === 'ready' ? 'Postagem salva como pronta para envio.' : 'Rascunho salvo.')
      if (keepCreating) {
        resetForm()
      } else {
        setSuccessModal({ open: true, clientId: form.clientId, status })
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
      setUploadProgress(null)
    }
  }

  function resetForm() {
    setForm({ title: '', clientId: '', scheduledDate: '', caption: '' })
    setFiles([])
    setSelChannels({})
    setSelFormats({})
    setFunnelTag('')
    setEmailLink('')
    setSoundtrack(emptySoundtrackDraft())
    setUploadProgress(null)
  }

  return (
    <div className="space-y-5 pb-20">
      <PageHeader
        icon={PlusSquare}
        title="Nova Postagem"
        subtitle="Cadastre conteudos internamente como rascunho ou pronto para envio. O cliente so recebe depois pela area Postagens."
      />

      <Section number="1" title="Cliente e planejamento" description="Defina para quem esta postagem sera enviada.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Cliente *" value={form.clientId} onChange={event => set('clientId', event.target.value)}>
            <option value="">Selecionar cliente</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
          {isFieldVisible(postFields.scheduled_date) ? <Input label={`Data de publicacao${isFieldRequired(postFields.scheduled_date) ? ' *' : ''}`} type="date" value={form.scheduledDate} onChange={event => set('scheduledDate', event.target.value)} /> : null}
        </div>
      </Section>

      <Section number="2" title="Conteúdo" description="Nomeie a postagem e adicione o texto que será revisado.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Título *" value={form.title} onChange={event => set('title', event.target.value)} placeholder="Ex: Post Instagram Março #12" />
            {isFieldVisible(postFields.funnel_tag) ? <div>
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
            </div> : null}
          </div>
          {isFieldVisible(postFields.description) ? <Textarea label={`Legenda / Texto${isFieldRequired(postFields.description) ? ' *' : ''}`} value={form.caption} onChange={event => set('caption', event.target.value)} placeholder="Cole aqui o texto da publicação..." /> : null}
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
              <ChannelIcon channel={channel} />
              {channel}
            </button>
          ))}
        </div>

        {Object.keys(selChannels).filter(channel => CHANNELS[channel]?.formats?.length).map(channel => (
          <div key={channel} className="mb-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-mag-500"><ChannelIcon channel={channel} size={14} /> {channel} - Formato</span>
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
            Link de pré-visualização do e-mail
          </label>
          <div className="flex gap-2">
            <input
              value={emailLink}
              onChange={event => setEmailLink(event.target.value)}
              type="url"
              placeholder="https://backend.leadconnectorhq.com/..."
              className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-blue-700 dark:bg-neutral-800"
            />
            {emailPreviewUrl && (
              <button onClick={() => window.open(emailPreviewUrl, '_blank', 'noopener,noreferrer')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                Preview
              </button>
            )}
          </div>
        </Card>
      ) : null}

        <Section number="4" title="Arquivos" description={isEmailOnly ? 'Anexos opcionais para complementar a pré-visualização do e-mail.' : 'Anexe as pecas que o cliente precisa aprovar.'}>
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
            <div className="mt-4">
              <SortableAttachments
                items={files}
                onMove={(from, to) => setFiles(current => moveAttachment(current, from, to))}
                onRemove={index => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}
              />
            </div>
          )}

          {uploadProgress ? (
            <div className="mt-4 rounded-lg border border-mag-200 bg-mag-50 p-3 dark:border-mag-900 dark:bg-mag-950/30">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-mag-700 dark:text-mag-300">
                <span className="min-w-0 truncate">
                  Enviando {uploadProgress.fileIndex + 1} de {uploadProgress.totalFiles}: {uploadProgress.fileName}
                </span>
                <span>{uploadProgress.percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-mag-100 dark:bg-mag-900">
                <div className="h-full rounded-full bg-mag-600 transition-[width]" style={{ width: `${uploadProgress.percent}%` }} />
              </div>
            </div>
          ) : null}
      </Section>

      {settings.features.soundtrack ? (
        <SoundtrackEditor value={soundtrack} onChange={setSoundtrack} attachments={files} />
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200 bg-neutral-100/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:-mx-6 md:px-6">
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={resetForm}>Limpar</Button>
          <Button variant="secondary" onClick={() => handleSave('draft', true)} loading={loading}>
            Salvar e continuar criando
          </Button>
          <Button variant="secondary" onClick={() => handleSave('ready')} loading={loading}>
            Salvar como pronto
          </Button>
          <Button onClick={() => handleSave('draft')} loading={loading} size="lg" className="px-6">
            Salvar como rascunho
          </Button>
        </div>
      </div>

      <Modal open={successModal.open} onClose={() => { setSuccessModal({ open: false, clientId: '' }); navigate('/admin/dashboard') }}
        title="Postagem salva!" subtitle="Ela ficou na area interna de gerenciamento. Envie ao cliente quando estiver pronta.">
        <div className="py-4 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Status atual: {successModal.status === 'ready' ? 'pronto para envio' : 'rascunho interno'}.
          </p>
        </div>
        <div className="mt-2 flex gap-3">
          <Button variant="secondary" className="flex-1 justify-center"
            onClick={() => { setSuccessModal({ open: false, clientId: '' }); navigate('/admin/posts') }}>
            Gerenciar postagens
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
