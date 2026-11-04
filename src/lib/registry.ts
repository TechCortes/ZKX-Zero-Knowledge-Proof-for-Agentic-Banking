/**
 * Agent Registry — Redis-backed store for ZQUENT agent identities
 * (in-memory fallback for local dev/tests — see kv.ts).
 *
 * Follows the Open Wallet Standard API key model:
 *   - Token format: ows_key_<64 hex chars>. Only its SHA-256 hash is stored;
 *     the raw key is returned once, at registration.
 *   - Agents carry policy rules (allowed_chains, expires_at, spending_limit)
 *   - AND semantics: all attached policies must pass
 */

import { createHash } from "crypto";
import { kv } from "./kv";
import type { PolicyRule } from "@/policy/engine";

export interface Agent {
  id: string;
  commitment: string;  // Poseidon(idHash, salt) — the ZK identity anchor
  /** SHA-256 (hex) of the bearer token. The raw token is never stored. */
  apiKeyHash: string;
  createdAt: string;   // ISO 8601 UTC
  /** CAIP-2 chain identifiers this agent is permitted to transact on */
  chains: string[];
  /** OWS-style typed policy rules enforced on every payment request */
  policies: PolicyRule[];
  /** ISO 8601 expiry — null means no expiry */
  expiresAt: string | null;
}

const agentKey = (id: string) => `agent:${id}`;
const apiKeyHashKey = (hash: string) => `apikey_sha256:${hash}`;
/** Pre-hashing index (raw key → agent id). Read only to migrate old records. */
const legacyApiKeyKey = (apiKey: string) => `apikey:${apiKey}`;

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/** Records written before keys were hashed still carry the raw key. */
type StoredAgent = Agent & { apiKey?: string };

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

/** Returned once from registration: the stored agent plus its raw bearer token. */
export interface RegisteredAgent {
  agent: Agent;
  apiKey: string;
}

export async function registerAgent(
  id: string,
  commitment: string,
  options: RegisterAgentOptions = {}
): Promise<RegisteredAgent> {
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const agent: Agent = {
    id,
    commitment,
    apiKeyHash,
    createdAt: new Date().toISOString(),
    chains: options.chains ?? [],
    policies: options.policies ?? [],
    expiresAt: options.expiresAt ?? null,
  };

  const created = await kv().set(agentKey(id), agent, { nx: true });
  if (!created) throw new AgentExistsError(id);

  await kv().set(apiKeyHashKey(apiKeyHash), id);
  return { agent, apiKey };
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  const stored = await kv().get<StoredAgent>(agentKey(id));
  if (!stored) return undefined;
  const { apiKey: _legacyRawKey, ...agent } = stored;
  return agent;
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
  const hash = hashApiKey(apiKey);
  const id = await kv().get<string>(apiKeyHashKey(hash));
  if (id) return await getAgent(id);
  return migrateLegacyApiKey(apiKey, hash);
}

/**
 * One-time migration for agents registered before keys were hashed: move the
 * index to the hashed key and drop the raw key from both the index and the
 * agent record. Runs the first time each old key is used.
 */
async function migrateLegacyApiKey(apiKey: string, hash: string): Promise<Agent | undefined> {
  const id = await kv().get<string>(legacyApiKeyKey(apiKey));
  if (!id) return undefined;
  const stored = await kv().get<StoredAgent>(agentKey(id));
  if (!stored) return undefined;
  const { apiKey: _legacyRawKey, ...rest } = stored;
  const agent: Agent = { ...rest, apiKeyHash: hash };
  // New records first, raw index last, so a crash midway never locks the agent out.
  await kv().set(apiKeyHashKey(hash), id);
  await kv().set(agentKey(id), agent);
  await kv().getdel(legacyApiKeyKey(apiKey));
  return agent;
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
