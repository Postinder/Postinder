import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
} from '../services/platformSettings.service'

export const PLATFORM_SETTINGS_QUERY_KEY = ['platform-settings']

export function usePlatformSettings() {
  const query = useQuery({
    queryKey: PLATFORM_SETTINGS_QUERY_KEY,
    queryFn: fetchPlatformSettings,
    staleTime: 30_000,
    retry: 1,
  })
  return {
    ...query,
    settings: query.data || DEFAULT_PLATFORM_SETTINGS,
  }
}
