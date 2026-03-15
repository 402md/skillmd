import YAML from 'yaml'
import type {
  EndpointSpec,
  HttpMethod,
  LegacyFrontmatter,
  PaymentConfig,
  PaymentNetwork,
  SkillManifest,
  SkillType
} from './types'
import {
  FRONTMATTER_RE,
  SKILL_TYPES_SET,
  HTTP_METHODS_SET,
  PAYMENT_NETWORKS_SET
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

  // base_url is optional for SKILL type (pure agent instructions)
  const base_url =
    type === 'SKILL'
      ? getString(data, 'base_url') ?? ''
      : requireString(data, 'base_url')

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
    sla: getString(data, 'sla'),
    rateLimit: getString(data, 'rateLimit'),
    sandbox: getString(data, 'sandbox'),
    allowedTools,
    body
  }
}

function parsePayment(data: Record<string, unknown>): PaymentConfig {
  const raw = data.payment

  // v2 format: payment block
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const payment = raw as Record<string, unknown>
    const networks = parseNetworks(payment.networks)
    return {
      networks,
      asset: getString(payment, 'asset') ?? 'USDC',
      payTo: requireString(payment, 'payTo'),
      payToEvm: getString(payment, 'payToEvm'),
      facilitator: getString(payment, 'facilitator')
    }
  }

  // v1 fallback: no payment block — return defaults
  return {
    networks: ['base'],
    asset: 'USDC',
    payTo: ''
  }
}

function parseNetworks(raw: unknown): PaymentNetwork[] {
  if (!Array.isArray(raw)) return ['base']
  return raw
    .filter(n => typeof n === 'string' && PAYMENT_NETWORKS_SET.has(n))
    .map(n => n as PaymentNetwork)
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
        inputSchema: getObject(ep, 'inputSchema'),
        outputSchema: getObject(ep, 'outputSchema')
      }
    })
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
