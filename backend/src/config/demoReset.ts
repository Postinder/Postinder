export type DemoResetConfiguration = {
  NODE_ENV?: unknown
  DEPLOYMENT_MODE?: unknown
  ENABLE_DEMO_RESET?: unknown
}

export type DemoResetAvailability =
  | { enabled: true; reason: 'enabled' }
  | {
      enabled: false
      reason:
        | 'missing-deployment-mode'
        | 'invalid-deployment-mode'
        | 'production-deployment'
        | 'reset-not-enabled'
    }

export function getDemoResetAvailability(
  configuration: DemoResetConfiguration,
): DemoResetAvailability {
  const mode = configuration.DEPLOYMENT_MODE

  if (mode === undefined) {
    return { enabled: false, reason: 'missing-deployment-mode' }
  }
  if (mode !== 'demo' && mode !== 'production') {
    return { enabled: false, reason: 'invalid-deployment-mode' }
  }
  if (mode === 'production') {
    return { enabled: false, reason: 'production-deployment' }
  }
  if (configuration.ENABLE_DEMO_RESET !== 'true') {
    return { enabled: false, reason: 'reset-not-enabled' }
  }

  return { enabled: true, reason: 'enabled' }
}

export function isDemoResetEnabled(configuration: DemoResetConfiguration): boolean {
  return getDemoResetAvailability(configuration).enabled
}
