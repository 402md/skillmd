# SKILL.md Specification v2.0

> **Status:** Draft
> **Created:** 2026-03-15
> **Authors:** 402md contributors
> **Reference Implementation:** [@402md/skillmd](https://github.com/402-md/skillmd)

## Abstract

SKILL.md is an open format for describing capabilities that AI agents can discover, understand, and use — including paid APIs, free tools, and agent instructions. A single markdown file, readable by both humans and machines, serves as the universal descriptor for the agent economy.

SKILL.md is designed as a **superset** of existing skill formats (including [Anthropic Claude Code skills](https://docs.anthropic.com/en/docs/claude-code)) and extends them with payment, endpoint, and discovery metadata. Any valid Anthropic skill is a valid SKILL.md. Any valid SKILL.md is usable by agents that understand the format.

---

## 1. Design Goals

1. **Human-readable** — A SKILL.md is a markdown file. Developers read it, edit it, commit it.
2. **Machine-parseable** — YAML frontmatter provides structured metadata for agents and tools.
3. **Framework-agnostic** — Works with MCP, A2A, OpenAPI, LangChain, or any agent framework.
4. **Payment-native** — First-class support for pricing, payment networks, and non-custodial settlement.
5. **Backwards-compatible** — Anthropic Claude Code skills (name + description) parse as valid SKILL.md.
6. **Extensible** — Unknown frontmatter fields are preserved, not rejected.

---

## 2. File Format

A SKILL.md file consists of two parts separated by `---` delimiters:

```
---
[YAML frontmatter]
---

[Markdown body]
```

- **Frontmatter** — YAML between the opening and closing `---`. Contains structured metadata.
- **Body** — Markdown content after the closing `---`. Contains documentation, instructions, or both.
- **Encoding** — UTF-8. Both LF and CRLF line endings are accepted.
- **File name** — MUST be `SKILL.md` (case-sensitive).

### 2.1 Frontmatter Extraction

The frontmatter is extracted using the following pattern:

```
^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$
```

The first capture group is the YAML content. The second is the markdown body.

---

## 3. Frontmatter Schema

### 3.1 Core Fields

These fields are shared with the Anthropic Claude Code skill format and provide base compatibility.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | **Yes** | Unique identifier. Kebab-case (`^[a-z0-9][a-z0-9_-]*$`). Max 100 chars. |
| `description` | `string` | **Yes** | What this skill does. Max 2000 chars. For agent-invoked skills, use trigger phrases (see §3.1.1). |
| `version` | `string` | No | Semantic version (`MAJOR.MINOR.PATCH`). |

#### 3.1.1 Description Format

The `description` field serves two purposes:

1. **Human discovery** — Tells developers what the skill does.
2. **Agent triggering** — Tells AI agents when to invoke the skill.

For skills intended to be auto-invoked by agents (e.g., Claude Code skills), use the Anthropic trigger phrase pattern:

```yaml
description: >-
  This skill should be used when the user asks to "scrape a website",
  "extract web data", "crawl pages", or needs web content extraction.
  Real-time web scraping API with structured output.
```

For pure API descriptors, a plain description is sufficient:

```yaml
description: Real-time web scraping API with structured output
```

Both styles are valid. Parsers MUST accept both.

### 3.2 Identity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `displayName` | `string` | No | Human-readable name (max 200 chars). Falls back to `name`. |
| `author` | `string` | No | Author or organization name (max 100 chars). |
| `license` | `string` | No | License identifier (e.g., `MIT`, `proprietary`). |

### 3.3 Classification Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `SkillType` | No | `API` | Category of the skill. |
| `tags` | `string[]` | No | `[]` | Discovery tags (max 20 items). |
| `category` | `string` | No | — | Primary category for marketplace listing. |

**SkillType** enum:

| Value | Description |
|-------|-------------|
| `API` | RESTful API endpoint(s) |
| `SAAS` | Software-as-a-Service with API access |
| `PRODUCT` | Digital product (dataset, model, etc.) |
| `SERVICE` | Human-in-the-loop or async service |
| `SUBSCRIPTION` | Recurring access |
| `CONTENT` | Static content (docs, reports, etc.) |
| `SKILL` | Agent instruction/prompt (no paid endpoints) |

> **Note:** The `SKILL` type indicates a pure agent instruction (Anthropic-style skill) with no paid endpoints. The `payment` and `endpoints` fields are optional when `type: SKILL`.

### 3.4 Service Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `base_url` | `string` (URL) | Conditional | Base URL of the API. **Required** when `endpoints` is present. |
| `sla` | `string` | No | Uptime guarantee (e.g., `"99.9%"`). |
| `rateLimit` | `string` | No | Rate limit (e.g., `"1000/hour"`). |
| `sandbox` | `string` (URL) | No | Free test endpoint URL. |

### 3.5 Payment Fields

The `payment` block describes how agents pay for the skill. It is **required** when `endpoints` is present, and **optional** when `type: SKILL`.

```yaml
payment:
  networks:
    - stellar
    - base
  asset: USDC
  payTo: GABC...XYZ
  payToEvm: 0xabc...def
  facilitator: https://facilitator.402.md
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `payment.networks` | `PaymentNetwork[]` | **Yes** | — | Supported payment networks (min 1). |
| `payment.asset` | `string` | No | `USDC` | Payment asset/token. |
| `payment.payTo` | `string` | **Yes** | — | Primary recipient address (Stellar G-address or EVM 0x-address). |
| `payment.payToEvm` | `string` | No | — | EVM address fallback (`^0x[a-fA-F0-9]{40}$`). |
| `payment.facilitator` | `string` (URL) | No | — | Facilitator service URL for payment verification and settlement. |

**PaymentNetwork** enum:

| Value | Description |
|-------|-------------|
| `stellar` | Stellar mainnet |
| `stellar-testnet` | Stellar testnet |
| `base` | Base mainnet (Coinbase L2) |
| `base-sepolia` | Base Sepolia testnet |

### 3.6 Endpoint Fields

The `endpoints` array describes callable API endpoints with per-call pricing.

```yaml
endpoints:
  - path: /v1/scrape
    method: POST
    description: Scrape a URL and return structured content
    priceUsdc: "0.005"
    inputSchema:
      type: object
      properties:
        url:
          type: string
          format: uri
      required: [url]
    outputSchema:
      type: object
      properties:
        content:
          type: string
        title:
          type: string
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoints[].path` | `string` | **Yes** | Endpoint path. MUST start with `/`. |
| `endpoints[].method` | `HttpMethod` | **Yes** | HTTP method. |
| `endpoints[].description` | `string` | **Yes** | What this endpoint does. |
| `endpoints[].priceUsdc` | `string` | **Yes** | Price per call in USDC (e.g., `"0.001"`). Decimal format: `^\d+(\.\d+)?$`. |
| `endpoints[].inputSchema` | `JSONSchema` | No | JSON Schema for the request body. |
| `endpoints[].outputSchema` | `JSONSchema` | No | JSON Schema for the response body. |

**HttpMethod** enum: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.

### 3.7 Agent Integration Fields

These fields support integration with agent frameworks.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allowed-tools` | `string \| string[]` | No | Tools the skill is allowed to use (Anthropic compatibility). E.g., `"Bash"`, `["Bash", "Read", "Write"]`. |

### 3.8 Extensibility

The frontmatter schema allows additional properties (`additionalProperties: true`). Parsers MUST preserve unknown fields and MUST NOT reject them. This enables ecosystem-specific extensions without breaking compatibility.

Example extensions:

```yaml
# MCP-specific
mcp_server: "@402md/mcp"

# Marketplace-specific
marketplace:
  featured: true
  verified: true

# Custom
x-internal-id: "12345"
```

---

## 4. Markdown Body

The body section after the frontmatter closing `---` is **the most important part of a SKILL.md**. The frontmatter provides structured metadata for tooling, but the body is what an AI agent actually reads to understand how to use the skill.

> **Key insight:** No LLM has been trained on x402. The body MUST teach the agent what x402 is, how payment works, and how to call each endpoint — step by step, with examples.

### 4.1 Recommended Body Structure

The body SHOULD follow this structure for paid APIs. Each section is designed so that an agent reading the SKILL.md top-to-bottom has everything it needs to operate autonomously.

```markdown
# {Skill Name}

{One-paragraph description of what this skill does and when to use it.}

## Payment Protocol (x402)

{Explain the payment flow so the agent understands what happens when it
makes a request. This section is critical — without it, agents won't
know how to handle HTTP 402 responses.}

## Authentication

{Explain how the agent authenticates. For x402 skills, this is typically
"No API keys needed — pay per request via x402." For hybrid skills,
explain any additional auth requirements.}

## Endpoints

{For each endpoint: description, method, path, price, input/output
with concrete examples. Show full request/response payloads.}

### {Endpoint Name}

**{METHOD} {path}** — ${price} USDC

{Description of what this endpoint does.}

**Request:**
{Show the exact JSON body the agent should send.}

**Response:**
{Show the exact JSON the agent will receive.}

## Workflow

{Step-by-step guide for common use cases. Tell the agent exactly
what sequence of calls to make and in what order.}

## Error Handling

{What errors can occur and what the agent should do about each one.}

## Pricing Summary

{Quick reference table of all endpoints and their costs.}
```

### 4.2 x402 Payment Instructions

Every SKILL.md for a paid API MUST include instructions that teach the agent the x402 payment flow. Agents have not been trained on x402 — this is the only way they learn.

**Recommended x402 section:**

```markdown
## Payment Protocol (x402)

This API uses the x402 payment protocol. No API keys or accounts needed.
Payment is per-request in USDC on {network}.

**How it works:**

1. Make a normal HTTP request to any endpoint
2. The server responds with HTTP 402 (Payment Required) and a JSON body
   containing payment requirements (amount, recipient address, network)
3. Sign a USDC transfer authorization with your wallet (non-custodial,
   no funds leave your wallet until verified)
4. Retry the same request with the signed payment in the `X-PAYMENT` header
5. The server verifies the payment, settles on-chain, and returns the result

**If using @402md/mcp:** Payment is handled automatically. Just call the
endpoint via `use_skill` and the MCP server handles steps 2-5.

**If calling directly:** Use `x402Fetch()` from `@402md/x402` which
auto-handles the 402 → sign → retry flow.
```

### 4.3 Endpoint Documentation

Each endpoint SHOULD include complete request/response examples that an agent can copy directly. Abstract descriptions are insufficient — agents need concrete payloads.

**Good (agent can execute immediately):**

```markdown
### Scrape a URL

**POST /v1/scrape** — $0.005 USDC

Extract structured content from any webpage.

**Request:**
\`\`\`json
{
  "url": "https://example.com/article",
  "format": "markdown",
  "javascript": false
}
\`\`\`

**Response:**
\`\`\`json
{
  "title": "Example Article",
  "content": "# Article Title\n\nArticle body in markdown...",
  "metadata": {
    "author": "John Doe",
    "publishedAt": "2026-03-15"
  }
}
\`\`\`

**Parameters:**
- `url` (required): The URL to scrape. Must be a valid HTTP/HTTPS URL.
- `format`: Output format. `markdown` (default), `html`, or `text`.
- `javascript`: Set to `true` for SPAs/dynamic pages. Slower but renders JS.
```

**Bad (agent cannot execute):**

```markdown
### Scrape

Scrapes a URL and returns content.
```

### 4.4 Workflow Instructions

For skills with multiple endpoints, include a workflow section that tells the agent the exact sequence of operations for common tasks. Write in imperative form.

```markdown
## Workflow

### Get current weather for a city

1. Call `POST /v1/current` with `{ "location": "São Paulo" }` ($0.001)
2. If the user wants a forecast, call `POST /v1/forecast`
   with `{ "location": "São Paulo", "days": 7 }` ($0.005)
3. Always tell the user the cost before making the call
4. If the location is ambiguous, ask the user to clarify before calling

### Compare weather across cities

1. Call `POST /v1/current` once per city (each call costs $0.001)
2. Present results in a comparison table
3. Total cost = $0.001 × number of cities — confirm with user first
```

### 4.5 Error Handling Instructions

Tell the agent what to do when things go wrong. Agents that don't know how to handle errors will either crash or hallucinate.

```markdown
## Error Handling

| Status | Meaning | What to do |
|--------|---------|------------|
| 400 | Bad request | Check input format. Show the error message to the user. |
| 402 | Payment required | This is normal — the x402 flow handles it automatically. |
| 403 | Insufficient funds | Tell the user to fund their wallet. Show balance. |
| 404 | Not found | The resource doesn't exist. Don't retry. |
| 429 | Rate limited | Wait 60 seconds and retry once. If still 429, tell the user. |
| 500 | Server error | Retry once after 5 seconds. If still failing, tell the user. |
```

### 4.6 Body for Agent Skills (`type: SKILL`)

For pure agent instructions (no paid endpoints), the body follows the Anthropic convention — imperative form, step-by-step procedures:

```markdown
# Code Reviewer

When reviewing code, follow these steps:
1. Read the file completely before commenting
2. Check for security vulnerabilities (OWASP top 10)
3. Verify error handling at system boundaries
4. Suggest improvements only when asked
```

### 4.7 Body Length Guidelines

| Skill complexity | Recommended body length |
|-----------------|------------------------|
| Simple (1-2 endpoints) | 500-1,000 words |
| Medium (3-5 endpoints) | 1,000-3,000 words |
| Complex (6+ endpoints, workflows) | 3,000-8,000 words |
| Platform API (many features) | 5,000-15,000 words |

Longer is better than shorter. An agent with too much context wastes tokens. An agent with too little context makes wrong API calls, wastes money, and fails. **Err on the side of more detail.**

---

## 5. Skill Profiles

A SKILL.md can serve different use cases. The required fields vary by profile:

### 5.1 Paid API Profile

For services that charge per API call via x402.

**Required:** `name`, `description`, `base_url`, `payment`, `endpoints`

```yaml
---
name: web-scraper
description: Real-time web scraping with structured output
base_url: https://api.scraper.dev
type: API
payment:
  networks: [stellar]
  asset: USDC
  payTo: GABC...XYZ
endpoints:
  - path: /v1/scrape
    method: POST
    description: Scrape a URL
    priceUsdc: "0.005"
---
```

### 5.2 Agent Skill Profile

For Claude Code skills and agent instructions. Compatible with Anthropic's format.

**Required:** `name`, `description`

```yaml
---
name: code-reviewer
description: >-
  This skill should be used when the user asks to "review code",
  "check for bugs", "audit this file", or mentions code quality.
version: 1.0.0
allowed-tools: [Read, Grep, Glob]
---

# Code Reviewer

When reviewing code, follow these steps:
1. Read the file completely before commenting
2. Check for security vulnerabilities (OWASP top 10)
3. Verify error handling at boundaries
4. Suggest improvements only when asked
```

### 5.3 Hybrid Profile

A paid API that also provides agent instructions for how to use it.

**Required:** `name`, `description`, `base_url`, `payment`, `endpoints`

```yaml
---
name: weather-api
description: >-
  This skill should be used when the user asks about "weather",
  "temperature", "forecast", or needs meteorological data.
  Real-time weather data for any location worldwide.
base_url: https://api.weatherco.com
type: API
version: 1.0.0
payment:
  networks: [stellar, base]
  asset: USDC
  payTo: GABC...XYZ
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
      required: [location]
tags: [weather, geolocation]
---

# Weather API

When the user asks about weather:
1. Call `/v1/current` with the location ($0.001 per call)
2. If they want a forecast, call `/v1/forecast` ($0.005)
3. Always show the cost before making the call

## Quick Start

POST /v1/current with `{ "location": "São Paulo" }`
Returns `{ "temperature": 28, "conditions": "partly cloudy" }`
```

---

## 6. Conversions

A SKILL.md can be converted to and from multiple formats:

### 6.1 To MCP Tool Definitions

Each endpoint becomes an MCP tool:

| SKILL.md | MCP Tool |
|----------|----------|
| `name` + `endpoints[].path` | `tool.name` (e.g., `weather-api_v1_current`) |
| `endpoints[].description` | `tool.description` (appended with price info) |
| `endpoints[].inputSchema` | `tool.inputSchema` |

### 6.2 To A2A Agent Card

The SKILL.md maps to [Google A2A Protocol](https://google.github.io/A2A/) Agent Card v0.3.0:

| SKILL.md | Agent Card |
|----------|------------|
| `name` | `humanReadableId` |
| `displayName` \|\| `name` | `name` |
| `description` | `description` |
| `base_url` | `url` |
| `version` | `agentVersion` |
| `author` | `provider.name` |
| `endpoints[]` | `skills[]` |
| `payment` | `authSchemes[{ scheme: "x402" }]` |

### 6.3 To/From OpenAPI

- **SKILL.md → OpenAPI**: Each endpoint becomes a path operation. A `402` response is added with the price.
- **OpenAPI → SKILL.md**: Each path operation becomes an endpoint. Prices are provided via a pricing map.

---

## 7. Payment Protocol (x402)

SKILL.md uses the [x402 protocol](https://www.x402.org/) for payments. The flow:

```
Agent                          Skill Server                    Facilitator
  │                                │                               │
  │  1. Request endpoint           │                               │
  ├───────────────────────────────►│                               │
  │                                │                               │
  │  2. HTTP 402 + PaymentRequired │                               │
  │◄───────────────────────────────┤                               │
  │                                │                               │
  │  3. Sign payment               │                               │
  │  (local, non-custodial)        │                               │
  │                                │                               │
  │  4. Retry with X-PAYMENT header│                               │
  ├───────────────────────────────►│                               │
  │                                │  5. Verify + settle           │
  │                                ├──────────────────────────────►│
  │                                │                               │
  │                                │  6. Confirmation              │
  │                                │◄──────────────────────────────┤
  │                                │                               │
  │  7. Response (200)             │                               │
  │◄───────────────────────────────┤                               │
```

- **Non-custodial**: The agent signs a payment authorization locally. The facilitator settles on-chain. No party holds funds.
- **Atomic**: On Stellar, settlement uses a transaction with multiple payment operations. On Base, a Solidity contract splits in a single transaction.
- **Gasless**: The facilitator covers gas fees. The agent and seller pay zero gas.

---

## 8. Directory Structure

A SKILL.md can be a standalone file or part of a skill package:

### 8.1 Standalone (API)

```
project/
└── SKILL.md
```

### 8.2 Skill Package (Anthropic-compatible)

```
skill-name/
├── SKILL.md              # Required
├── references/           # Loaded on demand
│   ├── api-docs.md
│   └── examples.md
├── scripts/              # Executable utilities
│   └── validate.sh
└── assets/               # Output resources
    └── template.html
```

### 8.3 Monorepo with Multiple Skills

```
project/
├── SKILL.md              # Root skill (the API itself)
└── skills/               # Agent skills that use the API
    ├── weather-helper/
    │   └── SKILL.md
    └── forecast-analyst/
        └── SKILL.md
```

---

## 9. Validation Rules

### 9.1 Errors (MUST fix)

| Rule | Field | Description |
|------|-------|-------------|
| `MISSING_NAME` | `name` | Name is required |
| `INVALID_NAME` | `name` | Must match `^[a-z0-9][a-z0-9_-]*$` |
| `MISSING_DESCRIPTION` | `description` | Description is required |
| `MISSING_BASE_URL` | `base_url` | Required when endpoints are present |
| `INVALID_BASE_URL` | `base_url` | Must be a valid URL |
| `MISSING_PAYMENT` | `payment` | Required when endpoints are present |
| `MISSING_NETWORKS` | `payment.networks` | At least one network required |
| `INVALID_NETWORK` | `payment.networks[]` | Must be a valid PaymentNetwork |
| `MISSING_PAY_TO` | `payment.payTo` | Recipient address required |
| `MISSING_ENDPOINTS` | `endpoints` | At least one endpoint required (unless `type: SKILL`) |
| `INVALID_PATH` | `endpoints[].path` | Must start with `/` |
| `INVALID_METHOD` | `endpoints[].method` | Must be a valid HttpMethod |
| `INVALID_PRICE` | `endpoints[].priceUsdc` | Must match `^\d+(\.\d+)?$` |
| `DUPLICATE_ENDPOINT` | `endpoints[]` | Duplicate `{method} {path}` |

### 9.2 Warnings (SHOULD fix)

| Rule | Field | Description |
|------|-------|-------------|
| `MISSING_VERSION` | `version` | Recommended for published skills |
| `INVALID_VERSION` | `version` | Should follow semver |
| `MISSING_TAGS` | `tags` | Recommended for discovery |
| `TOO_MANY_TAGS` | `tags` | Max 20 tags |
| `UNRECOGNIZED_ADDRESS` | `payment.payTo` | Address doesn't match known formats |

---

## 10. JSON Schema

The canonical JSON Schema for SKILL.md frontmatter validation is available at:

```
https://skillmd.dev/schema/v2.json
```

And programmatically via:

```typescript
import { SKILLMD_JSON_SCHEMA } from '@402md/skillmd'
```

The schema uses JSON Schema Draft 2020-12 and sets `additionalProperties: true` for extensibility.

---

## 11. Compatibility Matrix

| Feature | Anthropic Skills | 402md SKILL.md | Status |
|---------|-----------------|----------------|--------|
| `name` | Required | Required | **Compatible** |
| `description` | Required (trigger phrases) | Required (any format) | **Superset** |
| `version` | Optional | Optional | **Compatible** |
| `license` | Optional | Optional | **Compatible** |
| `allowed-tools` | Optional | Optional | **Compatible** |
| `payment` | Not supported | Optional/Required | **Extension** |
| `endpoints` | Not supported | Optional/Required | **Extension** |
| `base_url` | Not supported | Conditional | **Extension** |
| `type` | Implicit (always skill) | Explicit enum | **Extension** |
| `tags` | Not supported | Optional | **Extension** |
| `author` | Not supported | Optional | **Extension** |
| Body as instructions | Yes | Yes (all types) | **Compatible** |
| Body as documentation | Not typical | Yes (API types) | **Superset** |
| `references/` directory | Supported | Supported | **Compatible** |
| `scripts/` directory | Supported | Supported | **Compatible** |
| `assets/` directory | Supported | Supported | **Compatible** |

**Any valid Anthropic Claude Code skill is a valid SKILL.md.** The 402md parser accepts Anthropic skills without modification. Additional fields (`payment`, `endpoints`, etc.) are extensions that enable payment and API discovery.

---

## 12. MIME Type

The recommended MIME type for SKILL.md files is:

```
text/markdown; variant=skillmd
```

When served over HTTP, the `Content-Type` header SHOULD be `text/markdown`.

---

## 13. Discovery

Skills can be discovered through multiple channels:

| Channel | Mechanism |
|---------|-----------|
| **File system** | Read `./SKILL.md` or `./skills/*/SKILL.md` |
| **URL** | Fetch `https://example.com/SKILL.md` |
| **GitHub** | Raw URL: `https://raw.githubusercontent.com/.../SKILL.md` |
| **npm** | Package includes `SKILL.md` at root |
| **A2A** | `GET /.well-known/agent-card.json` (converted from SKILL.md) |
| **Registry** | Search via `@402md/mcp` → `search_skills` tool |
| **Marketplace** | Browse at `https://402.md/marketplace` |

---

## 14. Security Considerations

- **Payment amounts**: Agents SHOULD enforce budget limits before making payments.
- **Private keys**: MUST be stored locally (e.g., `~/.402md/wallet.json` with mode `0600`). Private keys MUST NOT be transmitted.
- **Facilitator trust**: The facilitator settles payments but never holds funds. Settlement is atomic and on-chain verifiable.
- **Input validation**: Parsers MUST validate all fields before use. Untrusted SKILL.md files SHOULD be validated with `validateSkill()` before execution.
- **URL handling**: `base_url` and endpoint paths MUST be sanitized before constructing request URLs.

---

## 15. Reference Implementation

The reference implementation is [`@402md/skillmd`](https://github.com/402-md/skillmd):

```bash
npm install @402md/skillmd
```

```typescript
import {
  parseSkillMd,
  validateSkill,
  generateSkillMd,
  toMcpToolDefinitions,
  toAgentCard,
  toOpenAPI,
  SKILLMD_JSON_SCHEMA
} from '@402md/skillmd'
```

---

## 16. Related Specifications

| Specification | Relationship |
|--------------|-------------|
| [x402 Protocol](https://www.x402.org/) | Payment protocol used by SKILL.md |
| [A2A Protocol](https://google.github.io/A2A/) | Agent discovery. SKILL.md converts to Agent Card. |
| [MCP](https://modelcontextprotocol.io/) | Agent tool protocol. SKILL.md converts to MCP tools. |
| [OpenAPI 3.0](https://spec.openapis.org/oas/v3.0.4.html) | API description. Bidirectional conversion with SKILL.md. |
| [Claude Code Skills](https://docs.anthropic.com/en/docs/claude-code) | Agent skills. SKILL.md is a compatible superset. |

---

## Appendix A: Full Example (Agent-Ready)

This is a complete SKILL.md with the instruction layer that enables any agent to use the API autonomously. Notice how every section teaches the agent what to do.

````yaml
---
name: web-scraper-pro
displayName: Web Scraper Pro
description: >-
  This skill should be used when the user asks to "scrape a website",
  "extract web content", "crawl a page", "get text from a URL", or
  needs HTML-to-structured-data conversion.
  High-performance web scraping API with JavaScript rendering.
version: 2.1.0
author: scrapeco
base_url: https://api.scraper.pro
type: API
license: proprietary

payment:
  networks:
    - stellar
    - base
  asset: USDC
  payTo: GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW
  payToEvm: "0x1234567890abcdef1234567890abcdef12345678"
  facilitator: https://facilitator.402.md

endpoints:
  - path: /v1/scrape
    method: POST
    description: Scrape a URL and return structured content
    priceUsdc: "0.005"
    inputSchema:
      type: object
      properties:
        url:
          type: string
          format: uri
          description: URL to scrape
        format:
          type: string
          enum: [markdown, html, text]
          default: markdown
        javascript:
          type: boolean
          default: false
          description: Enable JavaScript rendering
      required: [url]
    outputSchema:
      type: object
      properties:
        content:
          type: string
        title:
          type: string
        metadata:
          type: object

  - path: /v1/screenshot
    method: POST
    description: Take a full-page screenshot of a webpage
    priceUsdc: "0.01"
    inputSchema:
      type: object
      properties:
        url:
          type: string
          format: uri
        width:
          type: integer
          default: 1280
        height:
          type: integer
          default: 800
        fullPage:
          type: boolean
          default: false
      required: [url]
    outputSchema:
      type: object
      properties:
        imageUrl:
          type: string
        format:
          type: string
        sizeBytes:
          type: integer

tags: [scraping, web, html, extraction, screenshot]
category: data
sla: "99.9%"
rateLimit: 500/hour
sandbox: https://sandbox.scraper.pro/v1/scrape
---

# Web Scraper Pro

High-performance web scraping API with JavaScript rendering support.
Extract structured content from any webpage or take screenshots.
No API keys needed — pay per request via x402 in USDC.

## Payment Protocol (x402)

This API uses the x402 payment protocol. No API keys or accounts needed.
Payment is per-request in USDC on Stellar or Base.

**How it works:**

1. Make a normal HTTP request to any endpoint below
2. The server responds with HTTP 402 (Payment Required) and a JSON body
   containing payment requirements (amount, recipient, network)
3. Sign a USDC transfer authorization with your wallet — non-custodial,
   funds only move after the server verifies your signature
4. Retry the same request with the signed payment in the `X-PAYMENT` header
5. The server verifies payment, settles on-chain atomically, and returns the result

**If using @402md/mcp:** Payment is handled automatically. Call the endpoint
via `use_skill` and the MCP server handles the entire 402 → sign → retry flow.

**If calling directly with code:**
```typescript
import { x402Fetch } from '@402md/x402'

const response = await x402Fetch('https://api.scraper.pro/v1/scrape', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com' }),
  stellarSecret: process.env.STELLAR_SECRET,
  network: 'stellar'
})
```

## Authentication

No API keys, no accounts, no registration. Authentication IS the payment.
Each request is independently paid via x402. The agent's wallet signature
serves as both authentication and payment authorization.

## Endpoints

### Scrape a URL

**POST /v1/scrape** — $0.005 USDC per call

Extract structured content from any webpage. Returns clean markdown,
HTML, or plain text with metadata.

**Request:**
```json
POST https://api.scraper.pro/v1/scrape
Content-Type: application/json

{
  "url": "https://example.com/blog/ai-agents",
  "format": "markdown",
  "javascript": false
}
```

**Response (200):**
```json
{
  "title": "The Rise of AI Agents",
  "content": "# The Rise of AI Agents\n\nAI agents are transforming...",
  "metadata": {
    "author": "Jane Smith",
    "publishedAt": "2026-03-10",
    "language": "en",
    "wordCount": 1423
  }
}
```

**Parameters:**
- `url` (required): Full URL to scrape. Must be HTTP or HTTPS.
- `format`: Output format. Options: `markdown` (default), `html`, `text`.
- `javascript`: Set `true` for single-page apps (React, Vue, etc.) that
  render content via JavaScript. Adds ~2-5 seconds to response time.
  Default: `false`.

**When to use `javascript: true`:**
- The page is a React/Vue/Angular SPA
- Content loads dynamically after page load
- The initial HTML is mostly empty `<div id="root">`

**When to use `javascript: false` (default):**
- Standard blogs, news sites, documentation
- Static HTML pages
- When speed matters more than completeness

### Take a Screenshot

**POST /v1/screenshot** — $0.01 USDC per call

Capture a visual screenshot of any webpage. Returns a hosted image URL.

**Request:**
```json
POST https://api.scraper.pro/v1/screenshot
Content-Type: application/json

{
  "url": "https://example.com",
  "width": 1280,
  "height": 800,
  "fullPage": false
}
```

**Response (200):**
```json
{
  "imageUrl": "https://cdn.scraper.pro/screenshots/abc123.png",
  "format": "png",
  "sizeBytes": 245832
}
```

**Parameters:**
- `url` (required): Full URL to screenshot.
- `width`: Viewport width in pixels. Default: `1280`.
- `height`: Viewport height in pixels. Default: `800`.
- `fullPage`: Capture the entire scrollable page, not just the viewport.
  Default: `false`.

**Note:** The `imageUrl` is valid for 24 hours. Download or display it promptly.

## Workflow

### Extract text from a webpage

1. Call `POST /v1/scrape` with `{ "url": "...", "format": "markdown" }`
2. Cost: $0.005. Confirm with user if they haven't pre-approved spending.
3. Return the `content` field to the user.

### Scrape a JavaScript-heavy page (SPA)

1. First try without JavaScript: `{ "url": "...", "javascript": false }`
2. If the content is empty or just boilerplate, retry with `"javascript": true`
3. Total cost if retry needed: $0.01 (two calls)

### Get a visual snapshot of a page

1. Call `POST /v1/screenshot` with the URL
2. Cost: $0.01
3. Display the `imageUrl` to the user

### Compare content across multiple pages

1. Call `POST /v1/scrape` for each URL
2. Cost: $0.005 × number of URLs
3. Tell the user total cost before starting: "This will cost $X for Y pages"
4. Wait for user confirmation, then execute all calls

## Error Handling

| Status | Meaning | What to do |
|--------|---------|------------|
| 400 | Invalid input | Check that `url` is a valid HTTP/HTTPS URL. Show error to user. |
| 402 | Payment Required | Normal x402 flow — handled automatically by @402md/x402 or MCP. |
| 403 | Insufficient funds | Tell user: "Wallet balance too low. Fund your wallet to continue." |
| 404 | URL not reachable | The target URL returned 404. Tell user the page doesn't exist. |
| 429 | Rate limited | Wait 60 seconds and retry once. Max 500 requests/hour. |
| 500 | Server error | Retry once after 5 seconds. If still failing, tell user. |
| 504 | Timeout | The page took too long to load. Try with `javascript: false`. |

## Pricing Summary

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/v1/scrape` | POST | $0.005 | Extract content from URL |
| `/v1/screenshot` | POST | $0.01 | Capture visual screenshot |

**Cost examples:**
- Scrape 1 article: $0.005
- Scrape 10 articles: $0.05
- Screenshot + scrape of same page: $0.015
- Scrape SPA with JS retry: $0.01

## Sandbox (Free Testing)

Test the scrape endpoint for free (limited to example.com):
```
POST https://sandbox.scraper.pro/v1/scrape
{ "url": "https://example.com" }
```
No payment required. Use this to verify your integration works before
making paid calls.
````

---

## Appendix B: Changelog

### v2.0 (2026-03-15)

- Added `payment` block with multi-network support
- Added `endpoints[].inputSchema` and `outputSchema` (JSON Schema)
- Added `type` enum with `SKILL` value for pure agent instructions
- Added `allowed-tools` for Anthropic Claude Code compatibility
- Added `license` field
- Added `sandbox`, `sla`, `rateLimit` fields
- Added `displayName` field
- Formalized compatibility with Anthropic skill format
- Published JSON Schema at `https://skillmd.dev/schema/v2.json`

### v1.0 (legacy)

- Basic frontmatter: `name`, `description`, `base_url`, `type`
- Endpoints with `price` field (mapped to `priceUsdc` in v2)
- No payment block (defaults to Base/USDC)
