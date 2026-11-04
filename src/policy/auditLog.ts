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
 *   - `audit_rec:<seq>`: every record under a global sequence number, never
 *     trimmed — the compliance copy. Signed checkpoints chain these by seq
 *     (auditCheckpoint.ts), which makes the log tamper-evident.
 *   - `audit:<agentId>`: the agent's own view, capped per agent
 *
 * Each record carries `recordHash` = SHA-256 of its canonical JSON (without
 * the hash itself), so anyone holding a record can check it against a checkpoint.
 *
 * Reveal ciphertexts are not stored here; see escrow.ts.
 */

import { createHash } from "crypto";
import { kv } from "@/lib/kv";
import { canonicalJson } from "@/lib/canonicalJson";
import type { RevealCiphertext } from "@/zkp/reveal";
import { storeRevealEscrow, type EscrowReference } from "./escrow";

export type AuditDecision =
  | "approved_anonymous"
  | "kyc_required"
  | "approved_proof"
  | "proof_rejected"
  | "policy_denied"
  | "disclosure_requested"
  | "disclosure_approval"
  | "disclosure_approved"
  | "disclosure_share_released"
  | "disclosure_delivered";

export interface AuditRecord {
  id: string;
  /** Global sequence number. Absent on records written before the audit chain. */
  seq?: number;
  /** SHA-256 (hex) of the canonical record without this field. Absent on pre-chain records. */
  recordHash?: string;
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
  /** Disclosure flow events (agentId "system:disclosure"). Only the requestHash; never the txId. */
  disclosure?: { requestHash: string; regulatorId?: string; approverId?: string; memberIndex?: number; deliveryHash?: string };
}

/** Records written before the escrow split carried the ciphertext inline. */
type StoredAuditRecord = AuditRecord & { revealCiphertext?: RevealCiphertext };

/** Cap per-agent history so a single agent's list can't grow unbounded. */
const MAX_ENTRIES_PER_AGENT = 500;

const logKey = (agentId: string) => `audit:${agentId}`;
export const SEQ_KEY = "audit_seq";
export const recordKey = (seq: number) => `audit_rec:${seq}`;

/** Marker a checkpoint writes into a sequence slot whose writer never finished (see auditCheckpoint.ts). */
export interface VoidedSlot {
  void: true;
  seq: number;
}

export function hashAuditRecord(record: AuditRecord): string {
  const { recordHash: _omit, ...rest } = record;
  return createHash("sha256").update(canonicalJson(rest)).digest("hex");
}

export async function recordAuditEntry(entry: Omit<AuditRecord, "id" | "timestamp" | "seq" | "recordHash">): Promise<AuditRecord> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  // A slot can only be lost to a checkpoint that voided it after a long stall; then take the next one.
  for (let attempt = 0; attempt < 3; attempt++) {
    const seq = await kv().incrby(SEQ_KEY, 1);
    const unhashed: AuditRecord = { ...entry, id, seq, timestamp };
    const record: AuditRecord = { ...unhashed, recordHash: hashAuditRecord(unhashed) };
    if (await kv().set(recordKey(seq), record, { nx: true })) {
      const key = logKey(entry.agentId);
      await kv().lpush(key, record);
      await kv().ltrim(key, MAX_ENTRIES_PER_AGENT);
      return record;
    }
  }
  throw new Error("Could not allocate an audit sequence number.");
}

export async function getAuditRecord(seq: number): Promise<AuditRecord | VoidedSlot | undefined> {
  return (await kv().get<AuditRecord | VoidedSlot>(recordKey(seq))) ?? undefined;
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
