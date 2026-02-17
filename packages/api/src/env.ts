/** Environment configuration with defaults */

export interface EnvConfig {
  port: number
  eventSlug: string
  runEventsApiKey: string
  nodeEnv: 'development' | 'production' | 'test'
  cosmosConnectionString: string
  jwtSecret: string
  storageConnectionString: string
}

export function getEnv(): EnvConfig {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    eventSlug: process.env.EVENT_SLUG || 'experts-live-netherlands-2026',
    runEventsApiKey: process.env.RUN_EVENTS_API_KEY || '',
    nodeEnv: (process.env.NODE_ENV as EnvConfig['nodeEnv']) || 'development',
    cosmosConnectionString: process.env.COSMOS_CONNECTION_STRING || '',
    jwtSecret:
      process.env.JWT_SECRET || crypto.randomUUID() + crypto.randomUUID(),
    storageConnectionString: process.env.STORAGE_CONNECTION_STRING || '',
  }
}
