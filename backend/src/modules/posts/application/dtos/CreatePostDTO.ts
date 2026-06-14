import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  caption: z.string().optional(),
  clientId: z.string().uuid(),
  channels: z.array(z.string()).optional(),
  formats: z.record(z.array(z.string())).optional(),
  scheduledDate: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  funnelTag: z.string().nullable().optional(),
  funnel_tag: z.string().nullable().optional(),
  emailLink: z.string().nullable().optional(),
  email_link: z.string().nullable().optional(),
  status: z.enum(['draft', 'ready']).optional(),
})

export type CreatePostDTO = z.infer<typeof createPostSchema>
