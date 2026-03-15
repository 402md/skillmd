# @402md/skillmd

[![npm version](https://img.shields.io/npm/v/@402md/skillmd)](https://www.npmjs.com/package/@402md/skillmd)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org)
[![x402](https://img.shields.io/badge/x402-compatible-green)](https://x402.org)
[![A2A](https://img.shields.io/badge/A2A-v0.3.0-00C853)](https://google.github.io/A2A/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

**The universal descriptor for AI agent capabilities.**

SKILL.md is an open format for describing what a service does, how much it costs, and how agents can use it — in a single markdown file readable by both humans and machines.

This package is the **reference implementation** of the [SKILL.md Specification v2.0](./SPEC.md). One dependency (`yaml`). Works in Node, browsers, and edge runtimes.

```bash
npm install @402md/skillmd
```

## The Specification

The full [SKILL.md Specification](./SPEC.md) defines the format, validation rules, compatibility guarantees, and conversion targets. The spec is designed around three principles:

1. **Superset of Anthropic Claude Code skills** — Any valid Claude Code skill is a valid SKILL.md. The format extends (never conflicts with) the Anthropic frontmatter convention.
2. **Payment-native** — First-class support for per-call pricing, multi-chain settlement (Stellar, Base), and non-custodial payment via [x402](https://www.x402.org/).
3. **Framework-agnostic** — Converts to MCP tools, A2A Agent Cards, and OpenAPI specs.

## Skill Profiles

SKILL.md supports three profiles depending on what you're describing:

### Paid API — Endpoints with pricing

```yaml
---
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
```

### Agent Skill — Instructions for AI agents (Anthropic-compatible)

```yaml
---
name: code-reviewer
description: >-
  This skill should be used when the user asks to "review code",
  "check for bugs", or mentions code quality.
version: 1.0.0
allowed-tools: [Read, Grep, Glob]
---

# Code Reviewer

When reviewing code, check for security vulnerabilities first.
```

No `base_url`, `payment`, or `endpoints` needed. This is a valid Claude Code skill AND a valid SKILL.md.

### Hybrid — Paid API with agent instructions

```yaml
---
name: web-scraper
description: >-
  This skill should be used when the user asks to "scrape a website"
  or "extract web content". High-performance scraping API.
base_url: https://api.scraper.pro
type: API
allowed-tools: [Read, Bash]
payment:
  networks: [stellar]
  payTo: GABC...XYZ
endpoints:
  - path: /v1/scrape
    method: POST
    description: Scrape a URL
    priceUsdc: "0.005"
---

# Web Scraper

When the user asks to scrape, call /v1/scrape with the target URL.
Always confirm the $0.005 cost before making paid calls.
```

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
manifest.type                // 'API'
manifest.payment.networks    // ['stellar', 'base']
manifest.endpoints[0].path   // '/v1/current'
```

Anthropic-style skills work too:

```typescript
const skill = parseSkillMd(`---
name: my-helper
description: Helps with things
allowed-tools: Bash
---

Do the thing.
`)

skill.type                   // 'SKILL' (auto-inferred, no endpoints)
skill.allowedTools           // ['Bash']
```

From a file:

```typescript
import { readFileSync } from 'node:fs'
import { parseSkillMd } from '@402md/skillmd'

const manifest = parseSkillMd(readFileSync('./SKILL.md', 'utf-8'))
```

### Validate

```typescript
import { validateSkillMd } from '@402md/skillmd'

const result = validateSkillMd(content)

if (!result.valid) {
  result.errors.forEach(e => console.error(`${e.field}: ${e.message}`))
}
result.warnings.forEach(w => console.warn(`${w.field}: ${w.message}`))
```

For `type: SKILL`, validation skips `base_url`, `payment`, and `endpoints` — only `name` and `description` are required.

### Generate

```typescript
import { generateSkillMd } from '@402md/skillmd'

// Paid API
const apiSkill = generateSkillMd({
  name: 'my-api',
  description: 'Does cool things',
  base_url: 'https://api.example.com',
  payment: {
    networks: ['stellar'],
    asset: 'USDC',
    payTo: 'GABC...XYZ'
  },
  endpoints: [
    { path: '/v1/run', method: 'POST', description: 'Run the thing', priceUsdc: '0.001' }
  ]
})

// Agent skill (Anthropic-compatible)
const agentSkill = generateSkillMd({
  name: 'my-helper',
  description: 'This skill should be used when the user asks to do things.',
  type: 'SKILL',
  allowedTools: ['Read', 'Bash'],
  body: '# My Helper\n\nDo the thing step by step.'
})
```

### Convert to MCP Tools

```typescript
import { parseSkillMd, toMcpToolDefinitions } from '@402md/skillmd'

const tools = toMcpToolDefinitions(parseSkillMd(content))
// [{ name: 'weather-api_v1_current', description: 'Get current weather (0.001 USDC via stellar)', inputSchema: ... }]
```

### Convert to A2A Agent Card

```typescript
import { parseSkillMd, toAgentCard } from '@402md/skillmd'

const card = toAgentCard(parseSkillMd(content))
// Serves at /.well-known/agent-card.json via @402md/a2a
```

### OpenAPI Interop

```typescript
import { generateFromOpenAPI, toOpenAPI } from '@402md/skillmd'

// OpenAPI → SKILL.md
const manifest = generateFromOpenAPI(openApiSpec, {
  networks: ['base'], asset: 'USDC', payTo: '0xabc...def'
}, {
  pricing: { 'GET /pets': '0.001', '*': '0.005' }
})

// SKILL.md → OpenAPI
const spec = toOpenAPI(manifest)
```

## Anthropic Compatibility

SKILL.md v2 is a **superset** of [Anthropic Claude Code skills](https://docs.anthropic.com/en/docs/claude-code). The compatibility guarantee:

| Feature | Anthropic Skills | SKILL.md v2 | Status |
|---------|-----------------|-------------|--------|
| `name` | Required | Required | Compatible |
| `description` | Required (trigger phrases) | Required (any format) | Superset |
| `version` | Optional | Optional | Compatible |
| `license` | Optional | Optional | Compatible |
| `allowed-tools` | Optional | Optional | Compatible |
| `references/` directory | Supported | Supported | Compatible |
| `scripts/` directory | Supported | Supported | Compatible |
| `assets/` directory | Supported | Supported | Compatible |
| `payment` | N/A | Optional | Extension |
| `endpoints` | N/A | Optional | Extension |
| `base_url` | N/A | Conditional | Extension |

**Any valid Anthropic skill parses and validates without modification.** Additional fields like `payment` and `endpoints` are extensions — they never conflict with the Anthropic schema.

The parser accepts both `allowed-tools` (Anthropic's kebab-case) and `allowedTools` (camelCase).

## SKILL.md Format (v2)

Full format with all fields:

```yaml
---
name: weather-api
displayName: Weather API
description: Real-time weather data for any location worldwide
version: 1.0.0
author: weatherco
license: MIT
base_url: https://api.weatherco.com
type: API

payment:
  networks:
    - stellar
    - base
  asset: USDC
  payTo: GABC...XYZ
  payToEvm: "0xabc...def"
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

tags: [weather, geolocation]
category: data
sla: "99.9%"
rateLimit: 1000/hour
sandbox: https://sandbox.weatherco.com
allowed-tools: [Read, Bash]
---

# Weather API

Real-time weather data for any location worldwide.
```

### Required fields

For `type: API` (or any type with endpoints):

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

For `type: SKILL` (agent instructions only):

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (kebab-case) |
| `description` | What the skill does / when to trigger |

### Optional fields

| Field | Description |
|-------|-------------|
| `displayName` | Human-readable name |
| `version` | Semver version |
| `author` | Author name |
| `license` | License identifier (`MIT`, `proprietary`, etc.) |
| `type` | `API` \| `SAAS` \| `PRODUCT` \| `SERVICE` \| `SUBSCRIPTION` \| `CONTENT` \| `SKILL` |
| `payment.asset` | Payment asset (default: `USDC`) |
| `payment.payToEvm` | EVM address fallback |
| `payment.facilitator` | Facilitator URL |
| `endpoints[].inputSchema` | JSON Schema for request body |
| `endpoints[].outputSchema` | JSON Schema for response |
| `tags` | Discovery tags (max 20) |
| `category` | Skill category |
| `sla` | Uptime guarantee |
| `rateLimit` | Rate limit |
| `sandbox` | Free test endpoint URL |
| `allowed-tools` | Tools the skill can use (Anthropic compat) |

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
| `toMcpToolDefinitions(manifest)` | `SkillManifest` to MCP tool definitions |
| `toAgentCard(manifest)` | `SkillManifest` to A2A Agent Card |

### Schema & Constants

| Export | Description |
|--------|-------------|
| `SKILLMD_JSON_SCHEMA` | JSON Schema (Draft 2020-12) for external validators |
| `SKILL_TYPES` | Valid skill types |
| `HTTP_METHODS` | Valid HTTP methods |
| `PAYMENT_NETWORKS` | Valid payment networks |

## Ecosystem

SKILL.md is the foundation of the 402md ecosystem:

| Package | Role |
|---------|------|
| [`@402md/skillmd`](https://github.com/402-md/skillmd) | Parser, validator, generator (this package) |
| [`@402md/x402`](https://github.com/402-md/x402) | x402 payment protocol (client + server) |
| [`@402md/mcp`](https://github.com/402-md/mcp) | MCP server — agents discover and pay for skills |
| [`@402md/a2a`](https://github.com/402-md/a2a) | A2A Agent Card serving from SKILL.md |

## Legacy v1 Support

The parser handles v1 SKILL.md files (without the `payment` block). The `price` field on endpoints is mapped to `priceUsdc`, and payment defaults to `{ networks: ['base'], asset: 'USDC', payTo: '' }`.

## License

MIT
