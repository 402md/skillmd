import { describe, it, expect } from 'vitest'
import { toMcpToolDefinitions } from '../src/mcp'
import type { SkillManifest } from '../src/types'

function makeManifest(
  overrides: Partial<SkillManifest> = {}
): SkillManifest {
  return {
    name: 'weather-api',
    description: 'Real-time weather data',
    base_url: 'https://api.weatherco.com',
    type: 'API',
    payment: {
      networks: [
        {
          network: 'stellar',
          payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW'
        }
      ],
      asset: 'USDC'
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
          },
          required: ['location']
        }
      },
      {
        path: '/v1/forecast',
        method: 'POST',
        description: '7-day forecast',
        priceUsdc: '0.005'
      }
    ],
    body: '# Weather API',
    ...overrides
  }
}

describe('toMcpToolDefinitions', () => {
  it('converts endpoints to MCP tool definitions', () => {
    const tools = toMcpToolDefinitions(makeManifest())

    expect(tools).toHaveLength(2)

    expect(tools[0].name).toBe('weather-api_v1_current')
    expect(tools[0].description).toBe(
      'Get current weather (0.001 USDC via stellar)'
    )
    expect(tools[0].inputSchema).toEqual({
      type: 'object',
      properties: { location: { type: 'string' } },
      required: ['location']
    })
  })

  it('uses empty schema when inputSchema is missing', () => {
    const tools = toMcpToolDefinitions(makeManifest())

    expect(tools[1].name).toBe('weather-api_v1_forecast')
    expect(tools[1].inputSchema).toEqual({
      type: 'object',
      properties: {}
    })
  })

  it('slugifies path correctly', () => {
    const tools = toMcpToolDefinitions(
      makeManifest({
        endpoints: [
          {
            path: '/api/v2/weather/current',
            method: 'GET',
            description: 'Weather',
            priceUsdc: '0.01'
          }
        ]
      })
    )

    expect(tools[0].name).toBe('weather-api_api_v2_weather_current')
  })

  it('includes network in description', () => {
    const tools = toMcpToolDefinitions(
      makeManifest({
        payment: {
          networks: [
            { network: 'base', payTo: '0x1234567890abcdef1234567890abcdef12345678' },
            { network: 'stellar', payTo: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW' }
          ],
          asset: 'USDC'
        }
      })
    )

    expect(tools[0].description).toContain('via base')
  })

  it('shows dynamic pricing in description', () => {
    const tools = toMcpToolDefinitions(
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
    expect(tools[0].description).toContain('dynamic pricing')
    expect(tools[0].description).toContain('~25.00 USDC est.')
  })

  it('shows dynamic pricing without estimate', () => {
    const tools = toMcpToolDefinitions(
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
    expect(tools[0].description).toContain('dynamic pricing')
    expect(tools[0].description).not.toContain('est.')
  })

  it('returns fallback tool for manifest with no endpoints', () => {
    const tools = toMcpToolDefinitions(
      makeManifest({ endpoints: [] })
    )

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('weather-api')
    expect(tools[0].description).toBe('Real-time weather data')
  })
})
