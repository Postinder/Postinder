import { NextFunction, Request, Response, Router } from 'express'
import { env, Environment } from '../../../../config/environment'
import { AIInsightsService } from '../../application/AIInsightsService'
import {
  AnthropicAIProvider,
  anthropicOptionsFromEnvironment,
} from '../../infrastructure/AnthropicAIProvider'
import { AIInsightsController } from '../controllers/AIInsightsController'

function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export function createAIInsightsController(
  runtimeEnvironment: Environment = env,
): AIInsightsController {
  const provider = new AnthropicAIProvider(
    anthropicOptionsFromEnvironment(runtimeEnvironment),
  )
  return new AIInsightsController(new AIInsightsService(provider))
}

export function createIntegrationsRoutes(
  runtimeEnvironment: Environment = env,
  controller: AIInsightsController = createAIInsightsController(runtimeEnvironment),
): Router {
  const router = Router()
  router.post('/ai-insights', wrap(controller.generate.bind(controller)))
  return router
}
