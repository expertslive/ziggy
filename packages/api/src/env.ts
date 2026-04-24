export interface EnvConfig {
  port: number
  eventSlug: string
  runEventsApiKey: string
  nodeEnv: 'development' | 'production' | 'test'
  cosmosConnectionString: string
  jwtSecret: string
  storageConnectionString: string
  setupToken: string
}

function requireInProd(name: string, value: string, nodeEnv: string): void {
  if (nodeEnv === 'production' && !value) {
    throw new Error(`${name} must be set in production`)
  }
}

export function getEnv(): EnvConfig {
  const nodeEnv = (process.env.NODE_ENV as EnvConfig['nodeEnv']) || 'development'
  const rawJwt = process.env.JWT_SECRET || ''
  const jwtSecret =
    rawJwt || (nodeEnv === 'production' ? '' : crypto.randomUUID() + crypto.randomUUID())

  if (nodeEnv === 'production') {
    requireInProd('JWT_SECRET', rawJwt, nodeEnv)
    if (rawJwt.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production')
    }
    requireInProd('COSMOS_CONNECTION_STRING', process.env.COSMOS_CONNECTION_STRING || '', nodeEnv)
    requireInProd('STORAGE_CONNECTION_STRING', process.env.STORAGE_CONNECTION_STRING || '', nodeEnv)
    requireInProd('RUN_EVENTS_API_KEY', process.env.RUN_EVENTS_API_KEY || '', nodeEnv)
  }

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    eventSlug: process.env.EVENT_SLUG || 'experts-live-netherlands-2026',
    runEventsApiKey: process.env.RUN_EVENTS_API_KEY || '',
    nodeEnv,
    cosmosConnectionString: process.env.COSMOS_CONNECTION_STRING || '',
    jwtSecret,
    storageConnectionString: process.env.STORAGE_CONNECTION_STRING || '',
    setupToken: process.env.SETUP_TOKEN || '',
  }
}
