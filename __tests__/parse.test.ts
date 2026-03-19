import { describe, it, expect } from 'vitest'
import { parseSkillMd, parseFrontmatter } from '../src/parse'

const VALID_V2 = `---
name: weather-api
displayName: Weather API
description: Real-time weather data
version: 1.0.0
author: weatherco
base_url: https://api.weatherco.com
type: API
payment:
  networks:
    - stellar
    - base
  asset: USDC
  payTo: GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW
  facilitator: https://x402.org/facilitator
endpoints:
  - path: /v1/current
    method: POST
    description: Get current weather
    priceUsdc: "0.001"
    inputSchema:
      type: object
      properties:
        location:
          type: string
  - path: /v1/forecast
    method: POST
    description: 7-day forecast
    priceUsdc: "0.005"
tags: [weather, geolocation]
category: data
sla: "99.9%"
rateLimit: 1000/hour
sandbox: https://sandbox.weatherco.com
---

# Weather API

Real-time weather data for any location.`

const LEGACY_V1 = `---
name: my-skill
base_url: https://api.example.com
type: API
description: A simple skill
endpoints:
  - path: /v1/run
    method: POST
    price: "0.01"
    description: Run something
---

# My Skill`

describe('parseSkillMd', () => {
  it('parses v2 format with payment block', () => {
    const manifest = parseSkillMd(VALID_V2)

    expect(manifest.name).toBe('weather-api')
    expect(manifest.displayName).toBe('Weather API')
    expect(manifest.description).toBe('Real-time weather data')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.author).toBe('weatherco')
    expect(manifest.base_url).toBe('https://api.weatherco.com')
    expect(manifest.type).toBe('API')

    expect(manifest.payment.networks).toEqual([
      {
        network: 'stellar',
        payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
        facilitator: 'https://x402.org/facilitator'
      },
      {
        network: 'base',
        payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
        facilitator: 'https://x402.org/facilitator'
      }
    ])
    expect(manifest.payment.asset).toBe('USDC')

    expect(manifest.endpoints).toHaveLength(2)
    expect(manifest.endpoints[0].path).toBe('/v1/current')
    expect(manifest.endpoints[0].method).toBe('POST')
    expect(manifest.endpoints[0].priceUsdc).toBe('0.001')
    expect(manifest.endpoints[0].inputSchema).toEqual({
      type: 'object',
      properties: { location: { type: 'string' } }
    })

    expect(manifest.tags).toEqual(['weather', 'geolocation'])
    expect(manifest.category).toBe('data')
    expect(manifest.sla).toBe('99.9%')
    expect(manifest.rateLimit).toBe('1000/hour')
    expect(manifest.sandbox).toBe('https://sandbox.weatherco.com')

    expect(manifest.body).toContain('# Weather API')
  })

  it('parses legacy v1 format (no payment block)', () => {
    const manifest = parseSkillMd(LEGACY_V1)

    expect(manifest.name).toBe('my-skill')
    expect(manifest.base_url).toBe('https://api.example.com')
    expect(manifest.type).toBe('API')

    // v1 fallback defaults
    expect(manifest.payment.networks).toEqual([{ network: 'base', payTo: '' }])
    expect(manifest.payment.asset).toBe('USDC')

    // price field mapped to priceUsdc
    expect(manifest.endpoints).toHaveLength(1)
    expect(manifest.endpoints[0].priceUsdc).toBe('0.01')
    expect(manifest.endpoints[0].path).toBe('/v1/run')
  })

  it('throws on missing frontmatter', () => {
    expect(() => parseSkillMd('just some markdown')).toThrow(
      'missing frontmatter'
    )
  })

  it('throws on missing required fields', () => {
    const noName = `---
description: test
base_url: https://example.com
payment:
  networks: [base]
  payTo: "0x1234567890abcdef1234567890abcdef12345678"
endpoints:
  - path: /test
    method: GET
    description: test
    priceUsdc: "0.01"
---

body`

    expect(() => parseSkillMd(noName)).toThrow('Missing required field: name')
  })

  it('defaults type to API for unknown types', () => {
    const content = `---
name: test
description: test
base_url: https://example.com
type: UNKNOWN
payment:
  networks: [base]
  payTo: "0x1234567890abcdef1234567890abcdef12345678"
endpoints:
  - path: /test
    method: POST
    description: test
    priceUsdc: "0.01"
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.type).toBe('API')
  })

  it('handles CRLF line endings (Windows)', () => {
    const crlf = VALID_V2.replace(/\n/g, '\r\n')
    const manifest = parseSkillMd(crlf)

    expect(manifest.name).toBe('weather-api')
    expect(manifest.payment.networks).toEqual([
      {
        network: 'stellar',
        payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
        facilitator: 'https://x402.org/facilitator'
      },
      {
        network: 'base',
        payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
        facilitator: 'https://x402.org/facilitator'
      }
    ])
    expect(manifest.endpoints).toHaveLength(2)
    expect(manifest.body).toContain('Weather API')
  })

  it('defaults method to POST for invalid methods', () => {
    const content = `---
name: test
description: test
base_url: https://example.com
payment:
  networks: [base]
  payTo: "0x1234567890abcdef1234567890abcdef12345678"
endpoints:
  - path: /test
    method: INVALID
    description: test
    priceUsdc: "0.01"
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.endpoints[0].method).toBe('POST')
  })

  it('parses Anthropic-compatible skill (no endpoints, no payment)', () => {
    const content = `---
name: code-reviewer
description: >-
  This skill should be used when the user asks to "review code",
  "check for bugs", or mentions code quality.
version: 1.0.0
allowed-tools: [Read, Grep, Glob]
---

# Code Reviewer

When reviewing code, check for security vulnerabilities.`

    const manifest = parseSkillMd(content)

    expect(manifest.name).toBe('code-reviewer')
    expect(manifest.description).toContain('review code')
    expect(manifest.type).toBe('SKILL')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.allowedTools).toEqual(['Read', 'Grep', 'Glob'])
    expect(manifest.base_url).toBe('')
    expect(manifest.endpoints).toEqual([])
    expect(manifest.payment.networks[0].payTo).toBe('')
    expect(manifest.body).toContain('Code Reviewer')
  })

  it('parses allowed-tools as single string', () => {
    const content = `---
name: simple-skill
description: A simple skill
allowed-tools: Bash
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.allowedTools).toEqual(['Bash'])
    expect(manifest.type).toBe('SKILL')
  })

  it('parses license field', () => {
    const content = `---
name: test
description: test
base_url: https://example.com
license: MIT
payment:
  networks: [base]
  payTo: "0x1234567890abcdef1234567890abcdef12345678"
endpoints:
  - path: /test
    method: POST
    description: test
    priceUsdc: "0.01"
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.license).toBe('MIT')
  })

  it('infers type SKILL when no endpoints are present', () => {
    const content = `---
name: my-skill
description: Does something
---

Instructions here.`

    const manifest = parseSkillMd(content)
    expect(manifest.type).toBe('SKILL')
  })

  it('parses hybrid skill (endpoints + allowed-tools)', () => {
    const content = `---
name: weather-helper
description: >-
  This skill should be used when the user asks about weather.
base_url: https://api.weather.com
type: API
allowed-tools: [Read, Bash]
payment:
  networks: [stellar]
  payTo: GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW
endpoints:
  - path: /v1/current
    method: POST
    description: Get weather
    priceUsdc: "0.001"
---

# Weather Helper

Call /v1/current for current conditions.`

    const manifest = parseSkillMd(content)
    expect(manifest.type).toBe('API')
    expect(manifest.allowedTools).toEqual(['Read', 'Bash'])
    expect(manifest.endpoints).toHaveLength(1)
    expect(manifest.payment.networks[0].payTo).toContain('GABC')
  })

  it('parses new v2.1 per-network format natively', () => {
    const content = `---
name: multi-chain-api
description: Multi-chain API
base_url: https://api.example.com
type: API
payment:
  asset: USDC
  networks:
    - network: stellar
      payTo: GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW
      facilitator: https://stellar-facilitator.402.md
    - network: base
      payTo: "0x1234567890abcdef1234567890abcdef12345678"
      facilitator: https://base-facilitator.402.md
endpoints:
  - path: /v1/run
    method: POST
    description: Run it
    priceUsdc: "0.01"
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.payment.asset).toBe('USDC')
    expect(manifest.payment.networks).toHaveLength(2)
    expect(manifest.payment.networks[0]).toEqual({
      network: 'stellar',
      payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
      facilitator: 'https://stellar-facilitator.402.md'
    })
    expect(manifest.payment.networks[1]).toEqual({
      network: 'base',
      payTo: '0x1234567890abcdef1234567890abcdef12345678',
      facilitator: 'https://base-facilitator.402.md'
    })
  })

  it('parses dynamic pricing with estimatedPriceUsdc', () => {
    const content = `---
name: shop
description: Shop
base_url: https://api.shop.com
type: PRODUCT
pricingModel: cart
payment:
  asset: USDC
  networks:
    - network: base
      payTo: "0x1234567890abcdef1234567890abcdef12345678"
endpoints:
  - path: /v1/orders
    method: POST
    description: Checkout
    priceUsdc: dynamic
    estimatedPriceUsdc: "25.00"
    deliveryMode: sync
  - path: /v1/subscribe
    method: POST
    description: Subscribe
    priceUsdc: "10.00"
    duration: "30d"
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.pricingModel).toBe('cart')
    expect(manifest.endpoints[0].priceUsdc).toBe('dynamic')
    expect(manifest.endpoints[0].estimatedPriceUsdc).toBe('25.00')
    expect(manifest.endpoints[0].deliveryMode).toBe('sync')
    expect(manifest.endpoints[1].duration).toBe('30d')
  })

  it('parses auth config', () => {
    const content = `---
name: saas
description: SaaS
base_url: https://api.saas.com
type: SUBSCRIPTION
pricingModel: subscription
auth:
  method: wallet-signature
  loginEndpoint: /v1/auth
payment:
  asset: USDC
  networks:
    - network: base
      payTo: "0x1234567890abcdef1234567890abcdef12345678"
endpoints:
  - path: /v1/subscribe
    method: POST
    description: Subscribe
    priceUsdc: "10.00"
    duration: "30d"
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.pricingModel).toBe('subscription')
    expect(manifest.auth).toEqual({
      method: 'wallet-signature',
      loginEndpoint: '/v1/auth'
    })
  })

  it('converts legacy flat payTo/payToEvm to per-network config', () => {
    const content = `---
name: legacy-multi
description: Legacy multi-chain
base_url: https://api.example.com
type: API
payment:
  networks: [stellar, base]
  asset: USDC
  payTo: GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW
  payToEvm: "0x1234567890abcdef1234567890abcdef12345678"
  facilitator: https://facilitator.402.md
endpoints:
  - path: /v1/run
    method: POST
    description: Run it
    priceUsdc: "0.01"
---

body`

    const manifest = parseSkillMd(content)
    expect(manifest.payment.networks).toHaveLength(2)
    // Stellar gets the payTo address
    expect(manifest.payment.networks[0]).toEqual({
      network: 'stellar',
      payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
      facilitator: 'https://facilitator.402.md'
    })
    // Base gets the payToEvm address
    expect(manifest.payment.networks[1]).toEqual({
      network: 'base',
      payTo: '0x1234567890abcdef1234567890abcdef12345678',
      facilitator: 'https://facilitator.402.md'
    })
  })
})

describe('parseFrontmatter', () => {
  it('returns raw frontmatter data', () => {
    const { data, body } = parseFrontmatter(LEGACY_V1)
    expect(data.name).toBe('my-skill')
    expect(data.base_url).toBe('https://api.example.com')
    expect(body).toContain('# My Skill')
  })

  it('returns default for content without frontmatter', () => {
    const { data, body } = parseFrontmatter('no frontmatter')
    expect(data.name).toBe('unknown')
    expect(body).toBe('no frontmatter')
  })
})
