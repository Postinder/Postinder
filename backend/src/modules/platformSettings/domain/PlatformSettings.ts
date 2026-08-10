import { z } from 'zod'

export const fieldPolicySchema = z.enum(['hidden', 'optional', 'required'])
export type FieldPolicy = z.infer<typeof fieldPolicySchema>

export const clientFieldPoliciesSchema = z.object({
  whatsapp: fieldPolicySchema,
  segment: fieldPolicySchema,
  deadline_days: fieldPolicySchema,
  document: fieldPolicySchema,
}).strict()

export const postFieldPoliciesSchema = z.object({
  description: fieldPolicySchema,
  scheduled_date: fieldPolicySchema,
  funnel_tag: fieldPolicySchema,
}).strict()

export const portalSettingsSchema = z.object({
  show_post_list: z.boolean(),
  show_supplementary_info: z.boolean(),
  sequential_approval: z.boolean(),
}).strict()

export const platformSettingsSchema = z.object({
  retention: z.object({
    executed_attachment_hours: z.number().int().min(1).max(8760),
  }).strict(),
  features: z.object({
    soundtrack: z.boolean(),
  }).strict(),
  client_fields: clientFieldPoliciesSchema,
  post_fields: postFieldPoliciesSchema,
  portal: portalSettingsSchema,
}).strict()

export const platformSettingsPatchSchema = z.object({
  retention: z.object({
    executed_attachment_hours: z.number().int().min(1).max(8760).optional(),
  }).strict().optional(),
  features: z.object({
    soundtrack: z.boolean().optional(),
  }).strict().optional(),
  client_fields: clientFieldPoliciesSchema.partial().strict().optional(),
  post_fields: postFieldPoliciesSchema.partial().strict().optional(),
  portal: portalSettingsSchema.partial().strict().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one setting is required')

export type PlatformSettings = z.infer<typeof platformSettingsSchema>
export type PlatformSettingsPatch = z.infer<typeof platformSettingsPatchSchema>

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = Object.freeze({
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
    funnel_tag: 'optional',
  }),
  portal: Object.freeze({
    show_post_list: false,
    show_supplementary_info: false,
    sequential_approval: true,
  }),
})

export type PortalModeOverride = 'simplified' | 'detailed' | null

export function resolvePortalSettings(
  globalSettings: PlatformSettings['portal'],
  override: PortalModeOverride,
) {
  if (override === 'detailed') {
    return { show_post_list: true, show_supplementary_info: true, sequential_approval: false }
  }
  if (override === 'simplified') {
    return { show_post_list: false, show_supplementary_info: false, sequential_approval: true }
  }
  return { ...globalSettings }
}

export function mergePlatformSettings(
  current: PlatformSettings,
  patch: PlatformSettingsPatch,
): PlatformSettings {
  return platformSettingsSchema.parse({
    retention: { ...current.retention, ...patch.retention },
    features: { ...current.features, ...patch.features },
    client_fields: { ...current.client_fields, ...patch.client_fields },
    post_fields: { ...current.post_fields, ...patch.post_fields },
    portal: { ...current.portal, ...patch.portal },
  })
}
