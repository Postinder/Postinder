import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  userType: z.enum(['admin', 'client']),
})

export type LoginDTO = z.infer<typeof loginSchema>
