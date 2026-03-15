import { SKILL_TYPES, HTTP_METHODS, PAYMENT_NETWORKS } from './constants'

/**
 * JSON Schema for SKILL.md v2 frontmatter validation.
 * Can be used with any JSON Schema validator (ajv, zod, etc).
 *
 * Enums are derived from the shared constants in constants.ts
 * so they stay in sync with the parser and validator.
 */
export const SKILLMD_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SKILL.md Frontmatter',
  description: 'Schema for the YAML frontmatter in a SKILL.md file',
  type: 'object',
  required: ['name', 'description'],
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9_-]*$',
      minLength: 1,
      maxLength: 100,
      description: 'Unique skill identifier (kebab-case)'
    },
    displayName: {
      type: 'string',
      maxLength: 200,
      description: 'Human-readable name'
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 2000,
      description: 'What this skill does. For agent-invoked skills, use trigger phrases.'
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+',
      description: 'Semantic version'
    },
    author: {
      type: 'string',
      maxLength: 100
    },
    license: {
      type: 'string',
      description: 'License identifier (e.g. MIT, proprietary)'
    },
    base_url: {
      type: 'string',
      format: 'uri',
      description: 'Base URL of the API'
    },
    type: {
      type: 'string',
      enum: [...SKILL_TYPES],
      default: 'API'
    },
    payment: {
      type: 'object',
      required: ['networks', 'payTo'],
      properties: {
        networks: {
          type: 'array',
          items: {
            type: 'string',
            enum: [...PAYMENT_NETWORKS]
          },
          minItems: 1,
          description: 'Supported payment networks'
        },
        asset: {
          type: 'string',
          default: 'USDC',
          description: 'Payment asset'
        },
        payTo: {
          type: 'string',
          minLength: 1,
          description: 'Recipient address (Stellar or EVM)'
        },
        payToEvm: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'EVM address (fallback)'
        },
        facilitator: {
          type: 'string',
          format: 'uri',
          description: 'Facilitator URL'
        }
      },
      additionalProperties: false
    },
    endpoints: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'method', 'description', 'priceUsdc'],
        properties: {
          path: {
            type: 'string',
            pattern: '^/',
            description: 'Endpoint path (must start with /)'
          },
          method: {
            type: 'string',
            enum: [...HTTP_METHODS]
          },
          description: {
            type: 'string',
            minLength: 1
          },
          priceUsdc: {
            type: 'string',
            pattern: '^\\d+(\\.\\d+)?$',
            description: 'Price in USDC (e.g. "0.001")'
          },
          inputSchema: {
            type: 'object',
            description: 'JSON Schema for request body'
          },
          outputSchema: {
            type: 'object',
            description: 'JSON Schema for response body'
          }
        },
        additionalProperties: false
      },
      minItems: 1
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 20
    },
    category: {
      type: 'string'
    },
    sla: {
      type: 'string',
      description: 'Uptime guarantee (e.g. "99.9%")'
    },
    rateLimit: {
      type: 'string',
      description: 'Rate limit (e.g. "1000/hour")'
    },
    sandbox: {
      type: 'string',
      format: 'uri',
      description: 'Free test endpoint URL'
    },
    'allowed-tools': {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } }
      ],
      description:
        'Tools the skill is allowed to use (Anthropic Claude Code compatibility)'
    },
    allowedTools: {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } }
      ],
      description: 'Alias for allowed-tools (camelCase)'
    }
  },
  additionalProperties: true
} as const
