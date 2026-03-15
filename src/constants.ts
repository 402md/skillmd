import type { HttpMethod, PaymentNetwork, SkillType } from './types'

export const SKILL_TYPES: readonly SkillType[] = [
  'API',
  'SAAS',
  'PRODUCT',
  'SERVICE',
  'SUBSCRIPTION',
  'CONTENT',
  'SKILL'
] as const

export const HTTP_METHODS: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH'
] as const

export const PAYMENT_NETWORKS: readonly PaymentNetwork[] = [
  'stellar',
  'base',
  'base-sepolia',
  'stellar-testnet'
] as const

export const SKILL_TYPES_SET = new Set<string>(SKILL_TYPES)
export const HTTP_METHODS_SET = new Set<string>(HTTP_METHODS)
export const PAYMENT_NETWORKS_SET = new Set<string>(PAYMENT_NETWORKS)

export const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
