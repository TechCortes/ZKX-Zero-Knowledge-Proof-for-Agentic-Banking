/**
 * Disclosure request storage.
 *
 *   disclosure:<requestHash>                       the full request (never trimmed)
 *   disclosure_approval:<requestHash>:<approverId> one approval each, write-once
 *   disclosure_approvals:<requestHash>             list of approver ids, in order
 *   disclosure_index                               every requestHash, newest first
 *   disclosure_rate:<regulatorId>:<YYYY-MM-DD>     per-regulator daily counter
 *
 * Each approval is its own write-once key, so two approvers signing at the same
 * moment can't overwrite each other.
 *
 * Every request and approval also goes into the audit chain under the agent id
 * `system:disclosure` (agent ids can't contain ':'), carrying only the
 * requestHash. Nothing here is written to the investigated agent's own audit
 * view, so the agent isn't tipped off.
 */

import { kv } from "@/lib/kv";
import { recordAuditEntry, type AuditDecision } from "@/policy/auditLog";
import type { ConsortiumRegistry } from "./keyRegistry";
import { tallyApprovals, type Approval, type DisclosureRequest, type SignedDisclosureRequest } from "./requests";

export const DISCLOSURE_AGENT_ID = "system:disclosure";
export const DEFAULT_DAILY_LIMIT = 10;

export interface StoredDisclosureRequest {
  requestHash: string;
  request: DisclosureRequest;
  regulatorSignature: SignedDisclosureRequest["signature"];
  /** The escrowed ciphertext's hash at submission time; bound into requestHash. */
  ciphertextHash: string;
  receivedAt: string; // ISO 8601
}

export type DisclosureStatus = "pending" | "approved" | "expired";

/** What anyone may see. No txId, ciphertextHash or legalBasisHash: those would let the agent recognise its own transaction. */
export interface PublicDisclosureSummary {
  requestHash: string;
  regulatorId: string;
  status: DisclosureStatus;
  receivedAt: string;
  expiresAt: string;
  approvalThreshold: number;
  approvals: { approverId: string; approvedAt: string }[];
}

const requestKey = (h: string) => `disclosure:${h}`;
const approvalKey = (h: string, id: string) => `disclosure_approval:${h}:${id}`;
const approvalsKey = (h: string) => `disclosure_approvals:${h}`;
const INDEX_KEY = "disclosure_index";
const rateKey = (regulatorId: string, day: string) => `disclosure_rate:${regulatorId}:${day}`;

export function dailyLimit(): number {
  const n = Number(process.env.VERO_DISCLOSURE_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT;
}

/** Count one request against the regulator's daily limit. False when over the limit. */
export async function takeRateSlot(regulatorId: string, now: Date = new Date()): Promise<boolean> {
  const used = await kv().incrby(rateKey(regulatorId, now.toISOString().slice(0, 10)), 1, { ex: 2 * 86400 });
  return used <= dailyLimit();
}

async function audit(decision: AuditDecision, requestHash: string, extra: { regulatorId?: string; approverId?: string } = {}) {
  await recordAuditEntry({
    agentId: DISCLOSURE_AGENT_ID,
    policyVersionHash: "vero-disclosure-request/v1",
    decision,
    thresholdMet: false,
    dailyTotal: 0,
    disclosure: { requestHash, ...extra },
  });
}

/** Store a new request. False if a request with this hash already exists (a replay). */
export async function createDisclosureRequest(rec: StoredDisclosureRequest): Promise<boolean> {
  if (!(await kv().set(requestKey(rec.requestHash), rec, { nx: true }))) return false;
  await kv().lpush(INDEX_KEY, rec.requestHash);
  await audit("disclosure_requested", rec.requestHash, { regulatorId: rec.request.regulatorId });
  return true;
}

export async function getDisclosureRequest(requestHash: string): Promise<StoredDisclosureRequest | null> {
  return kv().get<StoredDisclosureRequest>(requestKey(requestHash));
}

export async function getApprovals(requestHash: string): Promise<Approval[]> {
  const ids = await kv().lrange<string>(approvalsKey(requestHash), 0, -1);
  const approvals = await Promise.all([...new Set(ids)].reverse().map((id) => kv().get<Approval>(approvalKey(requestHash, id))));
  return approvals.filter((a): a is Approval => a !== null);
}

/**
 * Store an already-checked approval. False if this approver already approved.
 * Records `disclosure_approved` in the audit chain when this approval reaches the threshold.
 */
export async function addApproval(reg: ConsortiumRegistry, rec: StoredDisclosureRequest, approval: Approval): Promise<boolean> {
  const h = rec.requestHash;
  if (!(await kv().set(approvalKey(h, approval.approverId), approval, { nx: true }))) return false;
  await kv().lpush(approvalsKey(h), approval.approverId);
  await audit("disclosure_approval", h, { approverId: approval.approverId });
  const tally = tallyApprovals(reg, h, rec.request.expiresAt, await getApprovals(h));
  // Exactly one writer sees the count first reach the threshold; the nx key makes the record write-once anyway.
  if (tally.approved && (await kv().set(`disclosure_approved:${h}`, new Date().toISOString(), { nx: true }))) {
    await audit("disclosure_approved", h);
  }
  return true;
}

export function statusOf(reg: ConsortiumRegistry, rec: StoredDisclosureRequest, approvals: Approval[], now: Date = new Date()): DisclosureStatus {
  if (tallyApprovals(reg, rec.requestHash, rec.request.expiresAt, approvals).approved) return "approved";
  return rec.request.expiresAt <= now.toISOString() ? "expired" : "pending";
}

export async function publicSummary(reg: ConsortiumRegistry, rec: StoredDisclosureRequest, now: Date = new Date()): Promise<PublicDisclosureSummary> {
  const approvals = await getApprovals(rec.requestHash);
  const tally = tallyApprovals(reg, rec.requestHash, rec.request.expiresAt, approvals);
  return {
    requestHash: rec.requestHash,
    regulatorId: rec.request.regulatorId,
    status: statusOf(reg, rec, approvals, now),
    receivedAt: rec.receivedAt,
    expiresAt: rec.request.expiresAt,
    approvalThreshold: reg.approvalThreshold,
    approvals: approvals.filter((a) => tally.valid.includes(a.approverId)).map(({ approverId, approvedAt }) => ({ approverId, approvedAt })),
  };
}

export async function listRequestHashes(limit: number): Promise<string[]> {
  return kv().lrange<string>(INDEX_KEY, 0, limit - 1);
}
