import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { useBranding } from './BrandingProvider'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { versionBrandingLogoUrl } from '../../utils/brandingLogo'

export default function InstitutionalBrand({
  className = '',
  imageClassName = 'max-h-12 max-w-[180px]',
  fallbackClassName = '',
  showTagline = false,
}) {
  const { branding } = useBranding()
  const [imageFailed, setImageFailed] = useState(false)
  const logoUrl = versionBrandingLogoUrl(resolveMediaUrl(branding.logoUrl), branding.logoVersion)

  useEffect(() => setImageFailed(false), [logoUrl])

  return (
    <div className={`flex min-w-0 items-center justify-center ${className}`}>
      {logoUrl && !imageFailed ? (
        <img
          src={logoUrl}
          alt={`Logo institucional ${branding.institutionalName}`}
          className={`block h-auto w-auto object-contain ${imageClassName}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={`flex items-center gap-2 ${fallbackClassName}`} aria-label="Postinder">
          <Flame size={28} className="shrink-0 text-mag-500" aria-hidden="true" />
          <div className="min-w-0">
            <div className="truncate text-xl font-extrabold tracking-tight">
              Post<span className="text-mag-500">inder</span>
            </div>
            {showTagline ? <div className="text-[10px] tracking-wide opacity-70">Plataforma de Aprovação de Conteúdo</div> : null}
          </div>
        </div>
      )}
    </div>
  )
}
