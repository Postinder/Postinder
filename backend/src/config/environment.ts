import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const envSchema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRY_MINUTES: z.coerce.number().default(15),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(7),
  LOG_LEVEL: z.enum(['debug','info','warn','error']).default('info'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
})

export type Environment = z.infer<typeof envSchema>

export function loadEnvironment(): Environment {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Environment validation failed:', result.error.format())
    process.exit(1)
  }
  return result.data
}

export const env = loadEnvironment()
