/**
 * Consortium key registry (`vero-registry/v1`) — ROADMAP D3.
 *
 * One public JSON document that says who may do what in the disclosure flow:
 *
 *   members     the k-of-n consortium. Each holds an X-Wing escrow key (D1), a
 *               hybrid Ed25519 + ML-DSA-65 signing key and, optionally, its
 *               BabyJubJub reveal verification key. The member list is the
 *               root of trust: deployments pin it by registryId / membersId.
 *   approvers   people or offices that sign disclosure approvals (D4). An
 *               approval needs `approvalThreshold` distinct approvers.
 *   regulators  who may request a disclosure: a signing key to authenticate
 *               requests and an X-Wing key to receive the sealed result (D5).
 *   revocations withdraw an approver or regulator.
 *
 * Every approver, regulator and revocation must be endorsed by at least
 * `threshold` distinct members, so no single member or operator can add a
 * regulator. Every entry is also self-signed by its own signing key (proof of
 * possession), so nobody can register someone else's key under a new name.
 *
 * Signatures cover SHA3-256(tag ‖ canonical JSON of the entry without its
 * signatures), with a tag per entry kind and the consortiumId inside the JSON,
 * so a signature can't be moved to another kind, entry or consortium.
 *
 * Not independently audited. `@noble/post-quantum` is not constant-time.
 */

import { createHash } from "crypto";
import { ml_kem768_x25519 as xwing } from "@noble/post-quantum/hybrid.js";
import { canonicalJson } from "@/lib/canonicalJson";
import {
  isValidHybridPublicKey,
  signerFromSeed,
  verifyHybrid,
  generateAuditSigningSeed,
  type HybridPublicKey,
  type HybridSignature,
  type HybridSigner,
} from "@/lib/auditSigning";
import { XWING_PUBLIC_KEY_BYTES, keySetId, type EscrowKeySet } from "@/zkp/escrowSeal";

export const REGISTRY_FORMAT = "vero-registry/v1";
export const SIGNING_KEY_FORMAT = "vero-signing-key/v1";
export const KEM_KEY_FORMAT = "vero-kem-key/v1";
/** HKDF domain for registry signing keys; keeps them apart from the audit-checkpoint key. */
export const REGISTRY_SIGNING_DOMAIN = "vero-registry-signing";

type PointStr = [string, string];

// --- Formats ---

export interface MemberEntry {
  index: number;
  name: string;
  /** X-Wing (ML-KEM-768 + X25519) public key, base64. Same key as in VERO_ESCROW_KEYS. */
  kem: string;
  signing: HybridPublicKey;
  /** This member's BabyJubJub verification key Y_i from consortium.json, if they hold a reveal share. */
  revealKey?: PointStr;
  /** Self-signature by `signing`. */
  proof: HybridSignature;
}

export interface Endorsement {
  member: number;
  signature: HybridSignature;
}

interface Validity {
  validFrom: string;   // ISO 8601
  validUntil?: string; // ISO 8601
}

export interface ApproverEntry extends Validity {
  approverId: string;
  name: string;
  /** Free text, e.g. "compliance officer, Bank A". */
  role: string;
  signing: HybridPublicKey;
  proof: HybridSignature;
  endorsements: Endorsement[];
}

export interface RegulatorEntry extends Validity {
  regulatorId: string;
  name: string;
  /** e.g. "US", "EU", "GB". */
  jurisdiction: string;
  /** Authenticates the regulator's disclosure requests. */
  signing: HybridPublicKey;
  /** X-Wing public key, base64. Disclosed records are sealed to it. */
  kem: string;
  proof: HybridSignature;
  endorsements: Endorsement[];
}

export interface Revocation {
  kind: "approver" | "regulator";
  id: string;
  /** keyId of the revoked entry, so a later re-registration under the same id isn't revoked by accident. */
  keyId: string;
  revokedAt: string; // ISO 8601
  reason: string;
  endorsements: Endorsement[];
}

export interface ConsortiumRegistry {
  format: typeof REGISTRY_FORMAT;
  consortiumId: string;
  /** k: member endorsements needed for approvers, regulators and revocations. Equals the escrow threshold. */
  threshold: number;
  /** Distinct approver signatures needed on a disclosure request. */
  approvalThreshold: number;
  members: MemberEntry[];
  approvers: ApproverEntry[];
  regulators: RegulatorEntry[];
  revocations: Revocation[];
}

/** A party's own signing key. Secret. */
export interface SigningKeyFile {
  format: typeof SIGNING_KEY_FORMAT;
  seed: string; // base64, 32 bytes
  publicKey: HybridPublicKey;
}

/** A party's own X-Wing key pair. Secret. (Members use `kem-keygen` in the reveal CLI instead.) */
export interface KemKeyFile {
  format: typeof KEM_KEY_FORMAT;
  publicKey: string; // base64
  secretKey: string; // base64
}

// --- Encoding helpers ---

const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function isIso(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString() === s;
}

function sha3(...parts: (string | Uint8Array)[]): Buffer {
  const h = createHash("sha3-256");
  for (const p of parts) h.update(p);
  return h.digest();
}

// --- Keys ---

export function generateSigningKey(): SigningKeyFile {
  const seed = generateAuditSigningSeed();
  return { format: SIGNING_KEY_FORMAT, seed, publicKey: signingKeyFromSeed(seed).publicKey };
}

export function signingKeyFromSeed(seedB64: string): HybridSigner {
  return signerFromSeed(seedB64, REGISTRY_SIGNING_DOMAIN);
}

export function signerFromFile(file: SigningKeyFile): HybridSigner {
  if (file?.format !== SIGNING_KEY_FORMAT) throw new Error(`Signing key must have format "${SIGNING_KEY_FORMAT}".`);
  const signer = signingKeyFromSeed(file.seed);
  if (file.publicKey && file.publicKey.keyId !== signer.publicKey.keyId) {
    throw new Error("Signing key file is inconsistent: its seed doesn't produce its public key.");
  }
  return signer;
}

export function generateKemKey(): KemKeyFile {
  const { publicKey, secretKey } = xwing.keygen();
  return { format: KEM_KEY_FORMAT, publicKey: b64(publicKey), secretKey: b64(secretKey) };
}

// --- What gets signed ---

type Unsigned<T> = Omit<T, "proof" | "endorsements">;

function strip<T extends object>(entry: T): Record<string, unknown> {
  const { proof: _p, endorsements: _e, ...rest } = entry as Record<string, unknown>;
  return rest;
}

/** The 32-byte digest every signature on an entry covers. */
export function entryDigest(
  consortiumId: string,
  kind: "member" | "approver" | "regulator" | "revocation",
  entry: object,
): Uint8Array {
  return new Uint8Array(sha3(`${REGISTRY_FORMAT}|${kind}|`, canonicalJson({ consortiumId, entry: strip(entry) })));
}

/** SHA3-256 over the canonical registry document (hex). Pin this to freeze the whole registry. */
export function registryId(reg: ConsortiumRegistry): string {
  return sha3(`${REGISTRY_FORMAT}|registry|`, canonicalJson(reg)).toString("hex");
}

/**
 * SHA3-256 over consortiumId, thresholds and the member entries (hex). Unlike
 * registryId it doesn't change when a regulator or approver is added, so a
 * deployment can pin the trust root and still accept new endorsed entries.
 */
export function membersId(reg: Pick<ConsortiumRegistry, "consortiumId" | "threshold" | "approvalThreshold" | "members">): string {
  const members = [...reg.members].sort((a, b) => a.index - b.index);
  return sha3(`${REGISTRY_FORMAT}|members|`, canonicalJson({
    consortiumId: reg.consortiumId,
    threshold: reg.threshold,
    approvalThreshold: reg.approvalThreshold,
    members,
  })).toString("hex");
}

// --- Building entries ---

export function makeMemberEntry(consortiumId: string, entry: Unsigned<MemberEntry>, signer: HybridSigner): MemberEntry {
  if (entry.signing.keyId !== signer.publicKey.keyId) throw new Error("The entry's signing key must be the signer's own key.");
  return { ...entry, proof: signer.sign(entryDigest(consortiumId, "member", entry)) };
}

export function makeApproverEntry(consortiumId: string, entry: Unsigned<ApproverEntry>, signer: HybridSigner): ApproverEntry {
  if (entry.signing.keyId !== signer.publicKey.keyId) throw new Error("The entry's signing key must be the signer's own key.");
  return { ...entry, proof: signer.sign(entryDigest(consortiumId, "approver", entry)), endorsements: [] };
}

export function makeRegulatorEntry(consortiumId: string, entry: Unsigned<RegulatorEntry>, signer: HybridSigner): RegulatorEntry {
  if (entry.signing.keyId !== signer.publicKey.keyId) throw new Error("The entry's signing key must be the signer's own key.");
  return { ...entry, proof: signer.sign(entryDigest(consortiumId, "regulator", entry)), endorsements: [] };
}

export function makeRevocation(entry: Omit<Revocation, "endorsements">): Revocation {
  return { ...entry, endorsements: [] };
}

export type EndorsableKind = "approver" | "regulator" | "revocation";
type Endorsable = ApproverEntry | RegulatorEntry | Revocation;

/** A member endorses an entry. Returns a copy with the endorsement added (replacing any earlier one by the same member). */
export function endorse<T extends Endorsable>(
  reg: Pick<ConsortiumRegistry, "consortiumId" | "members">,
  kind: EndorsableKind,
  entry: T,
  memberIndex: number,
  signer: HybridSigner,
): T {
  const member = reg.members.find((m) => m.index === memberIndex);
  if (!member) throw new Error(`No member ${memberIndex} in the registry.`);
  if (member.signing.keyId !== signer.publicKey.keyId) throw new Error(`That signing key isn't member ${memberIndex}'s registered key.`);
  const signature = signer.sign(entryDigest(reg.consortiumId, kind, entry));
  return { ...entry, endorsements: [...entry.endorsements.filter((e) => e.member !== memberIndex), { member: memberIndex, signature }] };
}

// --- Verification ---

export interface VerifyOptions {
  /** If given, the members' X-Wing keys and threshold must equal this escrow key set (VERO_ESCROW_KEYS). */
  escrowKeys?: EscrowKeySet;
  /** If given, members' reveal keys must match these verification keys (consortium.json). */
  revealVerificationKeys?: { index: number; publicKey: PointStr }[];
  /** If given, membersId(reg) must equal it. */
  pinnedMembersId?: string;
}

/**
 * Check every structural rule and every signature. Returns the list of
 * problems; an empty list means the registry is valid. A valid registry can
 * still be unready for disclosure (see `disclosureReadiness`).
 */
export function verifyRegistry(raw: unknown, opts: VerifyOptions = {}): string[] {
  const errors: string[] = [];
  const reg = raw as Partial<ConsortiumRegistry>;
  if (!reg || reg.format !== REGISTRY_FORMAT) return [`Registry must have format "${REGISTRY_FORMAT}".`];
  if (typeof reg.consortiumId !== "string" || !ID_PATTERN.test(reg.consortiumId)) {
    errors.push("consortiumId must be lowercase letters, digits, '.', '_' or '-' (max 64).");
  }
  for (const list of ["members", "approvers", "regulators", "revocations"] as const) {
    if (!Array.isArray(reg[list])) return [...errors, `${list} must be an array.`];
  }
  const members = reg.members!;
  const n = members.length;
  if (n === 0) errors.push("The registry has no members.");
  if (!Number.isInteger(reg.threshold) || reg.threshold! < 1 || reg.threshold! > n) {
    errors.push(`threshold must be between 1 and ${n}.`);
  }
  if (!Number.isInteger(reg.approvalThreshold) || reg.approvalThreshold! < 1) {
    errors.push("approvalThreshold must be a positive integer.");
  }
  if (errors.length) return errors;
  const cid = reg.consortiumId!;
  const k = reg.threshold!;

  // Every signing key in the registry must be distinct, across all roles.
  const keyOwners = new Map<string, string>();
  const claimKey = (key: HybridPublicKey, who: string) => {
    const prev = keyOwners.get(key.keyId);
    // An approver may reuse its own member key; nothing else may share one.
    if (prev && !(prev.startsWith("member ") && who.startsWith("approver "))) {
      errors.push(`${who} reuses the signing key of ${prev}.`);
    } else if (!prev) {
      keyOwners.set(key.keyId, who);
    }
  };

  // Members
  const seenIdx = new Set<number>();
  const kems = new Set<string>();
  for (const m of members) {
    const who = `member ${m?.index}`;
    if (!Number.isInteger(m?.index) || m.index < 1 || m.index > n || seenIdx.has(m.index)) {
      errors.push(`Member indices must be 1..${n}, each used once.`);
      continue;
    }
    seenIdx.add(m.index);
    if (typeof m.name !== "string" || !m.name.trim()) errors.push(`${who} needs a name.`);
    if (typeof m.kem !== "string" || unb64(m.kem).length !== XWING_PUBLIC_KEY_BYTES) errors.push(`${who} has an invalid X-Wing key.`);
    else if (kems.has(m.kem)) errors.push(`${who} reuses another member's X-Wing key.`);
    else kems.add(m.kem);
    if (m.revealKey !== undefined && !(Array.isArray(m.revealKey) && m.revealKey.length === 2 && m.revealKey.every((c) => /^\d+$/.test(c)))) {
      errors.push(`${who} has a malformed reveal key.`);
    }
    if (!isValidHybridPublicKey(m.signing)) {
      errors.push(`${who} has an invalid signing key.`);
      continue;
    }
    claimKey(m.signing, who);
    if (!m.proof || !verifyHybrid(m.signing, entryDigest(cid, "member", m), m.proof)) {
      errors.push(`${who}: self-signature doesn't verify.`);
    }
  }
  if (errors.length) return errors;
  const byIndex = new Map(members.map((m) => [m.index, m]));

  const checkEndorsements = (kind: EndorsableKind, entry: Endorsable, who: string) => {
    if (!Array.isArray(entry.endorsements)) {
      errors.push(`${who} has no endorsements list.`);
      return;
    }
    const digest = entryDigest(cid, kind, entry);
    const good = new Set<number>();
    for (const e of entry.endorsements) {
      const m = byIndex.get(e?.member);
      if (!m) errors.push(`${who}: endorsement from unknown member ${e?.member}.`);
      else if (good.has(m.index)) errors.push(`${who}: member ${m.index} endorsed twice.`);
      else if (!e.signature || !verifyHybrid(m.signing, digest, e.signature)) errors.push(`${who}: endorsement by member ${m.index} doesn't verify.`);
      else good.add(m.index);
    }
    if (good.size < k) errors.push(`${who} has ${good.size} valid member endorsements; needs ${k}.`);
  };

  const checkValidity = (v: Validity, who: string) => {
    if (!isIso(v.validFrom)) errors.push(`${who}: validFrom must be an ISO 8601 UTC timestamp.`);
    if (v.validUntil !== undefined && !isIso(v.validUntil)) errors.push(`${who}: validUntil must be an ISO 8601 UTC timestamp.`);
    if (isIso(v.validFrom) && isIso(v.validUntil) && v.validUntil <= v.validFrom) errors.push(`${who}: validUntil must be after validFrom.`);
  };

  const checkSelf = (kind: "approver" | "regulator", entry: ApproverEntry | RegulatorEntry, who: string): boolean => {
    if (!isValidHybridPublicKey(entry.signing)) {
      errors.push(`${who} has an invalid signing key.`);
      return false;
    }
    if (!entry.proof || !verifyHybrid(entry.signing, entryDigest(cid, kind, entry), entry.proof)) {
      errors.push(`${who}: self-signature doesn't verify.`);
    }
    return true;
  };

  // Approvers
  const approverIds = new Map<string, ApproverEntry>();
  for (const a of reg.approvers!) {
    const who = `approver ${a?.approverId}`;
    if (typeof a?.approverId !== "string" || !ID_PATTERN.test(a.approverId)) {
      errors.push(`Approver id "${a?.approverId}" must be lowercase letters, digits, '.', '_' or '-'.`);
      continue;
    }
    if (approverIds.has(a.approverId)) errors.push(`${who} is listed twice.`);
    approverIds.set(a.approverId, a);
    if (typeof a.name !== "string" || !a.name.trim()) errors.push(`${who} needs a name.`);
    if (typeof a.role !== "string") errors.push(`${who} needs a role.`);
    checkValidity(a, who);
    if (checkSelf("approver", a, who)) claimKey(a.signing, who);
    checkEndorsements("approver", a, who);
  }

  // Regulators
  const regulatorIds = new Map<string, RegulatorEntry>();
  for (const r of reg.regulators!) {
    const who = `regulator ${r?.regulatorId}`;
    if (typeof r?.regulatorId !== "string" || !ID_PATTERN.test(r.regulatorId)) {
      errors.push(`Regulator id "${r?.regulatorId}" must be lowercase letters, digits, '.', '_' or '-'.`);
      continue;
    }
    if (regulatorIds.has(r.regulatorId)) errors.push(`${who} is listed twice.`);
    regulatorIds.set(r.regulatorId, r);
    if (typeof r.name !== "string" || !r.name.trim()) errors.push(`${who} needs a name.`);
    if (typeof r.jurisdiction !== "string" || !r.jurisdiction.trim()) errors.push(`${who} needs a jurisdiction.`);
    if (typeof r.kem !== "string" || unb64(r.kem).length !== XWING_PUBLIC_KEY_BYTES) errors.push(`${who} has an invalid X-Wing key.`);
    else if (kems.has(r.kem)) errors.push(`${who} reuses a member's X-Wing key.`);
    checkValidity(r, who);
    if (checkSelf("regulator", r, who)) claimKey(r.signing, who);
    checkEndorsements("regulator", r, who);
  }

  // Revocations
  for (const v of reg.revocations!) {
    const who = `revocation of ${v?.kind} ${v?.id}`;
    const target = v?.kind === "approver" ? approverIds.get(v.id) : v?.kind === "regulator" ? regulatorIds.get(v.id) : undefined;
    if (v?.kind !== "approver" && v?.kind !== "regulator") errors.push(`${who}: kind must be "approver" or "regulator".`);
    else if (!target) errors.push(`${who}: no such ${v.kind}.`);
    else if (target.signing?.keyId !== v.keyId) errors.push(`${who}: keyId doesn't match the registered key.`);
    if (!isIso(v?.revokedAt)) errors.push(`${who}: revokedAt must be an ISO 8601 UTC timestamp.`);
    if (typeof v?.reason !== "string") errors.push(`${who} needs a reason.`);
    checkEndorsements("revocation", v, who);
  }

  // Cross-checks against the rest of the deployment
  if (opts.escrowKeys) {
    const derived: EscrowKeySet = { format: opts.escrowKeys.format, threshold: k, members: members.map((m) => ({ index: m.index, publicKey: m.kem })) };
    if (opts.escrowKeys.threshold !== k) errors.push(`Escrow threshold is ${opts.escrowKeys.threshold}, registry threshold is ${k}.`);
    if (keySetId(derived) !== keySetId(opts.escrowKeys)) errors.push("Members' X-Wing keys don't match VERO_ESCROW_KEYS.");
  }
  if (opts.revealVerificationKeys) {
    for (const vk of opts.revealVerificationKeys) {
      const m = byIndex.get(vk.index);
      if (m?.revealKey && (m.revealKey[0] !== vk.publicKey[0] || m.revealKey[1] !== vk.publicKey[1])) {
        errors.push(`member ${vk.index}: reveal key doesn't match consortium.json.`);
      }
    }
  }
  if (opts.pinnedMembersId && membersId(reg as ConsortiumRegistry) !== opts.pinnedMembersId) {
    errors.push("Member set doesn't match the pinned membersId.");
  }

  return errors;
}

/** verifyRegistry, but throws on the first batch of problems and returns the typed registry. */
export function parseRegistry(raw: unknown, opts: VerifyOptions = {}): ConsortiumRegistry {
  const errors = verifyRegistry(raw, opts);
  if (errors.length) throw new Error(`Invalid registry:\n  - ${errors.join("\n  - ")}`);
  return raw as ConsortiumRegistry;
}

// --- Lookups (on a registry that passed verifyRegistry) ---

function isRevoked(reg: ConsortiumRegistry, kind: Revocation["kind"], id: string, keyId: string, at: string): boolean {
  return reg.revocations.some((v) => v.kind === kind && v.id === id && v.keyId === keyId && v.revokedAt <= at);
}

function isCurrent(v: Validity, at: string): boolean {
  return v.validFrom <= at && (v.validUntil === undefined || at < v.validUntil);
}

/** The regulator, if it is registered, inside its validity window and not revoked at `at`. */
export function activeRegulator(reg: ConsortiumRegistry, regulatorId: string, at: Date = new Date()): RegulatorEntry | null {
  const t = at.toISOString();
  const r = reg.regulators.find((x) => x.regulatorId === regulatorId);
  return r && isCurrent(r, t) && !isRevoked(reg, "regulator", r.regulatorId, r.signing.keyId, t) ? r : null;
}

/** All approvers active at `at`. */
export function activeApprovers(reg: ConsortiumRegistry, at: Date = new Date()): ApproverEntry[] {
  const t = at.toISOString();
  return reg.approvers.filter((a) => isCurrent(a, t) && !isRevoked(reg, "approver", a.approverId, a.signing.keyId, t));
}

/** Why the registry can't serve disclosure requests yet; empty when it can. */
export function disclosureReadiness(reg: ConsortiumRegistry, at: Date = new Date()): string[] {
  const problems: string[] = [];
  const approvers = activeApprovers(reg, at).length;
  if (approvers < reg.approvalThreshold) problems.push(`${approvers} active approvers; approvalThreshold is ${reg.approvalThreshold}.`);
  if (!reg.regulators.some((r) => activeRegulator(reg, r.regulatorId, at))) problems.push("No active regulator.");
  return problems;
}

/** An empty registry with the given members, ready for approvers and regulators to be added. */
export function newRegistry(consortiumId: string, threshold: number, approvalThreshold: number, members: MemberEntry[]): ConsortiumRegistry {
  return {
    format: REGISTRY_FORMAT,
    consortiumId,
    threshold,
    approvalThreshold,
    members: [...members].sort((a, b) => a.index - b.index),
    approvers: [],
    regulators: [],
    revocations: [],
  };
}
