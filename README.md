# @402md/skillmd

**The `package.json` for paid AI agent APIs.**

SKILL.md is an open format that describes what an API does, how much it costs, and how to pay — in a single markdown file that both humans and AI agents can read. Think of it as a machine-readable menu for your API.

This package parses, validates, generates, and converts SKILL.md files. One dependency (`yaml`). Works in Node, browsers, and edge runtimes.

```bash
npm install @402md/skillmd
```

## Why SKILL.md?

AI agents need to discover and pay for APIs autonomously. Today, there's no standard way for an API to say "I cost $0.001 per call, pay me in USDC on Stellar." SKILL.md solves that — one file, readable by any agent framework.

- **For API sellers** — Describe your endpoints, set prices, get paid via [x402](https://www.x402.org/)
- **For agent builders** — Parse any SKILL.md, auto-generate MCP tools, let agents pay and call APIs
- **For framework authors** — Validate and convert between SKILL.md, OpenAPI, and MCP tool definitions

## Quick Start

### Parse

```typescript
import { parseSkillMd } from '@402md/skillmd'

const manifest = parseSkillMd(`---
name: weather-api
description: Real-time weather data
base_url: https://api.weatherco.com
type: API
payment:
  networks: [stellar, base]
  asset: USDC
  payTo: GABC...XYZ
endpoints:
  - path: /v1/current
    method: POST
    description: Get current weather
    priceUsdc: "0.001"
---

# Weather API
`)

manifest.name                // 'weather-api'
manifest.payment.networks    // ['stellar', 'base']
manifest.endpoints[0].path   // '/v1/current'
```

From a file:

```typescript
import { readFileSync } from 'node:fs'
import { parseSkillMd } from '@402md/skillmd'

const manifest = parseSkillMd(readFileSync('./SKILL.md', 'utf-8'))
```

### Validate

Catch problems before publishing:

```typescript
import { validateSkillMd } from '@402md/skillmd'

const result = validateSkillMd(content)

if (!result.valid) {
  result.errors.forEach(e => console.error(`${e.field}: ${e.message}`))
}
// Warnings for missing optional fields (version, tags, etc.)
result.warnings.forEach(w => console.warn(`${w.field}: ${w.message}`))
```

### Generate

Create a SKILL.md from code:

```typescript
import { generateSkillMd } from '@402md/skillmd'

const skillMd = generateSkillMd({
  name: 'my-api',
  description: 'Does cool things',
  base_url: 'https://api.example.com',
  payment: {
    networks: ['stellar'],
    asset: 'USDC',
    payTo: 'GABC...XYZ'
  },
  endpoints: [
    {
      path: '/v1/run',
      method: 'POST',
      description: 'Run the thing',
      priceUsdc: '0.001'
    }
  ]
})
// Returns a complete SKILL.md string with frontmatter + body
```

### SKILL.md to MCP Tools

Turn any SKILL.md into MCP tool definitions. No `@modelcontextprotocol/sdk` dependency — just the shape your MCP server needs:

```typescript
import { parseSkillMd, toMcpToolDefinitions } from '@402md/skillmd'

const tools = toMcpToolDefinitions(parseSkillMd(content))
// [
//   {
//     name: 'weather-api_v1_current',
//     description: 'Get current weather (0.001 USDC via stellar)',
//     inputSchema: { type: 'object', properties: { location: { type: 'string' } } }
//   }
// ]
```

Each endpoint becomes one tool. `inputSchema` is passed through directly, so MCP clients get full type information.

### OpenAPI Interop

Already have a Swagger spec? Convert it to SKILL.md:

```typescript
import { generateFromOpenAPI } from '@402md/skillmd'

const manifest = generateFromOpenAPI(openApiSpec, {
  networks: ['base'],
  asset: 'USDC',
  payTo: '0xabc...def'
}, {
  pricing: {
    'GET /pets': '0.001',
    'POST /pets': '0.05',
    '*': '0.005'  // fallback
  }
})
```

Going the other way — export any SKILL.md as OpenAPI 3.0 for Swagger UI, Postman, or any OpenAPI tool:

```typescript
import { toOpenAPI } from '@402md/skillmd'

const spec = toOpenAPI(manifest)
// spec.paths['/v1/current'].post.responses['402'].description = 'Payment Required — 0.001 USDC'
```

## SKILL.md Format (v2)

```yaml
---
name: weather-api
displayName: Weather API
description: Real-time weather data for any location worldwide
version: 1.0.0
author: weatherco
base_url: https://api.weatherco.com
type: API

payment:
  networks:
    - stellar
    - base
  asset: USDC
  payTo: GABC...XYZ
  facilitator: https://x402.org/facilitator

endpoints:
  - path: /v1/current
    method: POST
    description: Get current weather for a location
    priceUsdc: "0.001"
    inputSchema:
      type: object
      properties:
        location:
          type: string
      required: [location]
    outputSchema:
      type: object
      properties:
        temperature:
          type: number
        conditions:
          type: string

tags: [weather, geolocation]
category: data
sla: "99.9%"
rateLimit: 1000/hour
sandbox: https://sandbox.weatherco.com
---

# Weather API

Real-time weather data for any location worldwide.
```

### Required fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (kebab-case) |
| `description` | What the skill does |
| `base_url` | Base URL of the API |
| `payment.networks` | Supported chains (`stellar`, `base`, `base-sepolia`, `stellar-testnet`) |
| `payment.payTo` | Recipient wallet address |
| `endpoints[].path` | Endpoint path (starts with `/`) |
| `endpoints[].method` | HTTP method |
| `endpoints[].description` | What the endpoint does |
| `endpoints[].priceUsdc` | Price per call in USDC (e.g. `"0.001"`) |

### Optional fields

| Field | Description |
|-------|-------------|
| `displayName` | Human-readable name |
| `version` | Semver version |
| `author` | Author name |
| `type` | `API` \| `SAAS` \| `PRODUCT` \| `SERVICE` \| `SUBSCRIPTION` \| `CONTENT` |
| `payment.asset` | Payment asset (default: `USDC`) |
| `payment.payToEvm` | EVM address fallback |
| `payment.facilitator` | Facilitator URL |
| `endpoints[].inputSchema` | JSON Schema for request body |
| `endpoints[].outputSchema` | JSON Schema for response |
| `tags` | Discovery tags |
| `category` | Skill category |
| `sla` | Uptime guarantee |
| `rateLimit` | Rate limit |
| `sandbox` | Free test endpoint URL |

## API Reference

### Parse

| Function | Description |
|----------|-------------|
| `parseSkillMd(content)` | Parse a SKILL.md string into a `SkillManifest` |
| `parseFrontmatter(md)` | Extract raw frontmatter (lower-level, v1-compat) |

### Validate

| Function | Description |
|----------|-------------|
| `validateSkill(manifest)` | Validate a `SkillManifest` object |
| `validateSkillMd(content)` | Parse + validate a raw SKILL.md string |

### Generate & Convert

| Function | Description |
|----------|-------------|
| `generateSkillMd(config)` | Generate a SKILL.md string from a `SkillConfig` |
| `generateFromOpenAPI(spec, payment, options?)` | OpenAPI spec to `SkillManifest` |
| `toOpenAPI(manifest)` | `SkillManifest` to OpenAPI 3.0 spec |
| `toMcpToolDefinitions(manifest)` | `SkillManifest` to MCP `McpToolDefinition[]` |

### Schema & Constants

| Export | Description |
|--------|-------------|
| `SKILLMD_JSON_SCHEMA` | JSON Schema for v2 frontmatter — for external validators (ajv, zod, etc.) |
| `SKILL_TYPES` | Valid skill types (`['API', 'SAAS', ...]`) |
| `HTTP_METHODS` | Valid HTTP methods (`['GET', 'POST', ...]`) |
| `PAYMENT_NETWORKS` | Valid payment networks (`['stellar', 'base', ...]`) |

> `SKILLMD_JSON_SCHEMA` is for external consumers who want to validate with ajv or similar. The built-in `validateSkill()` / `validateSkillMd()` use manual validation for better error messages.

## Legacy v1 Support

The parser handles v1 SKILL.md files (without the `payment` block). The `price` field on endpoints is mapped to `priceUsdc`, and payment defaults to `{ networks: ['base'], asset: 'USDC', payTo: '' }`.

## License

MIT
