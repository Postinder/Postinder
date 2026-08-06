import { z } from 'zod'

export const ACTIVE_POST_CHANNELS = [
  'Instagram/Facebook',
  'LinkedIn',
  'TikTok',
  'YouTube',
  'Google Meu Negócio',
  'WhatsApp',
  'Site',
  'E-mail Marketing',
] as const

const channelSchema = z.enum(ACTIVE_POST_CHANNELS, {
  errorMap: () => ({ message: 'Unsupported channel' }),
})

const previewUrlSchema = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string()
    .trim()
    .url('Invalid email preview URL')
    .refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'Email preview URL must use http or https')
    .nullable()
    .optional(),
)

export function assertEmailPreviewRequirement(input: {
  channels?: readonly string[] | null
  emailLink?: string | null
  email_link?: string | null
}) {
  const channels = input.channels || []
  const previewUrl = input.emailLink ?? input.email_link ?? null
  if (channels.includes('E-mail Marketing') && !previewUrl) {
    throw new Error('Email preview URL is required for E-mail Marketing')
  }
}

export const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  caption: z.string().optional(),
  clientId: z.string().uuid(),
  channels: z.array(channelSchema).optional(),
  formats: z.record(z.array(z.string())).optional(),
  scheduledDate: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  funnelTag: z.string().nullable().optional(),
  funnel_tag: z.string().nullable().optional(),
  emailLink: previewUrlSchema,
  email_link: previewUrlSchema,
  status: z.enum(['draft', 'ready']).optional(),
}).superRefine((value, context) => {
  try {
    assertEmailPreviewRequirement(value)
  } catch (error: any) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['emailLink'], message: error.message })
  }
})

export const updatePostSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  caption: z.string().optional(),
  clientId: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  channels: z.array(z.string()).optional(),
  formats: z.record(z.array(z.string())).optional(),
  scheduledDate: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  funnelTag: z.string().nullable().optional(),
  funnel_tag: z.string().nullable().optional(),
  emailLink: previewUrlSchema,
  email_link: previewUrlSchema,
}).passthrough()

export type CreatePostDTO = z.infer<typeof createPostSchema>
