import type {
  EndpointSpec,
  SkillManifest,
  ValidationError,
  ValidationResult,
  ValidationWarning
} from './types'
import { parseSkillMd } from './parse'
import {
  SKILL_TYPES_SET,
  HTTP_METHODS_SET,
  PAYMENT_NETWORKS_SET,
  DYNAMIC_PRICE,
  PRICING_MODELS_SET,
  DELIVERY_MODES_SET,
  DURATION_RE
} from './constants'

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/
const SEMVER_RE = /^\d+\.\d+\.\d+/
const PRICE_RE = /^\d+(\.\d+)?$/
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/

// ── Public API ──────────────────────────────────────────

/**
 * Validate a SkillManifest (already parsed).
 */
export function validateSkill(manifest: SkillManifest): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const isSkillType = manifest.type === 'SKILL'

  validateName(manifest.name, errors)
  validateDescription(manifest.description, errors)
  validateType(manifest.type, errors)
  validateVersion(manifest.version, warnings)
  validateTags(manifest.tags, warnings)

  // base_url, payment, and endpoints validation depends on whether endpoints exist
  const hasEndpoints = manifest.endpoints.length > 0
  const hasNetworkWithPayTo = manifest.payment.networks.some(nc => nc.payTo)

  if (hasEndpoints) {
    validateBaseUrl(manifest.base_url, errors)
    validatePayment(manifest.payment, errors, warnings)
    validateEndpoints(manifest.endpoints, errors, warnings)
  } else if (isSkillType) {
    if (manifest.base_url) validateBaseUrl(manifest.base_url, errors)
    if (hasNetworkWithPayTo) validatePayment(manifest.payment, errors, warnings)
  } else {
    if (manifest.base_url) validateBaseUrl(manifest.base_url, errors)
    if (hasNetworkWithPayTo) validatePayment(manifest.payment, errors, warnings)
  }

  validatePricingModel(manifest.pricingModel, warnings)
  validateAuth(manifest.auth, errors)

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate a raw SKILL.md string (parse + validate).
 */
export function validateSkillMd(content: string): ValidationResult {
  try {
    const manifest = parseSkillMd(content)
    return validateSkill(manifest)
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          field: 'frontmatter',
          message:
            err instanceof Error ? err.message : 'Failed to parse SKILL.md',
          code: 'PARSE_ERROR'
        }
      ],
      warnings: []
    }
  }
}

// ── Validators ──────────────────────────────────────────

function validateName(name: string, errors: ValidationError[]) {
  if (!name) {
    errors.push({
      field: 'name',
      message: 'Name is required',
      code: 'REQUIRED'
    })
    return
  }
  if (!NAME_RE.test(name)) {
    errors.push({
      field: 'name',
      message:
        'Name must be kebab-case (lowercase letters, numbers, hyphens, underscores)',
      code: 'INVALID_FORMAT'
    })
  }
  if (name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Name must be 100 characters or fewer',
      code: 'TOO_LONG'
    })
  }
}

function validateDescription(description: string, errors: ValidationError[]) {
  if (!description) {
    errors.push({
      field: 'description',
      message: 'Description is required',
      code: 'REQUIRED'
    })
  }
  if (description && description.length > 2000) {
    errors.push({
      field: 'description',
      message: 'Description must be 2000 characters or fewer',
      code: 'TOO_LONG'
    })
  }
}

function validateBaseUrl(base_url: string, errors: ValidationError[]) {
  if (!base_url) {
    errors.push({
      field: 'base_url',
      message: 'base_url is required',
      code: 'REQUIRED'
    })
    return
  }
  try {
    new URL(base_url)
  } catch {
    errors.push({
      field: 'base_url',
      message: 'base_url must be a valid URL',
      code: 'INVALID_URL'
    })
  }
}

function validateType(type: string, errors: ValidationError[]) {
  if (!SKILL_TYPES_SET.has(type)) {
    errors.push({
      field: 'type',
      message: `Invalid type "${type}". Must be one of: ${[...SKILL_TYPES_SET].join(', ')}`,
      code: 'INVALID_ENUM'
    })
  }
}

function validatePayment(
  payment: SkillManifest['payment'],
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  if (!payment.networks || payment.networks.length === 0) {
    errors.push({
      field: 'payment.networks',
      message: 'At least one payment network is required',
      code: 'REQUIRED'
    })
  } else {
    for (let i = 0; i < payment.networks.length; i++) {
      const nc = payment.networks[i]
      const prefix = `payment.networks[${i}]`

      if (!PAYMENT_NETWORKS_SET.has(nc.network)) {
        errors.push({
          field: `${prefix}.network`,
          message: `Invalid network "${nc.network}". Must be one of: ${[...PAYMENT_NETWORKS_SET].join(', ')}`,
          code: 'INVALID_ENUM'
        })
      }

      if (!nc.payTo) {
        errors.push({
          field: `${prefix}.payTo`,
          message: `payTo address is required for network "${nc.network}"`,
          code: 'REQUIRED'
        })
      } else {
        const isEvm = EVM_ADDRESS_RE.test(nc.payTo)
        const isStellar = STELLAR_ADDRESS_RE.test(nc.payTo)
        if (!isEvm && !isStellar) {
          warnings.push({
            field: `${prefix}.payTo`,
            message: `payTo for "${nc.network}" does not look like a valid Stellar or EVM address`,
            code: 'SUSPICIOUS_ADDRESS'
          })
        }
      }

      if (nc.facilitator) {
        try {
          new URL(nc.facilitator)
        } catch {
          errors.push({
            field: `${prefix}.facilitator`,
            message: 'facilitator must be a valid URL',
            code: 'INVALID_URL'
          })
        }
      }
    }
  }

  if (!payment.asset) {
    warnings.push({
      field: 'payment.asset',
      message: 'No asset specified, defaulting to USDC',
      code: 'MISSING_OPTIONAL'
    })
  }
}

function validateEndpoints(
  endpoints: EndpointSpec[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  if (!endpoints || endpoints.length === 0) {
    errors.push({
      field: 'endpoints',
      message: 'At least one endpoint is required',
      code: 'REQUIRED'
    })
    return
  }

  const seen = new Set<string>()

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i]
    const prefix = `endpoints[${i}]`

    if (!ep.path || !ep.path.startsWith('/')) {
      errors.push({
        field: `${prefix}.path`,
        message: 'Endpoint path must start with /',
        code: 'INVALID_FORMAT'
      })
    }

    if (!HTTP_METHODS_SET.has(ep.method)) {
      errors.push({
        field: `${prefix}.method`,
        message: `Invalid method "${ep.method}"`,
        code: 'INVALID_ENUM'
      })
    }

    if (!ep.description) {
      warnings.push({
        field: `${prefix}.description`,
        message: 'Endpoint is missing a description',
        code: 'MISSING_OPTIONAL'
      })
    }

    const isDynamic = ep.priceUsdc === DYNAMIC_PRICE
    if (!isDynamic && !PRICE_RE.test(ep.priceUsdc)) {
      errors.push({
        field: `${prefix}.priceUsdc`,
        message: `Invalid price "${ep.priceUsdc}". Must be a decimal string (e.g. "0.001") or "dynamic"`,
        code: 'INVALID_FORMAT'
      })
    }

    if (ep.estimatedPriceUsdc !== undefined) {
      if (!isDynamic) {
        warnings.push({
          field: `${prefix}.estimatedPriceUsdc`,
          message:
            'estimatedPriceUsdc is only meaningful when priceUsdc is "dynamic"',
          code: 'UNNECESSARY_FIELD'
        })
      }
      if (!PRICE_RE.test(ep.estimatedPriceUsdc)) {
        errors.push({
          field: `${prefix}.estimatedPriceUsdc`,
          message: `Invalid estimatedPriceUsdc "${ep.estimatedPriceUsdc}". Must be a decimal string`,
          code: 'INVALID_FORMAT'
        })
      }
    }

    if (isDynamic && !ep.estimatedPriceUsdc) {
      warnings.push({
        field: `${prefix}.estimatedPriceUsdc`,
        message: 'Dynamic pricing without estimate — agents cannot budget',
        code: 'MISSING_OPTIONAL'
      })
    }

    if (ep.duration !== undefined && !DURATION_RE.test(ep.duration)) {
      errors.push({
        field: `${prefix}.duration`,
        message: `Invalid duration "${ep.duration}". Must match format like "30d", "1h", "1y"`,
        code: 'INVALID_FORMAT'
      })
    }

    if (
      ep.deliveryMode !== undefined &&
      !DELIVERY_MODES_SET.has(ep.deliveryMode)
    ) {
      errors.push({
        field: `${prefix}.deliveryMode`,
        message: `Invalid deliveryMode "${ep.deliveryMode}". Must be: sync, polling, webhook`,
        code: 'INVALID_ENUM'
      })
    }

    const key = `${ep.method} ${ep.path}`
    if (seen.has(key)) {
      errors.push({
        field: `${prefix}`,
        message: `Duplicate endpoint: ${key}`,
        code: 'DUPLICATE'
      })
    }
    seen.add(key)
  }
}

function validateVersion(
  version: string | undefined,
  warnings: ValidationWarning[]
) {
  if (!version) {
    warnings.push({
      field: 'version',
      message: 'No version specified',
      code: 'MISSING_OPTIONAL'
    })
    return
  }
  if (!SEMVER_RE.test(version)) {
    warnings.push({
      field: 'version',
      message: 'Version should follow semver (e.g. "1.0.0")',
      code: 'INVALID_FORMAT'
    })
  }
}

function validateTags(
  tags: string[] | undefined,
  warnings: ValidationWarning[]
) {
  if (tags && tags.length > 20) {
    warnings.push({
      field: 'tags',
      message: 'Too many tags (max 20)',
      code: 'TOO_MANY'
    })
  }
}

function validatePricingModel(
  pricingModel: string | undefined,
  warnings: ValidationWarning[]
) {
  if (pricingModel && !PRICING_MODELS_SET.has(pricingModel)) {
    warnings.push({
      field: 'pricingModel',
      message: `Unknown pricingModel "${pricingModel}". Known values: ${[...PRICING_MODELS_SET].join(', ')}`,
      code: 'INVALID_ENUM'
    })
  }
}

function validateAuth(auth: SkillManifest['auth'], errors: ValidationError[]) {
  if (!auth) return
  if (!auth.method) {
    errors.push({
      field: 'auth.method',
      message: 'auth.method is required when auth is specified',
      code: 'REQUIRED'
    })
  }
  if (auth.loginEndpoint && !auth.loginEndpoint.startsWith('/')) {
    errors.push({
      field: 'auth.loginEndpoint',
      message: 'auth.loginEndpoint must start with /',
      code: 'INVALID_FORMAT'
    })
  }
}
