/**
 * Disclosure requests (`vero-disclosure-request/v1`) — ROADMAP D4.
 *
 * A regulator asks for ONE transaction to be unmasked. The request names the
 * transaction, the hash of the legal document behind it and an expiry, and is
 * signed with the regulator's registered hybrid key (Ed25519 + ML-DSA-65).
 *
 * The server binds it to the escrowed ciphertext and computes
 *
 *   requestHash = SHA3-256( "vero-disclosure-request/v1" ‖ consortiumId ‖ regulatorId
 *                           ‖ txId ‖ ciphertextHash ‖ legalBasisHash ‖ expiresAt ‖ nonce )
 *
 * with every field length-prefixed (4-byte big-endian length, then UTF-8), so
 * no two field lists encode the same bytes. Approvers each sign
 * SHA3-256("vero-disclosure-approval/v1|" ‖ requestHash). A request is approved
 * once `approvalThreshold` distinct registered approvers have signed it before
 * it expires. Because the regulator, transaction, ciphertext and legal basis
 * are all inside requestHash, an approval can't be replayed for another
 * transaction or handed to another regulator.
 *
 * Pure functions only: storage is in ./store.ts.
 */

import { createHash, randomBytes } from "crypto";
import { canonicalJson } from "@/lib/canonicalJson";
import { isValidHybridSignature, verifyHybrid, type HybridSignature, type HybridSigner } from "@/lib/auditSigning";
import { activeApprovers, activeRegulator, type ConsortiumRegistry } from "./keyRegistry";

export const REQUEST_FORMAT = "vero-disclosure-request/v1";
export const APPROVAL_TAG = "vero-disclosure-approval/v1";

/** How far the regulator's clock may be from ours. */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;
/** Longest a request may stay open. */
export const MAX_REQUEST_LIFETIME_MS = 30 * 24 * 3600_000;

/** What the regulator writes and signs. */
export interface DisclosureRequest {
  format: typeof REQUEST_FORMAT;
  consortiumId: string;
  regulatorId: string;
  txId: string;
  /** SHA3-256 (hex) of the legal document (warrant, order, travel-rule request). The document itself never goes to the server. */
  legalBasisHash: string;
  issuedAt: string;  // ISO 8601
  expiresAt: string; // ISO 8601
  /** 32 random bytes (hex), chosen by the regulator. */
  nonce: string;
}

export interface SignedDisclosureRequest {
  request: DisclosureRequest;
  signature: HybridSignature;
}

export interface Approval {
  approverId: string;
  signature: HybridSignature;
  /** Server time the approval was accepted. */
  approvedAt: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const TX_ID = /^[A-Za-z0-9_-]{1,80}$/;

function isIso(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString() === s;
}

function sha3(...parts: (string | Uint8Array)[]): Buffer {
  const h = createHash("sha3-256");
  for (const p of parts) h.update(p);
  return h.digest();
}

function lengthPrefixed(fields: string[]): Buffer {
  return Buffer.concat(fields.flatMap((f) => {
    const b = Buffer.from(f, "utf-8");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(b.length);
    return [len, b];
  }));
}

/** What the regulator's signature covers. */
export function requestSigningDigest(req: DisclosureRequest): Uint8Array {
  return new Uint8Array(sha3(`${REQUEST_FORMAT}|submit|`, canonicalJson(req)));
}

/** The request's identity. Everything downstream (approvals, delivery, receipts) refers to it. */
export function computeRequestHash(req: DisclosureRequest, ciphertextHash: string): string {
  return sha3(lengthPrefixed([
    REQUEST_FORMAT,
    req.consortiumId,
    req.regulatorId,
    req.txId,
    ciphertextHash,
    req.legalBasisHash,
    req.expiresAt,
    req.nonce,
  ])).toString("hex");
}

/** What each approver signs. */
export function approvalDigest(requestHash: string): Uint8Array {
  if (!HEX64.test(requestHash)) throw new Error("requestHash must be 64 hex characters.");
  return new Uint8Array(sha3(`${APPROVAL_TAG}|`, Buffer.from(requestHash, "hex")));
}

/** SHA3-256 of a legal document, as it goes in `legalBasisHash`. */
export function hashLegalDocument(doc: Uint8Array): string {
  return sha3(doc).toString("hex");
}

// --- Building (regulator / approver side) ---

export function buildRequest(fields: Omit<DisclosureRequest, "format" | "issuedAt" | "nonce"> & { issuedAt?: string; nonce?: string }): DisclosureRequest {
  return {
    format: REQUEST_FORMAT,
    consortiumId: fields.consortiumId,
    regulatorId: fields.regulatorId,
    txId: fields.txId,
    legalBasisHash: fields.legalBasisHash,
    issuedAt: fields.issuedAt ?? new Date().toISOString(),
    expiresAt: fields.expiresAt,
    nonce: fields.nonce ?? randomBytes(32).toString("hex"),
  };
}

export function signRequest(req: DisclosureRequest, signer: HybridSigner): SignedDisclosureRequest {
  return { request: req, signature: signer.sign(requestSigningDigest(req)) };
}

export function signApproval(requestHash: string, signer: HybridSigner): HybridSignature {
  return signer.sign(approvalDigest(requestHash));
}

// --- Checks (server side, and anyone re-checking) ---

/** Shape checks only; no clock, no registry. */
export function requestShapeErrors(raw: unknown): string[] {
  const r = raw as Partial<DisclosureRequest>;
  if (!r || typeof r !== "object") return ["request must be an object."];
  const errors: string[] = [];
  if (r.format !== REQUEST_FORMAT) errors.push(`request.format must be "${REQUEST_FORMAT}".`);
  for (const f of ["consortiumId", "regulatorId"] as const) {
    if (typeof r[f] !== "string" || !r[f]) errors.push(`request.${f} is required.`);
  }
  if (typeof r.txId !== "string" || !TX_ID.test(r.txId)) errors.push("request.txId is malformed.");
  if (typeof r.legalBasisHash !== "string" || !HEX64.test(r.legalBasisHash)) errors.push("request.legalBasisHash must be 64 lowercase hex characters.");
  if (typeof r.nonce !== "string" || !HEX64.test(r.nonce)) errors.push("request.nonce must be 64 lowercase hex characters.");
  if (!isIso(r.issuedAt)) errors.push("request.issuedAt must be an ISO 8601 UTC timestamp.");
  if (!isIso(r.expiresAt)) errors.push("request.expiresAt must be an ISO 8601 UTC timestamp.");
  const allowed = new Set(["format", "consortiumId", "regulatorId", "txId", "legalBasisHash", "issuedAt", "expiresAt", "nonce"]);
  for (const k of Object.keys(r)) if (!allowed.has(k)) errors.push(`request.${k} is not a known field.`);
  return errors;
}

export type RequestCheck =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 422; error: string };

/**
 * Everything about a submitted request except storage: shape, consortium,
 * regulator registered and active, signature, clock skew and lifetime.
 */
export function checkSignedRequest(reg: ConsortiumRegistry, signed: unknown, now: Date = new Date()): RequestCheck {
  const s = signed as Partial<SignedDisclosureRequest>;
  if (!s || typeof s !== "object" || !s.request || !isValidHybridSignature(s.signature)) {
    return { ok: false, status: 422, error: "Body must be { request, signature }." };
  }
  const shape = requestShapeErrors(s.request);
  if (shape.length) return { ok: false, status: 422, error: shape.join(" ") };
  const req = s.request;
  if (req.consortiumId !== reg.consortiumId) return { ok: false, status: 422, error: "Request is for a different consortium." };

  const regulator = activeRegulator(reg, req.regulatorId, now);
  if (!regulator) return { ok: false, status: 403, error: "Regulator is not registered, not yet valid, expired or revoked." };
  if (!verifyHybrid(regulator.signing, requestSigningDigest(req), s.signature)) {
    return { ok: false, status: 401, error: "Request signature does not verify under the regulator's registered key." };
  }

  const issued = Date.parse(req.issuedAt);
  const expires = Date.parse(req.expiresAt);
  if (Math.abs(issued - now.getTime()) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 422, error: "request.issuedAt is more than 5 minutes from server time. Sign a fresh request." };
  }
  if (expires <= now.getTime()) return { ok: false, status: 422, error: "request.expiresAt is in the past." };
  if (expires - issued > MAX_REQUEST_LIFETIME_MS) return { ok: false, status: 422, error: "request.expiresAt may be at most 30 days after issuedAt." };
  return { ok: true };
}

/**
 * Check one approval: the approver is registered and active at `at`, and the
 * signature is over this requestHash.
 */
export function checkApproval(reg: ConsortiumRegistry, requestHash: string, approverId: string, signature: HybridSignature, at: Date): string | null {
  if (!isValidHybridSignature(signature)) return `Approval by ${approverId} has a malformed signature.`;
  const approver = activeApprovers(reg, at).find((a) => a.approverId === approverId);
  if (!approver) return `Approver ${approverId} is not registered, not yet valid, expired or revoked.`;
  if (!verifyHybrid(approver.signing, approvalDigest(requestHash), signature)) return `Approval by ${approverId} does not verify.`;
  return null;
}

export interface ApprovalTally {
  /** Distinct approvers whose approval verifies and came before expiry. */
  valid: string[];
  invalid: { approverId: string; reason: string }[];
  approved: boolean;
}

/**
 * Re-check every stored approval from scratch. Members run this before they
 * unseal anything (D5); they don't have to trust the server's status field.
 */
export function tallyApprovals(reg: ConsortiumRegistry, requestHash: string, expiresAt: string, approvals: Approval[]): ApprovalTally {
  const valid = new Set<string>();
  const invalid: ApprovalTally["invalid"] = [];
  for (const a of approvals) {
    if (valid.has(a.approverId)) continue;
    if (!isIso(a.approvedAt) || a.approvedAt >= expiresAt) {
      invalid.push({ approverId: a.approverId, reason: "Approval is after the request expired." });
      continue;
    }
    const why = checkApproval(reg, requestHash, a.approverId, a.signature, new Date(a.approvedAt));
    if (why) invalid.push({ approverId: a.approverId, reason: why });
    else valid.add(a.approverId);
  }
  return { valid: [...valid], invalid, approved: valid.size >= reg.approvalThreshold };
}
