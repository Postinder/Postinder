import { apiClient } from '../lib/axios'

export const DEFAULT_PLATFORM_SETTINGS = Object.freeze({
  retention: Object.freeze({ executed_attachment_hours: 24 }),
  features: Object.freeze({ soundtrack: false }),
  client_fields: Object.freeze({
    whatsapp: 'optional',
    segment: 'optional',
    deadline_days: 'optional',
    document: 'hidden',
  }),
  post_fields: Object.freeze({
    description: 'optional',
    scheduled_date: 'optional',
    funnel_tag: 'hidden',
  }),
  post_field_client_visibility: Object.freeze({
    funnel_tag: false,
  }),
  portal: Object.freeze({
    show_post_list: false,
    show_supplementary_info: false,
    sequential_approval: true,
    approval_mode: 'content',
  }),
  updated_at: null,
})

export function normalizePlatformSettings(value) {
  const source = value || {}
  const postFields = { ...DEFAULT_PLATFORM_SETTINGS.post_fields, ...source.post_fields }
  const postFieldClientVisibility = {
    ...DEFAULT_PLATFORM_SETTINGS.post_field_client_visibility,
    ...source.post_field_client_visibility,
  }
  if (postFields.funnel_tag === 'hidden') postFieldClientVisibility.funnel_tag = false
  return {
    retention: { ...DEFAULT_PLATFORM_SETTINGS.retention, ...source.retention },
    features: { ...DEFAULT_PLATFORM_SETTINGS.features, ...source.features },
    client_fields: { ...DEFAULT_PLATFORM_SETTINGS.client_fields, ...source.client_fields },
    post_fields: postFields,
    post_field_client_visibility: postFieldClientVisibility,
    portal: { ...DEFAULT_PLATFORM_SETTINGS.portal, ...source.portal },
    updated_at: source.updated_at || null,
  }
}

export async function fetchPlatformSettings() {
  const { data } = await apiClient.get('/platform-settings')
  return normalizePlatformSettings(data)
}

export async function updatePlatformSettings(settings) {
  const { data } = await apiClient.patch('/platform-settings', settings)
  return normalizePlatformSettings(data)
}
