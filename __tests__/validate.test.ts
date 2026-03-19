import { describe, it, expect } from 'vitest'
import { validateSkill, validateSkillMd } from '../src/validate'
import type { SkillManifest } from '../src/types'

function makeManifest(
  overrides: Partial<SkillManifest> = {}
): SkillManifest {
  return {
    name: 'test-skill',
    description: 'A test skill',
    base_url: 'https://api.example.com',
    type: 'API',
    payment: {
      networks: [
        {
          network: 'base',
          payTo: '0x1234567890abcdef1234567890abcdef12345678'
        }
      ],
      asset: 'USDC'
    },
    endpoints: [
      {
        path: '/v1/test',
        method: 'POST',
        description: 'Test endpoint',
        priceUsdc: '0.001'
      }
    ],
    body: '# Test',
    ...overrides
  }
}

describe('validateSkill', () => {
  it('passes for a valid manifest', () => {
    const result = validateSkill(makeManifest())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails for invalid name', () => {
    const result = validateSkill(makeManifest({ name: 'Invalid Name!' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name', code: 'INVALID_FORMAT' })
    )
  })

  it('fails for empty description', () => {
    const result = validateSkill(makeManifest({ description: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'description', code: 'REQUIRED' })
    )
  })

  it('fails for invalid base_url', () => {
    const result = validateSkill(makeManifest({ base_url: 'not-a-url' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'base_url', code: 'INVALID_URL' })
    )
  })

  it('fails for invalid type', () => {
    const result = validateSkill(
      makeManifest({ type: 'INVALID' as SkillManifest['type'] })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'type', code: 'INVALID_ENUM' })
    )
  })

  it('fails for missing payment networks', () => {
    const result = validateSkill(
      makeManifest({
        payment: { networks: [], asset: 'USDC' }
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'payment.networks',
        code: 'REQUIRED'
      })
    )
  })

  it('fails for missing payTo', () => {
    const result = validateSkill(
      makeManifest({
        payment: {
          networks: [{ network: 'base', payTo: '' }],
          asset: 'USDC'
        }
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'payment.networks[0].payTo',
        code: 'REQUIRED'
      })
    )
  })

  it('warns for suspicious payTo address', () => {
    const result = validateSkill(
      makeManifest({
        payment: {
          networks: [{ network: 'base', payTo: 'not-an-address' }],
          asset: 'USDC'
        }
      })
    )
    expect(result.valid).toBe(true) // warning, not error
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        field: 'payment.networks[0].payTo',
        code: 'SUSPICIOUS_ADDRESS'
      })
    )
  })

  it('fails for invalid endpoint path', () => {
    const result = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: 'no-slash',
            method: 'GET',
            description: 'test',
            priceUsdc: '0.01'
          }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'endpoints[0].path',
        code: 'INVALID_FORMAT'
      })
    )
  })

  it('fails for invalid price format', () => {
    const result = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/test',
            method: 'POST',
            description: 'test',
            priceUsdc: '$0.01'
          }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'endpoints[0].priceUsdc',
        code: 'INVALID_FORMAT'
      })
    )
  })

  it('fails for duplicate endpoints', () => {
    const result = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/test',
            method: 'POST',
            description: 'first',
            priceUsdc: '0.01'
          },
          {
            path: '/test',
            method: 'POST',
            description: 'duplicate',
            priceUsdc: '0.02'
          }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE' })
    )
  })

  it('warns for missing version', () => {
    const result = validateSkill(makeManifest())
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        field: 'version',
        code: 'MISSING_OPTIONAL'
      })
    )
  })

  it('accepts valid Stellar address', () => {
    const result = validateSkill(
      makeManifest({
        payment: {
          networks: [
            {
              network: 'stellar',
              payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW'
            }
          ],
          asset: 'USDC'
        }
      })
    )
    expect(result.valid).toBe(true)
    expect(
      result.warnings.find(w => w.code === 'SUSPICIOUS_ADDRESS')
    ).toBeUndefined()
  })

  it('validates multiple networks with different addresses', () => {
    const result = validateSkill(
      makeManifest({
        payment: {
          networks: [
            {
              network: 'stellar',
              payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW'
            },
            {
              network: 'base',
              payTo: '0x1234567890abcdef1234567890abcdef12345678'
            }
          ],
          asset: 'USDC'
        }
      })
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails for invalid facilitator URL on a network', () => {
    const result = validateSkill(
      makeManifest({
        payment: {
          networks: [
            {
              network: 'stellar',
              payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
              facilitator: 'not-a-url'
            }
          ],
          asset: 'USDC'
        }
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'payment.networks[0].facilitator',
        code: 'INVALID_URL'
      })
    )
  })

  it('warns for suspicious address per network', () => {
    const result = validateSkill(
      makeManifest({
        payment: {
          networks: [
            { network: 'stellar', payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW' },
            { network: 'base', payTo: 'not-an-address' }
          ],
          asset: 'USDC'
        }
      })
    )
    expect(result.valid).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        field: 'payment.networks[1].payTo',
        code: 'SUSPICIOUS_ADDRESS'
      })
    )
    // Stellar address should NOT have a warning
    expect(
      result.warnings.find(w => w.field === 'payment.networks[0].payTo')
    ).toBeUndefined()
  })

  it('accepts priceUsdc: "dynamic"', () => {
    const result = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/v1/checkout',
            method: 'POST',
            description: 'Checkout',
            priceUsdc: 'dynamic',
            estimatedPriceUsdc: '25.00'
          }
        ]
      })
    )
    expect(result.valid).toBe(true)
  })

  it('warns for dynamic without estimate', () => {
    const result = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/v1/checkout',
            method: 'POST',
            description: 'Checkout',
            priceUsdc: 'dynamic'
          }
        ]
      })
    )
    expect(result.valid).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        field: 'endpoints[0].estimatedPriceUsdc',
        code: 'MISSING_OPTIONAL'
      })
    )
  })

  it('warns for estimatedPriceUsdc on fixed price endpoint', () => {
    const result = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/v1/data',
            method: 'GET',
            description: 'Get data',
            priceUsdc: '0.001',
            estimatedPriceUsdc: '0.001'
          }
        ]
      })
    )
    expect(result.valid).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'UNNECESSARY_FIELD'
      })
    )
  })

  it('validates duration format', () => {
    const valid = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/v1/subscribe',
            method: 'POST',
            description: 'Subscribe',
            priceUsdc: '10.00',
            duration: '30d'
          }
        ]
      })
    )
    expect(valid.valid).toBe(true)

    const invalid = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/v1/subscribe',
            method: 'POST',
            description: 'Subscribe',
            priceUsdc: '10.00',
            duration: '30days'
          }
        ]
      })
    )
    expect(invalid.valid).toBe(false)
    expect(invalid.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_FORMAT', field: 'endpoints[0].duration' })
    )
  })

  it('validates deliveryMode enum', () => {
    const valid = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/v1/jobs',
            method: 'POST',
            description: 'Create job',
            priceUsdc: '5.00',
            deliveryMode: 'polling'
          }
        ]
      })
    )
    expect(valid.valid).toBe(true)

    const invalid = validateSkill(
      makeManifest({
        endpoints: [
          {
            path: '/v1/jobs',
            method: 'POST',
            description: 'Create job',
            priceUsdc: '5.00',
            deliveryMode: 'carrier-pigeon' as any
          }
        ]
      })
    )
    expect(invalid.valid).toBe(false)
    expect(invalid.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_ENUM', field: 'endpoints[0].deliveryMode' })
    )
  })

  it('validates auth config', () => {
    const valid = validateSkill(
      makeManifest({ auth: { method: 'wallet-signature', loginEndpoint: '/v1/auth' } })
    )
    expect(valid.valid).toBe(true)

    const invalidPath = validateSkill(
      makeManifest({ auth: { method: 'wallet-signature', loginEndpoint: 'v1/auth' } })
    )
    expect(invalidPath.valid).toBe(false)
    expect(invalidPath.errors).toContainEqual(
      expect.objectContaining({ field: 'auth.loginEndpoint', code: 'INVALID_FORMAT' })
    )
  })
})

describe('validateSkillMd', () => {
  it('validates a raw SKILL.md string', () => {
    const content = `---
name: test-skill
description: A test
base_url: https://example.com
type: API
payment:
  networks: [base]
  asset: USDC
  payTo: "0x1234567890abcdef1234567890abcdef12345678"
endpoints:
  - path: /test
    method: POST
    description: test
    priceUsdc: "0.01"
---

# Test`

    const result = validateSkillMd(content)
    expect(result.valid).toBe(true)
  })

  it('returns parse error for invalid content', () => {
    const result = validateSkillMd('no frontmatter')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('PARSE_ERROR')
  })

  it('validates Anthropic-compatible skill (type: SKILL)', () => {
    const content = `---
name: code-reviewer
description: This skill should be used when the user asks to review code.
version: 1.0.0
allowed-tools: [Read, Grep]
---

# Code Reviewer`

    const result = validateSkillMd(content)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('validates SKILL type without base_url, payment, or endpoints', () => {
    const manifest = makeManifest({
      type: 'SKILL',
      base_url: '',
      payment: { networks: [{ network: 'base', payTo: '' }], asset: 'USDC' },
      endpoints: []
    })
    const result = validateSkill(manifest)
    expect(result.valid).toBe(true)
  })

  it('still validates endpoints when SKILL type has them', () => {
    const manifest = makeManifest({
      type: 'SKILL',
      base_url: '',
      payment: { networks: [{ network: 'base', payTo: '' }], asset: 'USDC' },
      endpoints: [
        {
          path: 'no-slash',
          method: 'POST',
          description: 'test',
          priceUsdc: '0.01'
        }
      ]
    })
    const result = validateSkill(manifest)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field.includes('path'))).toBe(true)
  })
})
