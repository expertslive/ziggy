targetScope = 'resourceGroup'

@description('Base name for all resources')
param baseName string = 'ziggy'

@description('Location for all resources')
param location string = resourceGroup().location

@description('run.events API key')
@secure()
param runEventsApiKey string

@description('Event slug')
param eventSlug string = 'experts-live-netherlands-2026'

// Unique suffix for globally unique names
var uniqueSuffix = uniqueString(resourceGroup().id)
var containerRegistryName = '${baseName}cr${uniqueSuffix}'
var cosmosDbName = '${baseName}-cosmos-${uniqueSuffix}'
var storageAccountName = '${baseName}st${uniqueSuffix}'
var logAnalyticsName = '${baseName}-logs'
var containerAppEnvName = '${baseName}-cae'
var containerAppName = '${baseName}-api'
var staticWebAppName = '${baseName}-kiosk'

// ─── Container Registry ───────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ─── Cosmos DB (free tier) ────────────────────────────────────────────
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosDbName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosDb
  name: 'ziggy'
  properties: {
    resource: {
      id: 'ziggy'
    }
  }
}

// Cosmos DB containers
var containers = [
  { name: 'events', partitionKey: '/slug' }
  { name: 'sponsors', partitionKey: '/eventSlug' }
  { name: 'sponsor-tiers', partitionKey: '/eventSlug' }
  { name: 'floor-maps', partitionKey: '/eventSlug' }
  { name: 'admins', partitionKey: '/email' }
  { name: 'i18n-overrides', partitionKey: '/eventSlug' }
]

resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = [
  for container in containers: {
    parent: cosmosDatabase
    name: container.name
    properties: {
      resource: {
        id: container.name
        partitionKey: {
          paths: [container.partitionKey]
          kind: 'Hash'
        }
      }
    }
  }
]

// ─── Storage Account (blob for images) ────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource imagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'images'
  properties: {
    publicAccess: 'Blob'
  }
}

// ─── Log Analytics ────────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ─── Container Apps Environment ───────────────────────────────────────
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ─── Container App (API) ──────────────────────────────────────────────
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
        }
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'run-events-api-key'
          value: runEventsApiKey
        }
        {
          name: 'cosmos-connection-string'
          value: cosmosDb.listConnectionStrings().connectionStrings[0].connectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'ziggy-api'
          image: '${acr.properties.loginServer}/ziggy-api:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'PORT', value: '3001' }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'EVENT_SLUG', value: eventSlug }
            { name: 'RUN_EVENTS_API_KEY', secretRef: 'run-events-api-key' }
            { name: 'COSMOS_CONNECTION_STRING', secretRef: 'cosmos-connection-string' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ─── Static Web App (kiosk) ──────────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

// ─── Outputs ──────────────────────────────────────────────────────────
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output apiUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output cosmosDbEndpoint string = cosmosDb.properties.documentEndpoint
output storageAccountName string = storage.name
output storageBlobEndpoint string = storage.properties.primaryEndpoints.blob
