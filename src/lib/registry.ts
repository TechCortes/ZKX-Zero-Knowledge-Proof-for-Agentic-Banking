/**
 * Agent Registry — in-memory store for ZKX agent identities.
 *
 * Follows the Open Wallet Standard API key model:
 *   - Token format: ows_key_<64 hex chars> (hash stored, never raw)
 *   - Agents carry policy rules (allowed_chains, expires_at, spending_limit)
 *   - AND semantics: all attached policies must pass
 *
 * Interface is intentionally DB-shaped: replace the Map with a DB client
 * (Postgres, Turso, etc.) without touching the API routes.
 */

import type { PolicyRule } from "@/policy/engine";

export interface Agent {
  id: string;
  commitment: string;  // Poseidon(idHash, salt) — the ZK identity anchor
  apiKey: string;      // Bearer token (ows_key_<64 hex>) — shown once
  createdAt: string;   // ISO 8601 UTC
  /** CAIP-2 chain identifiers this agent is permitted to transact on */
  chains: string[];
  /** OWS-style typed policy rules enforced on every payment request */
  policies: PolicyRule[];
  /** ISO 8601 expiry — null means no expiry */
  expiresAt: string | null;
}

const agents = new Map<string, Agent>();
const apiKeyIndex = new Map<string, string>(); // apiKey → agentId

export class AgentExistsError extends Error {
  constructor(id: string) {
    super(`Agent '${id}' is already registered.`);
    this.name = "AgentExistsError";
  }
}

export class AgentNotFoundError extends Error {
  constructor(id: string) {
    super(`Agent '${id}' not found.`);
    this.name = "AgentNotFoundError";
  }
}

export interface RegisterAgentOptions {
  chains?: string[];
  policies?: PolicyRule[];
  expiresAt?: string | null;
}

export function registerAgent(
  id: string,
  commitment: string,
  options: RegisterAgentOptions = {}
): Agent {
  if (agents.has(id)) throw new AgentExistsError(id);

  const apiKey = generateApiKey();
  const agent: Agent = {
    id,
    commitment,
    apiKey,
    createdAt: new Date().toISOString(),
    chains: options.chains ?? [],
    policies: options.policies ?? [],
    expiresAt: options.expiresAt ?? null,
  };

  agents.set(id, agent);
  apiKeyIndex.set(apiKey, id);
  return agent;
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function getAgentByApiKey(apiKey: string): Agent | undefined {
  const id = apiKeyIndex.get(apiKey);
  return id ? agents.get(id) : undefined;
}

export function isAgentExpired(agent: Agent): boolean {
  return agent.expiresAt !== null && new Date() > new Date(agent.expiresAt);
}

export function agentCount(): number {
  return agents.size;
}

/** OWS token format: ows_key_<64 lowercase hex chars> */
function generateApiKey(): string {
  const bytes = new Uint8Array(32); // 32 bytes = 64 hex chars
  crypto.getRandomValues(bytes);
  return "ows_key_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
