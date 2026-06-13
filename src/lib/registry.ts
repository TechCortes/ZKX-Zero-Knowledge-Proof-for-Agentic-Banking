/**
 * Agent Registry — in-memory store for ZKX agent identities.
 *
 * Stores the Poseidon commitment (the ONLY data tied to an agent's identity).
 * No PII is ever stored. The commitment is Poseidon(idHash, salt) computed
 * client-side — the server never sees idHash or salt.
 *
 * Interface is intentionally DB-shaped: replace the Map with a DB client
 * (Postgres, Turso, etc.) without touching the API routes.
 */

export interface Agent {
  id: string;
  commitment: string;  // Poseidon(idHash, salt) — the ZK identity anchor
  apiKey: string;      // Bearer token issued at registration
  createdAt: string;   // ISO 8601 UTC
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

export function registerAgent(id: string, commitment: string): Agent {
  if (agents.has(id)) throw new AgentExistsError(id);

  const apiKey = generateApiKey();
  const agent: Agent = { id, commitment, apiKey, createdAt: new Date().toISOString() };

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

export function agentCount(): number {
  return agents.size;
}

function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "zkx_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
