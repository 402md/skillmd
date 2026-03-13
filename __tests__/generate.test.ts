import { describe, it, expect } from 'vitest'
import {
  generateSkillMd,
  generateFromOpenAPI,
  toOpenAPI
} from '../src/generate'
import { parseSkillMd } from '../src/parse'
import type { OpenAPISpec, SkillConfig, SkillManifest } from '../src/types'

const CONFIG: SkillConfig = {
  name: 'weather-api',
  displayName: 'Weather API',
  description: 'Real-time weather data',
  version: '1.0.0',
  base_url: 'https://api.weatherco.com',
  type: 'API',
  payment: {
    networks: ['stellar', 'base'],
    asset: 'USDC',
    payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
    facilitator: 'https://x402.org/facilitator'
  },
  endpoints: [
    {
      path: '/v1/current',
      method: 'POST',
      description: 'Get current weather',
      priceUsdc: '0.001',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        }
      }
    }
  ],
  tags: ['weather'],
  category: 'data'
}

describe('generateSkillMd', () => {
  it('generates a valid SKILL.md', () => {
    const output = generateSkillMd(CONFIG)

    expect(output).toContain('---')
    expect(output).toContain('name: weather-api')
    expect(output).toContain('# Weather API')
  })

  it('generates SKILL.md that can be re-parsed', () => {
    const output = generateSkillMd(CONFIG)
    const manifest = parseSkillMd(output)

    expect(manifest.name).toBe('weather-api')
    expect(manifest.displayName).toBe('Weather API')
    expect(manifest.description).toBe('Real-time weather data')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.base_url).toBe('https://api.weatherco.com')
    expect(manifest.type).toBe('API')
    expect(manifest.payment.networks).toEqual(['stellar', 'base'])
    expect(manifest.payment.payTo).toBe(
      'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW'
    )
    expect(manifest.endpoints).toHaveLength(1)
    expect(manifest.endpoints[0].priceUsdc).toBe('0.001')
    expect(manifest.tags).toEqual(['weather'])
    expect(manifest.category).toBe('data')
  })

  it('uses custom body when provided', () => {
    const output = generateSkillMd({
      ...CONFIG,
      body: '# Custom Body\n\nCustom content here.'
    })

    expect(output).toContain('# Custom Body')
    expect(output).toContain('Custom content here.')
  })

  it('omits optional fields when not provided', () => {
    const minimal: SkillConfig = {
      name: 'minimal',
      description: 'Minimal skill',
      base_url: 'https://example.com',
      payment: {
        networks: ['base'],
        asset: 'USDC',
        payTo: '0x1234567890abcdef1234567890abcdef12345678'
      },
      endpoints: [
        {
          path: '/test',
          method: 'POST',
          description: 'Test',
          priceUsdc: '0.01'
        }
      ]
    }

    const output = generateSkillMd(minimal)
    expect(output).not.toContain('displayName')
    expect(output).not.toContain('version')
    expect(output).not.toContain('author')
    expect(output).not.toContain('tags')
    expect(output).not.toContain('sla')
  })
})

describe('generateFromOpenAPI', () => {
  const OPENAPI_SPEC: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Pet Store API',
      description: 'A sample pet store',
      version: '1.0.0'
    },
    servers: [{ url: 'https://petstore.example.com' }],
    paths: {
      '/pets': {
        get: {
          summary: 'List all pets',
          responses: {
            '200': {
              description: 'A list of pets',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { type: 'object' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create a pet',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  it('converts OpenAPI spec to a manifest', () => {
    const manifest = generateFromOpenAPI(OPENAPI_SPEC, {
      networks: ['base'],
      asset: 'USDC',
      payTo: '0x1234567890abcdef1234567890abcdef12345678'
    })

    expect(manifest.name).toBe('pet-store-api')
    expect(manifest.displayName).toBe('Pet Store API')
    expect(manifest.base_url).toBe('https://petstore.example.com')
    expect(manifest.endpoints).toHaveLength(2)

    const getEndpoint = manifest.endpoints.find(e => e.method === 'GET')
    expect(getEndpoint?.path).toBe('/pets')
    expect(getEndpoint?.description).toBe('List all pets')
    expect(getEndpoint?.outputSchema).toEqual({
      type: 'array',
      items: { type: 'object' }
    })

    const postEndpoint = manifest.endpoints.find(e => e.method === 'POST')
    expect(postEndpoint?.inputSchema).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } }
    })
  })

  it('uses default price and allows override', () => {
    const manifest = generateFromOpenAPI(
      OPENAPI_SPEC,
      { networks: ['base'], asset: 'USDC', payTo: '0x123' },
      { defaultPrice: '0.05' }
    )

    expect(manifest.endpoints[0].priceUsdc).toBe('0.05')
  })

  it('allows base URL override', () => {
    const manifest = generateFromOpenAPI(
      OPENAPI_SPEC,
      { networks: ['stellar'], asset: 'USDC', payTo: 'GABC...' },
      { baseUrlOverride: 'https://custom.example.com' }
    )

    expect(manifest.base_url).toBe('https://custom.example.com')
  })

  it('applies per-endpoint pricing', () => {
    const manifest = generateFromOpenAPI(
      OPENAPI_SPEC,
      { networks: ['base'], asset: 'USDC', payTo: '0x123' },
      {
        pricing: {
          'GET /pets': '0.001',
          'POST /pets': '0.05'
        }
      }
    )

    const get = manifest.endpoints.find(e => e.method === 'GET')
    const post = manifest.endpoints.find(e => e.method === 'POST')
    expect(get?.priceUsdc).toBe('0.001')
    expect(post?.priceUsdc).toBe('0.05')
  })

  it('uses wildcard fallback in pricing', () => {
    const manifest = generateFromOpenAPI(
      OPENAPI_SPEC,
      { networks: ['base'], asset: 'USDC', payTo: '0x123' },
      {
        pricing: {
          'POST /pets': '0.10',
          '*': '0.002'
        }
      }
    )

    const get = manifest.endpoints.find(e => e.method === 'GET')
    const post = manifest.endpoints.find(e => e.method === 'POST')
    expect(get?.priceUsdc).toBe('0.002') // wildcard
    expect(post?.priceUsdc).toBe('0.10') // exact match
  })

  it('falls back to defaultPrice when pricing has no match', () => {
    const manifest = generateFromOpenAPI(
      OPENAPI_SPEC,
      { networks: ['base'], asset: 'USDC', payTo: '0x123' },
      {
        defaultPrice: '0.007',
        pricing: {
          'DELETE /pets': '0.99' // won't match any endpoint
        }
      }
    )

    expect(manifest.endpoints[0].priceUsdc).toBe('0.007')
    expect(manifest.endpoints[1].priceUsdc).toBe('0.007')
  })
})

describe('toOpenAPI', () => {
  const MANIFEST: SkillManifest = {
    name: 'weather-api',
    displayName: 'Weather API',
    description: 'Real-time weather data',
    version: '2.0.0',
    base_url: 'https://api.weatherco.com',
    type: 'API',
    payment: {
      networks: ['stellar'],
      asset: 'USDC',
      payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW'
    },
    endpoints: [
      {
        path: '/v1/current',
        method: 'POST',
        description: 'Get current weather',
        priceUsdc: '0.001',
        inputSchema: {
          type: 'object',
          properties: { location: { type: 'string' } }
        },
        outputSchema: {
          type: 'object',
          properties: { temperature: { type: 'number' } }
        }
      },
      {
        path: '/v1/forecast',
        method: 'GET',
        description: '7-day forecast',
        priceUsdc: '0.005'
      }
    ],
    body: ''
  }

  it('produces a valid OpenAPI 3.0 spec', () => {
    const spec = toOpenAPI(MANIFEST)

    expect(spec.openapi).toBe('3.0.3')
    expect(spec.info.title).toBe('Weather API')
    expect(spec.info.description).toBe('Real-time weather data')
    expect(spec.info.version).toBe('2.0.0')
    expect(spec.servers).toEqual([{ url: 'https://api.weatherco.com' }])
  })

  it('maps endpoints to paths', () => {
    const spec = toOpenAPI(MANIFEST)

    expect(spec.paths['/v1/current']).toBeDefined()
    expect(spec.paths['/v1/current'].post).toBeDefined()
    expect(spec.paths['/v1/forecast']).toBeDefined()
    expect(spec.paths['/v1/forecast'].get).toBeDefined()
  })

  it('includes requestBody for POST/PUT/PATCH', () => {
    const spec = toOpenAPI(MANIFEST)
    const post = spec.paths['/v1/current'].post!

    expect(post.requestBody?.content?.['application/json']?.schema).toEqual({
      type: 'object',
      properties: { location: { type: 'string' } }
    })
  })

  it('does not include requestBody for GET', () => {
    const spec = toOpenAPI(MANIFEST)
    const get = spec.paths['/v1/forecast'].get!

    expect(get.requestBody).toBeUndefined()
  })

  it('includes outputSchema in 200 response', () => {
    const spec = toOpenAPI(MANIFEST)
    const post = spec.paths['/v1/current'].post!

    expect(
      post.responses?.['200']?.content?.['application/json']?.schema
    ).toEqual({
      type: 'object',
      properties: { temperature: { type: 'number' } }
    })
  })

  it('includes 402 response with price', () => {
    const spec = toOpenAPI(MANIFEST)
    const post = spec.paths['/v1/current'].post!

    expect(post.responses?.['402']?.description).toBe(
      'Payment Required — 0.001 USDC'
    )
  })

  it('roundtrips with generateFromOpenAPI', () => {
    const spec = toOpenAPI(MANIFEST)
    const roundtripped = generateFromOpenAPI(spec, MANIFEST.payment)

    expect(roundtripped.name).toBe('weather-api')
    expect(roundtripped.endpoints).toHaveLength(2)
    expect(roundtripped.endpoints[0].path).toBe('/v1/current')
    expect(roundtripped.endpoints[0].method).toBe('POST')
  })
})
