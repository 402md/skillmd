import YAML from 'yaml'
import type {
  EndpointSpec,
  HttpMethod,
  OpenAPIOperation,
  OpenAPISpec,
  PaymentConfig,
  SkillConfig,
  SkillManifest
} from './types'

// ── Public API ──────────────────────────────────────────

/**
 * Generate a SKILL.md string from a SkillConfig.
 */
export function generateSkillMd(config: SkillConfig): string {
  const frontmatter = buildFrontmatter(config)
  const yaml = YAML.stringify(frontmatter, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN'
  }).trimEnd()

  const body =
    config.body ??
    generateDefaultBody(config.displayName ?? config.name, config.description)

  return `---\n${yaml}\n---\n\n${body}\n`
}

/**
 * Convert an OpenAPI spec into a SkillManifest.
 * Each path+method becomes an endpoint in the manifest.
 */
export function generateFromOpenAPI(
  spec: OpenAPISpec,
  payment: PaymentConfig,
  options?: {
    defaultPrice?: string
    baseUrlOverride?: string
    /** Per-endpoint pricing. Keys: 'METHOD /path' or '*' for fallback. */
    pricing?: Record<string, string>
  }
): SkillManifest {
  const baseUrl =
    options?.baseUrlOverride ??
    spec.servers?.[0]?.url ??
    'https://api.example.com'
  const defaultPrice = options?.defaultPrice ?? '0.001'
  const pricing = options?.pricing

  const endpoints: EndpointSpec[] = []

  for (const [path, methods] of Object.entries(spec.paths)) {
    const methodEntries: [string, OpenAPIOperation | undefined][] = [
      ['GET', methods.get],
      ['POST', methods.post],
      ['PUT', methods.put],
      ['DELETE', methods.delete],
      ['PATCH', methods.patch]
    ]

    for (const [method, operation] of methodEntries) {
      if (!operation) continue

      const inputSchema = extractInputSchema(operation)
      const outputSchema = extractOutputSchema(operation)

      endpoints.push({
        path,
        method: method as HttpMethod,
        description:
          operation.summary ?? operation.description ?? `${method} ${path}`,
        priceUsdc: resolvePrice(method, path, pricing, defaultPrice),
        ...(inputSchema && { inputSchema }),
        ...(outputSchema && { outputSchema })
      })
    }
  }

  return {
    name: slugify(spec.info.title),
    displayName: spec.info.title,
    description: spec.info.description ?? spec.info.title,
    version: spec.info.version,
    base_url: baseUrl,
    type: 'API',
    payment,
    endpoints,
    body: ''
  }
}

/**
 * Convert a SkillManifest into an OpenAPI 3.0 spec.
 * Reverse of generateFromOpenAPI.
 */
export function toOpenAPI(manifest: SkillManifest): OpenAPISpec {
  const paths: Record<string, Record<string, OpenAPIOperation>> = {}

  for (const ep of manifest.endpoints) {
    const method = ep.method.toLowerCase()

    if (!paths[ep.path]) paths[ep.path] = {}

    const operation: OpenAPIOperation = {
      summary: ep.description,
      operationId: `${manifest.name}_${method}_${ep.path.replace(/\//g, '_').replace(/^_/, '')}`
    }

    if (ep.inputSchema && ['post', 'put', 'patch'].includes(method)) {
      operation.requestBody = {
        content: {
          'application/json': { schema: ep.inputSchema }
        }
      }
    }

    operation.responses = {
      '200': {
        description: 'Successful response',
        ...(ep.outputSchema && {
          content: {
            'application/json': { schema: ep.outputSchema }
          }
        })
      },
      '402': {
        description: `Payment Required — ${ep.priceUsdc} USDC`
      }
    }

    paths[ep.path][method] = operation
  }

  return {
    openapi: '3.0.3',
    info: {
      title: manifest.displayName ?? manifest.name,
      description: manifest.description,
      version: manifest.version ?? '1.0.0'
    },
    servers: [{ url: manifest.base_url }],
    paths: paths as OpenAPISpec['paths']
  }
}

// ── Internal ────────────────────────────────────────────

function buildFrontmatter(config: SkillConfig): Record<string, unknown> {
  const isSkillType = (config.type ?? 'API') === 'SKILL'
  const fm: Record<string, unknown> = {
    name: config.name
  }

  if (config.displayName) fm.displayName = config.displayName
  fm.description = config.description
  if (config.version) fm.version = config.version
  if (config.author) fm.author = config.author
  if (config.license) fm.license = config.license
  if (config.base_url) fm.base_url = config.base_url
  fm.type = config.type ?? 'API'

  if (config.payment) {
    fm.payment = {
      networks: config.payment.networks,
      asset: config.payment.asset || 'USDC',
      payTo: config.payment.payTo,
      ...(config.payment.payToEvm && {
        payToEvm: config.payment.payToEvm
      }),
      ...(config.payment.facilitator && {
        facilitator: config.payment.facilitator
      })
    }
  }

  if (config.endpoints?.length) {
    fm.endpoints = config.endpoints.map(ep => {
      const entry: Record<string, unknown> = {
        path: ep.path,
        method: ep.method,
        description: ep.description,
        priceUsdc: ep.priceUsdc
      }
      if (ep.inputSchema) entry.inputSchema = ep.inputSchema
      if (ep.outputSchema) entry.outputSchema = ep.outputSchema
      return entry
    })
  }

  if (config.tags?.length) fm.tags = config.tags
  if (config.category) fm.category = config.category
  if (config.sla) fm.sla = config.sla
  if (config.rateLimit) fm.rateLimit = config.rateLimit
  if (config.sandbox) fm.sandbox = config.sandbox
  if (config.allowedTools?.length)
    fm['allowed-tools'] = config.allowedTools

  return fm
}

function generateDefaultBody(name: string, description: string): string {
  return `# ${name}\n\n${description}`
}

function extractInputSchema(
  op: OpenAPIOperation
): Record<string, unknown> | undefined {
  const content = op.requestBody?.content
  if (!content) return undefined

  const json = content['application/json'] ?? Object.values(content)[0]
  return json?.schema as Record<string, unknown> | undefined
}

function extractOutputSchema(
  op: OpenAPIOperation
): Record<string, unknown> | undefined {
  if (!op.responses) return undefined

  const successResponse =
    op.responses['200'] ?? op.responses['201'] ?? op.responses['2xx']
  if (!successResponse?.content) return undefined

  const json =
    successResponse.content['application/json'] ??
    Object.values(successResponse.content)[0]
  return json?.schema as Record<string, unknown> | undefined
}

function resolvePrice(
  method: string,
  path: string,
  pricing: Record<string, string> | undefined,
  defaultPrice: string
): string {
  if (!pricing) return defaultPrice
  return pricing[`${method} ${path}`] ?? pricing['*'] ?? defaultPrice
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
