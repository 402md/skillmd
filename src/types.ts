// ── Core Types ──────────────────────────────────────────

export interface SkillManifest {
  name: string
  displayName?: string
  description: string
  version?: string
  author?: string
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
  base_url: string
  type?: SkillType
  payment: PaymentConfig
  endpoints: EndpointSpec[]
  tags?: string[]
  category?: string
  sla?: string
  rateLimit?: string
  sandbox?: string
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
