import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  channels: z.array(z.string()).min(1),
})

export type CreatePostDTO = z.infer<typeof createPostSchema>
