/**
 * Compliance Audit Log — ROADMAP.md, phase 1 ("audit log" — no new cryptography).
 *
 * Every policy decision writes an append-only record: which commitment (if any)
 * was involved, which policy version made the call, and whether the FATF
 * threshold was crossed. No PII — `commitment` is already public and
 * non-reversible on its own, and `agentId` is a handle, not an identity.
 *
 * Interface is intentionally DB-shaped, same convention as registry.ts:
 * replace the array with a real append-only store (or a hash-chained log)
 * without touching the call sites.
 */

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

const auditLog: AuditRecord[] = [];

export function recordAuditEntry(entry: Omit<AuditRecord, "id" | "timestamp">): AuditRecord {
  const record: AuditRecord = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  auditLog.push(record);
  return record;
}

/** An agent's own audit trail, most recent first. */
export function getAuditLog(agentId: string): AuditRecord[] {
  return auditLog
    .filter((r) => r.agentId === agentId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function auditLogSize(): number {
  return auditLog.length;
}
