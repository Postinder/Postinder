import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  caption: z.string().optional(),
  clientId: z.string().uuid(),
})

export type CreatePostDTO = z.infer<typeof createPostSchema>
