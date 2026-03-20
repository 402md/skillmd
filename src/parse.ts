import YAML from 'yaml'
import type {
  AuthConfig,
  DeliveryMode,
  EndpointSpec,
  HttpMethod,
  LegacyFrontmatter,
  NetworkConfig,
  PaymentConfig,
  PaymentNetwork,
  PricingModel,
  SkillManifest,
  SkillType
} from './types'
import {
  FRONTMATTER_RE,
  SKILL_TYPES_SET,
  HTTP_METHODS_SET,
  PAYMENT_NETWORKS_SET,
  PRICING_MODELS_SET
} from './constants'

// ── Public API ──────────────────────────────────────────

/**
 * Parse a SKILL.md string into a SkillManifest.
 * Supports both v2 (with payment block) and v1 (legacy) formats.
 */
export function parseSkillMd(content: string): SkillManifest {
  const { data, body } = extractFrontmatter(content)
  return buildManifest(data, body)
}

/**
 * Extract raw frontmatter data and body from a SKILL.md string.
 * Lower-level than parseSkillMd — returns unprocessed YAML data.
 */
export function parseFrontmatter(md: string): {
  data: LegacyFrontmatter
  body: string
} {
  const match = md.match(FRONTMATTER_RE)
  if (!match) {
    return { data: { name: 'unknown' }, body: md }
  }
  const data = YAML.parse(match[1]) as LegacyFrontmatter
  return { data, body: match[2] }
}

// ── Internal ────────────────────────────────────────────

function extractFrontmatter(content: string): {
  data: Record<string, unknown>
  body: string
} {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    throw new Error('Invalid SKILL.md: missing frontmatter delimiters (---)')
  }
  const data = YAML.parse(match[1]) as Record<string, unknown>
  return { data, body: match[2].trim() }
}

function buildManifest(
  data: Record<string, unknown>,
  body: string
): SkillManifest {
  const name = requireString(data, 'name')
  const description = requireString(data, 'description')

  const rawType = getString(data, 'type') ?? (data.endpoints ? 'API' : 'SKILL')
  const type = SKILL_TYPES_SET.has(rawType) ? (rawType as SkillType) : 'API'

  // base_url is required only when endpoints are present (spec §3.4)
  const hasEndpoints = Array.isArray(data.endpoints) && data.endpoints.length > 0
  const base_url = hasEndpoints
    ? requireString(data, 'base_url')
    : (getString(data, 'base_url') ?? '')

  const payment = parsePayment(data)
  const endpoints = parseEndpoints(data)

  // allowed-tools: Anthropic uses kebab-case, normalize to camelCase
  const allowedTools = parseAllowedTools(data)

  return {
    name,
    displayName: getString(data, 'displayName'),
    description,
    version: getString(data, 'version'),
    author: getString(data, 'author'),
    license: getString(data, 'license'),
    base_url,
    type,
    payment,
    endpoints,
    tags: getStringArray(data, 'tags'),
    category: getString(data, 'category'),
    pricingModel: parsePricingModel(data),
    auth: parseAuth(data),
    sla: getString(data, 'sla'),
    rateLimit: getString(data, 'rateLimit'),
    sandbox: getString(data, 'sandbox'),
    allowedTools,
    body
  }
}

const EVM_NETWORKS = new Set<string>(['base', 'base-sepolia'])

function parsePayment(data: Record<string, unknown>): PaymentConfig {
  const raw = data.payment

  // v2 format: payment block
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const payment = raw as Record<string, unknown>
    const networks = parseNetworks(payment)
    return {
      networks,
      asset: getString(payment, 'asset') ?? 'USDC'
    }
  }

  // v1 fallback: no payment block — return defaults
  return {
    networks: [{ network: 'base', payTo: '' }],
    asset: 'USDC'
  }
}

function parseNetworks(payment: Record<string, unknown>): NetworkConfig[] {
  const raw = payment.networks
  if (!Array.isArray(raw)) return [{ network: 'base', payTo: '' }]

  // New format: array of objects { network, payTo, facilitator? }
  if (raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null) {
    return raw
      .filter(n => n && typeof n === 'object')
      .map(n => {
        const obj = n as Record<string, unknown>
        const network = getString(obj, 'network') ?? 'base'
        return {
          network: (PAYMENT_NETWORKS_SET.has(network)
            ? network
            : 'base') as PaymentNetwork,
          payTo: getString(obj, 'payTo') ?? '',
          ...(getString(obj, 'facilitator') && {
            facilitator: getString(obj, 'facilitator')
          })
        }
      })
  }

  // Legacy format: array of strings + top-level payTo/payToEvm/facilitator
  const payTo = getString(payment, 'payTo') ?? ''
  const payToEvm = getString(payment, 'payToEvm')
  const facilitator = getString(payment, 'facilitator')

  return raw
    .filter(n => typeof n === 'string' && PAYMENT_NETWORKS_SET.has(n))
    .map(n => {
      const network = n as PaymentNetwork
      const address = EVM_NETWORKS.has(network) && payToEvm ? payToEvm : payTo
      return {
        network,
        payTo: address,
        ...(facilitator && { facilitator })
      }
    })
}

function parseEndpoints(data: Record<string, unknown>): EndpointSpec[] {
  const raw = data.endpoints
  if (!Array.isArray(raw)) return []

  return raw
    .filter(e => e && typeof e === 'object')
    .map(e => {
      const ep = e as Record<string, unknown>
      const method = (getString(ep, 'method') ?? 'POST').toUpperCase()

      return {
        path: getString(ep, 'path') ?? '/',
        method: (HTTP_METHODS_SET.has(method) ? method : 'POST') as HttpMethod,
        description: getString(ep, 'description') ?? '',
        priceUsdc: getString(ep, 'priceUsdc') ?? getString(ep, 'price') ?? '0',
        ...(getString(ep, 'estimatedPriceUsdc') && {
          estimatedPriceUsdc: getString(ep, 'estimatedPriceUsdc')
        }),
        ...(getString(ep, 'duration') && {
          duration: getString(ep, 'duration')
        }),
        ...(getString(ep, 'deliveryMode') && {
          deliveryMode: getString(ep, 'deliveryMode') as DeliveryMode
        }),
        inputSchema: getObject(ep, 'inputSchema'),
        outputSchema: getObject(ep, 'outputSchema')
      }
    })
}

function parsePricingModel(
  data: Record<string, unknown>
): PricingModel | undefined {
  const val = getString(data, 'pricingModel')
  if (val && PRICING_MODELS_SET.has(val)) return val as PricingModel
  return undefined
}

function parseAuth(data: Record<string, unknown>): AuthConfig | undefined {
  const raw = data.auth
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const auth = raw as Record<string, unknown>
  const method = getString(auth, 'method')
  if (!method) return undefined
  return {
    method,
    ...(getString(auth, 'loginEndpoint') && {
      loginEndpoint: getString(auth, 'loginEndpoint')
    })
  }
}

function parseAllowedTools(
  data: Record<string, unknown>
): string[] | undefined {
  // Support both 'allowed-tools' (Anthropic convention) and 'allowedTools'
  const raw = data['allowed-tools'] ?? data.allowedTools
  if (typeof raw === 'string') return [raw]
  if (Array.isArray(raw)) {
    return raw.filter(v => typeof v === 'string')
  }
  return undefined
}

// ── Helpers ─────────────────────────────────────────────

function requireString(obj: Record<string, unknown>, key: string): string {
  const val = obj[key]
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  throw new Error(`Missing required field: ${key}`)
}

function getString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const val = obj[key]
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return undefined
}

function getStringArray(
  obj: Record<string, unknown>,
  key: string
): string[] | undefined {
  const val = obj[key]
  if (!Array.isArray(val)) return undefined
  return val.filter(v => typeof v === 'string')
}

function getObject(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const val = obj[key]
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>
  }
  return undefined
}
