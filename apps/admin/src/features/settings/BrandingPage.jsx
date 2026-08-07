import { useEffect, useRef, useState } from 'react'
import { Image, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/ui/PageHeader'
import InstitutionalBrand from '../../components/branding/InstitutionalBrand'
import { useBranding } from '../../components/branding/BrandingProvider'
import { removeBrandingLogo, uploadBrandingLogo } from '../../services/branding.service'
import { validateBrandingLogo } from '../../utils/brandingLogo'

function apiErrorMessage(error, fallback) {
  return error?.response?.data?.error || fallback
}

export default function BrandingPage() {
  const { branding, applyBranding } = useBranding()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function selectFile(event) {
    const selected = event.target.files?.[0] || null
    const validationError = validateBrandingLogo(selected)
    setError(validationError || '')
    if (validationError) {
      event.target.value = ''
      return
    }
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  async function saveLogo() {
    const validationError = validateBrandingLogo(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError('')
    try {
      applyBranding(await uploadBrandingLogo(file))
      setPreviewUrl('')
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      toast.success('Logo institucional atualizado.')
    } catch (requestError) {
      const message = apiErrorMessage(requestError, 'Nao foi possivel atualizar o logo.')
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  async function removeLogo() {
    setBusy(true)
    setError('')
    try {
      applyBranding(await removeBrandingLogo())
      setPreviewUrl('')
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      toast.success('Logo removido. O fallback do Postinder esta ativo.')
    } catch (requestError) {
      const message = apiErrorMessage(requestError, 'Nao foi possivel remover o logo.')
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={Image}
        title="Identidade visual"
        subtitle="Configure o logo institucional exibido para a equipe e para os clientes."
      />

      <Card className="max-w-3xl p-5 sm:p-6">
        <h2 className="text-sm font-bold">Logo atual</h2>
        <div className="mt-3 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-950">
          <InstitutionalBrand imageClassName="max-h-24 max-w-full sm:max-w-md" fallbackClassName="text-neutral-950 dark:text-white" showTagline />
        </div>

        <div className="mt-6">
          <label htmlFor="branding-logo" className="text-sm font-bold">Selecionar novo logo</label>
          <p className="mt-1 text-xs text-neutral-500">PNG, JPEG ou WebP, ate 2 MB. SVG nao e aceito.</p>
          <input
            ref={inputRef}
            id="branding-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            onChange={selectFile}
            disabled={busy}
            className="mt-3 block w-full rounded-lg border border-neutral-200 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mag-50 file:px-3 file:py-2 file:font-semibold file:text-mag-700 dark:border-neutral-700 dark:bg-neutral-900 dark:file:bg-mag-950 dark:file:text-mag-300"
          />
        </div>

        {previewUrl ? (
          <div className="mt-5">
            <p className="text-sm font-bold">Previa antes de salvar</p>
            <div className="mt-2 flex min-h-28 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 p-5 dark:border-neutral-700 dark:bg-neutral-800">
              <img src={previewUrl} alt="Previa do novo logo institucional" className="max-h-24 max-w-full object-contain sm:max-w-md" />
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm font-medium text-red-600" role="alert">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={saveLogo} disabled={!file || busy} loading={busy} className="inline-flex items-center justify-center gap-2">
            <Upload size={16} /> Salvar novo logo
          </Button>
          <Button type="button" variant="secondary" onClick={removeLogo} disabled={!branding.logoConfigured || busy} className="inline-flex items-center justify-center gap-2">
            <Trash2 size={16} /> Remover logo
          </Button>
        </div>
      </Card>
    </div>
  )
}
