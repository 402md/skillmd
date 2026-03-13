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
  PAYMENT_NETWORKS_SET
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

  validateName(manifest.name, errors)
  validateDescription(manifest.description, errors)
  validateBaseUrl(manifest.base_url, errors)
  validateType(manifest.type, errors)
  validatePayment(manifest.payment, errors, warnings)
  validateEndpoints(manifest.endpoints, errors, warnings)
  validateVersion(manifest.version, warnings)
  validateTags(manifest.tags, warnings)

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
    for (const network of payment.networks) {
      if (!PAYMENT_NETWORKS_SET.has(network)) {
        errors.push({
          field: 'payment.networks',
          message: `Invalid network "${network}". Must be one of: ${[...PAYMENT_NETWORKS_SET].join(', ')}`,
          code: 'INVALID_ENUM'
        })
      }
    }
  }

  if (!payment.payTo) {
    errors.push({
      field: 'payment.payTo',
      message: 'payTo address is required',
      code: 'REQUIRED'
    })
  } else {
    const isEvm = EVM_ADDRESS_RE.test(payment.payTo)
    const isStellar = STELLAR_ADDRESS_RE.test(payment.payTo)
    if (!isEvm && !isStellar) {
      warnings.push({
        field: 'payment.payTo',
        message: 'payTo does not look like a valid Stellar or EVM address',
        code: 'SUSPICIOUS_ADDRESS'
      })
    }
  }

  if (payment.payToEvm && !EVM_ADDRESS_RE.test(payment.payToEvm)) {
    errors.push({
      field: 'payment.payToEvm',
      message: 'payToEvm must be a valid EVM address (0x...)',
      code: 'INVALID_FORMAT'
    })
  }

  if (payment.facilitator) {
    try {
      new URL(payment.facilitator)
    } catch {
      errors.push({
        field: 'payment.facilitator',
        message: 'facilitator must be a valid URL',
        code: 'INVALID_URL'
      })
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

    if (!PRICE_RE.test(ep.priceUsdc)) {
      errors.push({
        field: `${prefix}.priceUsdc`,
        message: `Invalid price "${ep.priceUsdc}". Must be a decimal string (e.g. "0.001")`,
        code: 'INVALID_FORMAT'
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
