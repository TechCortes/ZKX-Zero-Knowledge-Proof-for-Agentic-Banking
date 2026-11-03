/**
 * Compliance Audit Log — ROADMAP.md, phase 1 ("audit log" — no new cryptography).
 *
 * Every policy decision writes an append-only record: which commitment (if any)
 * was involved, which policy version made the call, and whether the FATF
 * threshold was crossed. No PII — `commitment` is already public and
 * non-reversible on its own, and `agentId` is a handle, not an identity.
 *
 * Redis-backed (in-memory fallback for local dev/tests — see kv.ts). Each
 * record goes to two places:
 *   - `audit:<agentId>`: the agent's own view, capped per agent
 *   - `audit_stream`: every record, never trimmed — the compliance copy
 *
 * Reveal ciphertexts are not stored here; see escrow.ts.
 */

import { kv } from "@/lib/kv";
import type { RevealCiphertext } from "@/zkp/reveal";
import { storeRevealEscrow, type EscrowReference } from "./escrow";

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
  /** The server challenge the approving proof was bound to (approved_proof only). */
  txNonce?: string;
  /**
   * Threshold reveal (ROADMAP phase 2): present on approved_proof when reveal is
   * configured. The ciphertext itself sits in the reveal escrow under this txId;
   * the audit record only carries its hash. See docs/threshold-reveal.md.
   */
  revealEscrow?: EscrowReference;
}

/** Records written before the escrow split carried the ciphertext inline. */
type StoredAuditRecord = AuditRecord & { revealCiphertext?: RevealCiphertext };

/** Cap per-agent history so a single agent's list can't grow unbounded. */
const MAX_ENTRIES_PER_AGENT = 500;

const logKey = (agentId: string) => `audit:${agentId}`;
const STREAM_KEY = "audit_stream";

export async function recordAuditEntry(entry: Omit<AuditRecord, "id" | "timestamp">): Promise<AuditRecord> {
  const record: AuditRecord = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const key = logKey(entry.agentId);
  await kv().lpush(STREAM_KEY, record);
  await kv().lpush(key, record);
  await kv().ltrim(key, MAX_ENTRIES_PER_AGENT);
  return record;
}

/**
 * An agent's own audit trail, most recent first. Never contains a reveal
 * ciphertext: older records that carried one inline have it copied to the
 * escrow (if not there already) and replaced by its hash.
 */
export async function getAuditLog(agentId: string): Promise<AuditRecord[]> {
  const records = await kv().lrange<StoredAuditRecord>(logKey(agentId), 0, -1);
  return Promise.all(records.map(withoutInlineCiphertext));
}

async function withoutInlineCiphertext(stored: StoredAuditRecord): Promise<AuditRecord> {
  const { revealCiphertext, ...record } = stored;
  if (!revealCiphertext) return record;
  if (!record.txId) return record; // can't be escrowed without a txId; drop it from the view
  const revealEscrow = await storeRevealEscrow({
    txId: record.txId,
    agentId: record.agentId,
    txNonce: record.txNonce,
    ciphertext: revealCiphertext,
    createdAt: record.timestamp,
  });
  return { ...record, revealEscrow };
}
