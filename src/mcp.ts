import type { SkillManifest } from './types'

/**
 * MCP tool definition shape.
 * Defined inline to avoid depending on @modelcontextprotocol/sdk.
 */
export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * Convert a SkillManifest into MCP tool definitions.
 * Each endpoint becomes one tool.
 */
export function toMcpToolDefinitions(
  manifest: SkillManifest
): McpToolDefinition[] {
  return manifest.endpoints.map(ep => {
    const slug = ep.path
      .replace(/^\//, '')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')

    const network = manifest.payment.networks[0] ?? 'unknown'

    return {
      name: `${manifest.name}_${slug}`,
      description: `${ep.description} (${ep.priceUsdc} USDC via ${network})`,
      inputSchema: ep.inputSchema ?? { type: 'object', properties: {} }
    }
  })
}
