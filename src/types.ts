// ── Core Types ──────────────────────────────────────────

export interface SkillManifest {
  name: string
  displayName?: string
  description: string
  version?: string
  author?: string
  license?: string
  base_url: string
  type: SkillType

  // Payment config
  payment: PaymentConfig

  // Endpoints
  endpoints: EndpointSpec[]

  // Discovery
  tags?: string[]
  category?: string

  // Quality
  sla?: string
  rateLimit?: string
  sandbox?: string

  // Agent integration (Anthropic Claude Code compatibility)
  allowedTools?: string[]

  // Raw body (markdown after frontmatter)
  body: string
}

export interface PaymentConfig {
  networks: PaymentNetwork[]
  asset: string
  payTo: string
  payToEvm?: string
  facilitator?: string
}

export interface EndpointSpec {
  path: string
  method: HttpMethod
  description: string
  priceUsdc: string
  inputSchema?: JSONSchema
  outputSchema?: JSONSchema
}

export type SkillType =
  | 'API'
  | 'SAAS'
  | 'PRODUCT'
  | 'SERVICE'
  | 'SUBSCRIPTION'
  | 'CONTENT'
  | 'SKILL'

export type PaymentNetwork =
  | 'stellar'
  | 'base'
  | 'base-sepolia'
  | 'stellar-testnet'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type JSONSchema = Record<string, unknown>

// ── Validation Types ────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
}

// ── Generation Types ────────────────────────────────────

export interface SkillConfig {
  name: string
  displayName?: string
  description: string
  version?: string
  author?: string
  license?: string
  base_url?: string
  type?: SkillType
  payment?: PaymentConfig
  endpoints?: EndpointSpec[]
  tags?: string[]
  category?: string
  sla?: string
  rateLimit?: string
  sandbox?: string
  allowedTools?: string[]
  body?: string
}

// ── OpenAPI Types (minimal for conversion) ──────────────

export interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    description?: string
    version: string
  }
  servers?: { url: string }[]
  paths: Record<string, OpenAPIPathItem>
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation
  post?: OpenAPIOperation
  put?: OpenAPIOperation
  delete?: OpenAPIOperation
  patch?: OpenAPIOperation
}

export interface OpenAPIOperation {
  summary?: string
  description?: string
  operationId?: string
  requestBody?: {
    content?: Record<
      string,
      {
        schema?: JSONSchema
      }
    >
  }
  responses?: Record<
    string,
    {
      description?: string
      content?: Record<
        string,
        {
          schema?: JSONSchema
        }
      >
    }
  >
}

// ── Legacy v1 (backwards compat) ────────────────────────

export interface LegacyFrontmatter {
  name: string
  base_url?: string
  type?: string
  description?: string
  endpoints?: {
    path: string
    method: string
    price?: string
    description?: string
  }[]
  [key: string]: unknown
}

// ── A2A Agent Card Types (v0.3.0) ──────────────────────

export interface A2AAgentCard {
  schemaVersion: string
  humanReadableId: string
  agentVersion: string
  name: string
  description: string
  url: string
  protocolVersion: string
  preferredTransport: A2ATransport
  provider: A2AProvider
  capabilities: A2ACapabilities
  authSchemes: A2AAuthScheme[]
  defaultInputModes?: string[]
  defaultOutputModes?: string[]
  skills?: A2ASkill[]
  documentationUrl?: string
}

export type A2ATransport = 'JSONRPC' | 'gRPC' | 'REST'

export interface A2AProvider {
  name: string
  url?: string
}

export interface A2ACapabilities {
  a2aVersion: string
  streaming?: boolean
  pushNotifications?: boolean
}

export interface A2AAuthScheme {
  scheme: string
  serviceUrl?: string
  [key: string]: unknown
}

export interface A2ASkill {
  id: string
  name: string
  description: string
  tags?: string[]
  examples?: string[]
  inputModes?: string[]
  outputModes?: string[]
}
