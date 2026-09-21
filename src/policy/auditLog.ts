/**
 * Compliance Audit Log — ROADMAP.md, phase 1 ("audit log" — no new cryptography).
 *
 * Every policy decision writes an append-only record: which commitment (if any)
 * was involved, which policy version made the call, and whether the FATF
 * threshold was crossed. No PII — `commitment` is already public and
 * non-reversible on its own, and `agentId` is a handle, not an identity.
 *
 * Redis-backed (in-memory fallback for local dev/tests — see kv.ts), keyed
 * per agent so each agent's trail is its own bounded list.
 */

import { kv } from "@/lib/kv";

export type AuditDecision =
  | "approved_anonymous"
  | "kyc_required"
  | "approved_proof"
  | "proof_rejected"
  | "policy_denied";

export interface AuditRecord {
  id: string;
  agentId: string;
  /** Present only for decisions tied to a proof (approved_proof, proof_rejected). */
  commitment?: string;
  /** Absent for kyc_required — no transaction has settled yet at challenge time. */
  txId?: string;
  policyVersionHash: string;
  timestamp: string; // ISO-8601
  decision: AuditDecision;
  /** Whether this decision fell in the ZK-required tier (>= FATF threshold). */
  thresholdMet: boolean;
  dailyTotal: number;
}

/** Cap per-agent history so a single agent's list can't grow unbounded. */
const MAX_ENTRIES_PER_AGENT = 500;

const logKey = (agentId: string) => `audit:${agentId}`;

export async function recordAuditEntry(entry: Omit<AuditRecord, "id" | "timestamp">): Promise<AuditRecord> {
  const record: AuditRecord = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const key = logKey(entry.agentId);
  await kv().lpush(key, record);
  await kv().ltrim(key, MAX_ENTRIES_PER_AGENT);
  return record;
}

/** An agent's own audit trail, most recent first. */
export async function getAuditLog(agentId: string): Promise<AuditRecord[]> {
  return kv().lrange<AuditRecord>(logKey(agentId), 0, -1);
}
