import { describe, it, expect } from 'vitest'
import { toAgentCard } from '../src/a2a'
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

describe('toAgentCard', () => {
  it('produces a spec-compliant card with all required fields', () => {
    const card = toAgentCard(makeManifest())

    expect(card.schemaVersion).toBe('1.0')
    expect(card.humanReadableId).toBe('weather-api')
    expect(card.agentVersion).toBe('1.0.0')
    expect(card.name).toBe('weather-api')
    expect(card.description).toBe('Real-time weather data')
    expect(card.url).toBe('https://api.weatherco.com')
    expect(card.protocolVersion).toBe('0.3.0')
    expect(card.preferredTransport).toBe('REST')
    expect(card.provider).toEqual({ name: 'weather-api' })
    expect(card.capabilities).toEqual({ a2aVersion: '0.3.0' })
    expect(card.authSchemes).toEqual([{ scheme: 'x402' }])
  })

  it('uses displayName for name when available', () => {
    const card = toAgentCard(
      makeManifest({ displayName: 'Weather Pro API' })
    )

    expect(card.name).toBe('Weather Pro API')
  })

  it('uses author/name for humanReadableId', () => {
    const card = toAgentCard(makeManifest({ author: 'weatherco' }))

    expect(card.humanReadableId).toBe('weatherco/weather-api')
  })

  it('converts endpoints to skills with correct ids', () => {
    const card = toAgentCard(makeManifest())

    expect(card.skills).toHaveLength(2)
    expect(card.skills![0]).toMatchObject({
      id: 'weather-api_v1_current',
      name: 'Get current weather',
      description: 'POST /v1/current — 0.001 USDC'
    })
    expect(card.skills![1]).toMatchObject({
      id: 'weather-api_v1_forecast',
      name: '7-day forecast',
      description: 'POST /v1/forecast — 0.005 USDC'
    })
  })

  it('defaults auth to x402', () => {
    const card = toAgentCard(makeManifest())

    expect(card.authSchemes).toEqual([{ scheme: 'x402' }])
  })

  it('uses manifest version for agentVersion', () => {
    const card = toAgentCard(makeManifest({ version: '2.3.1' }))

    expect(card.agentVersion).toBe('2.3.1')
  })

  it('allows overriding all options', () => {
    const card = toAgentCard(makeManifest(), {
      url: 'https://custom.example.com',
      providerName: 'Custom Corp',
      providerUrl: 'https://custom.corp',
      authSchemes: [{ scheme: 'bearer' }],
      preferredTransport: 'JSONRPC',
      streaming: true,
      pushNotifications: false,
      documentationUrl: 'https://docs.example.com'
    })

    expect(card.url).toBe('https://custom.example.com')
    expect(card.provider).toEqual({
      name: 'Custom Corp',
      url: 'https://custom.corp'
    })
    expect(card.authSchemes).toEqual([{ scheme: 'bearer' }])
    expect(card.preferredTransport).toBe('JSONRPC')
    expect(card.capabilities).toEqual({
      a2aVersion: '0.3.0',
      streaming: true,
      pushNotifications: false
    })
    expect(card.documentationUrl).toBe('https://docs.example.com')
  })

  it('handles empty endpoints', () => {
    const card = toAgentCard(makeManifest({ endpoints: [] }))

    expect(card.skills).toBeUndefined()
  })

  it('sets inputModes when inputSchema is present', () => {
    const card = toAgentCard(makeManifest())

    expect(card.skills![0].inputModes).toEqual(['application/json'])
    expect(card.skills![1].inputModes).toBeUndefined()
  })

  it('sets outputModes when outputSchema is present', () => {
    const card = toAgentCard(
      makeManifest({
        endpoints: [
          {
            path: '/v1/data',
            method: 'GET',
            description: 'Get data',
            priceUsdc: '0.01',
            outputSchema: { type: 'object' }
          }
        ]
      })
    )

    expect(card.skills![0].outputModes).toEqual(['application/json'])
  })

  it('includes manifest tags on skills', () => {
    const card = toAgentCard(
      makeManifest({ tags: ['weather', 'forecast'] })
    )

    expect(card.skills![0].tags).toEqual(['weather', 'forecast'])
  })

  it('uses author as provider name when available', () => {
    const card = toAgentCard(makeManifest({ author: 'weatherco' }))

    expect(card.provider.name).toBe('weatherco')
  })
})
