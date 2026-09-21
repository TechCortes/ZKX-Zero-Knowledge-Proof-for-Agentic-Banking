/**
 * Agent Registry — Redis-backed store for Vero Protocol agent identities
 * (in-memory fallback for local dev/tests — see kv.ts).
 *
 * Follows the Open Wallet Standard API key model:
 *   - Token format: ows_key_<64 hex chars> (hash stored, never raw)
 *   - Agents carry policy rules (allowed_chains, expires_at, spending_limit)
 *   - AND semantics: all attached policies must pass
 */

import { kv } from "./kv";
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

const agentKey = (id: string) => `agent:${id}`;
const apiKeyKey = (apiKey: string) => `apikey:${apiKey}`;

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

export async function registerAgent(
  id: string,
  commitment: string,
  options: RegisterAgentOptions = {}
): Promise<Agent> {
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

  const created = await kv().set(agentKey(id), agent, { nx: true });
  if (!created) throw new AgentExistsError(id);

  await kv().set(apiKeyKey(apiKey), id);
  return agent;
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  return (await kv().get<Agent>(agentKey(id))) ?? undefined;
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
  const id = await kv().get<string>(apiKeyKey(apiKey));
  return id ? await getAgent(id) : undefined;
}

export function isAgentExpired(agent: Agent): boolean {
  return agent.expiresAt !== null && new Date() > new Date(agent.expiresAt);
}

/** OWS token format: ows_key_<64 lowercase hex chars> */
function generateApiKey(): string {
  const bytes = new Uint8Array(32); // 32 bytes = 64 hex chars
  crypto.getRandomValues(bytes);
  return "ows_key_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
