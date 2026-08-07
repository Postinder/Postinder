import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  DEPLOYMENT_MODE: z.string().optional(),
  ENABLE_DEMO_RESET: z.string().optional(),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRY_MINUTES: z.coerce.number().default(15),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(7),
  LOG_LEVEL: z.enum(['debug','info','warn','error']).default('info'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('postinder-uploads'),
  APP_PUBLIC_URL: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),
  ZAPI_INSTANCE: z.string().optional(),
  ZAPI_CLIENT_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  ANTHROPIC_TIMEOUT_MS: z.string().optional(),
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
