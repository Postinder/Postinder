import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchBranding } from '../../services/branding.service'

const FALLBACK_BRANDING = Object.freeze({
  institutionalName: 'Postinder',
  logoUrl: null,
  logoVersion: 0,
  updatedAt: null,
})

const BrandingContext = createContext({
  branding: FALLBACK_BRANDING,
  applyBranding: () => {},
  refreshBranding: async () => FALLBACK_BRANDING,
})

function normalizeBranding(data) {
  return {
    institutionalName: data?.institutional_name || 'Postinder',
    logoUrl: data?.logo_url || null,
    logoVersion: Number(data?.logo_version || 0),
    updatedAt: data?.updated_at || null,
  }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(FALLBACK_BRANDING)
  const applyBranding = useCallback(data => {
    const normalized = normalizeBranding(data)
    setBranding(normalized)
    return normalized
  }, [])
  const refreshBranding = useCallback(async () => applyBranding(await fetchBranding()), [applyBranding])

  useEffect(() => {
    refreshBranding().catch(() => setBranding(FALLBACK_BRANDING))
  }, [refreshBranding])

  const value = useMemo(() => ({ branding, applyBranding, refreshBranding }), [branding, applyBranding, refreshBranding])
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding() {
  return useContext(BrandingContext)
}
