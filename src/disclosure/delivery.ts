/**
 * Disclosure delivery — ROADMAP D5. Spec: docs/disclosure-delivery.md.
 *
 * After a request is approved (./requests.ts), the consortium members, not the
 * server, unlock the identity and hand it to the regulator:
 *
 *   1. Package. Each member downloads the request, the approvals and the sealed
 *      escrow envelope, and re-checks all of it against the registry.
 *   2. Release. Each member unseals its share of the envelope key (X-Wing) and
 *      seals that share to every other member (sealed box). The server relays
 *      the boxes and can't read them.
 *   3. Deliver. A member holding k share parts opens the envelope, checks the
 *      inner ciphertext against the ciphertextHash bound into requestHash, makes
 *      its ElGamal partial decryption (with a Chaum-Pedersen proof), seals
 *      { ciphertext, partial } to the regulator's X-Wing key, and signs a receipt.
 *   4. Open. The regulator unseals k deliveries, checks every receipt, every
 *      partial proof and the commitment, and only then reads the identity.
 *
 * Neither the server nor any single member ever holds the plaintext identity.
 * Every check here runs the same way on the server, on members' machines and on
 * the regulator's machine. Pure functions only; storage is in ./store.ts.
 */

import { createHash } from "crypto";
import { canonicalJson } from "@/lib/canonicalJson";
import { isValidHybridSignature, verifyHybrid, type HybridSignature, type HybridSigner } from "@/lib/auditSigning";
import { hashRevealCiphertext, serializeRevealCiphertext } from "@/policy/escrow";
import {
  ESCROW_FORMAT,
  openEscrow,
  unsealEscrowShare,
  type EscrowEnvelope,
  type EscrowMemberKey,
  type EscrowSharePart,
} from "@/zkp/escrowSeal";
import {
  REVEAL_FORMAT,
  combinePartials,
  consortiumKeyFromVerificationKeys,
  partialDecrypt,
  verifyPartial,
  type ConsortiumKey,
  type KeyShare,
  type PartialDecryption,
  type RevealCiphertext,
} from "@/zkp/reveal";
import { activeRegulator, type ConsortiumRegistry } from "./keyRegistry";
import { isSealedBox, openBox, sealTo, type SealedBox } from "./sealedBox";
import {
  checkSignedRequest,
  computeRequestHash,
  tallyApprovals,
  type Approval,
  type DisclosureRequest,
  type SignedDisclosureRequest,
} from "./requests";

export const ACCESS_TAG = "vero-disclosure-access/v1";
export const SHARE_TAG = "vero-disclosure-share/v1";
export const DELIVERY_FORMAT = "vero-disclosure-delivery/v1";

/** How long a signed access token is accepted, either side of server time. */
export const ACCESS_TOKEN_WINDOW_MS = 5 * 60_000;

function sha3hex(...parts: (string | Uint8Array)[]): string {
  const h = createHash("sha3-256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

// --- Formats ---

/** What a member downloads before releasing anything. */
export interface DisclosurePackage {
  requestHash: string;
  signed: SignedDisclosureRequest;
  ciphertextHash: string;
  approvals: Approval[];
  /** The escrow record: a sealed envelope (v2), or the bare ciphertext for records stored before sealing was on. */
  escrow: { envelope: EscrowEnvelope; ciphertext?: undefined } | { ciphertext: RevealCiphertext; envelope?: undefined };
}

/** Member `from`'s escrow share part, sealed separately to each other member. */
export interface ShareRelease {
  requestHash: string;
  from: number;
  boxes: { to: number; box: SealedBox }[];
  /** By the member's registry signing key, over shareReleaseDigest. */
  signature: HybridSignature;
}

/** What's inside a delivery box. Only the regulator can read it. */
export interface DeliveryContents {
  format: typeof DELIVERY_FORMAT;
  requestHash: string;
  txId: string;
  index: number;
  ciphertext: RevealCiphertext;
  partial: PartialDecryption;
}

/** One member's sealed contribution, plus its signed receipt. */
export interface Delivery {
  requestHash: string;
  index: number;
  box: SealedBox;
  /** By the member's registry signing key, over deliveryDigest. Goes into the audit chain. */
  signature: HybridSignature;
}

export interface DisclosedIdentity {
  requestHash: string;
  regulatorId: string;
  txId: string;
  idHash: string;
  birthYear: number;
  salt: string;
  commitment: string;
  /** Members whose partial decryptions were used. */
  members: number[];
}

// --- Contexts and digests ---

export const shareContext = (requestHash: string, from: number, to: number) => `${SHARE_TAG}|${requestHash}|${from}|${to}`;
export const deliveryContext = (requestHash: string, index: number, regulatorId: string) =>
  `${DELIVERY_FORMAT}|${requestHash}|${index}|${regulatorId}`;

export function shareReleaseDigest(requestHash: string, from: number, boxes: ShareRelease["boxes"]): Uint8Array {
  return new Uint8Array(Buffer.from(sha3hex(`${SHARE_TAG}|`, canonicalJson({ requestHash, from, boxes })), "hex"));
}

/** SHA3-256 of a delivery box. The receipt and the audit chain carry this, not the box. */
export function deliveryHash(box: SealedBox): string {
  return sha3hex(canonicalJson(box));
}

export function deliveryDigest(f: { requestHash: string; index: number; ciphertextHash: string; deliveryHash: string }): Uint8Array {
  return new Uint8Array(Buffer.from(sha3hex(`${DELIVERY_FORMAT}|receipt|`, canonicalJson(f)), "hex"));
}

// --- Access tokens (authenticated reads) ---

export type AccessAction = "package" | "shares" | "deliveries";

export interface AccessToken {
  party: "member" | "regulator";
  /** Member index as a decimal string, or the regulatorId. */
  id: string;
  requestHash: string;
  action: AccessAction;
  issuedAt: string;
  signature: HybridSignature;
}

function accessDigest(t: Omit<AccessToken, "signature">): Uint8Array {
  const { party, id, requestHash, action, issuedAt } = t;
  return new Uint8Array(Buffer.from(sha3hex(`${ACCESS_TAG}|`, canonicalJson({ party, id, requestHash, action, issuedAt })), "hex"));
}

/** The `Authorization` header value: `ZQ-Sig <base64url token>`. */
export function makeAccessToken(signer: HybridSigner, t: Omit<AccessToken, "signature" | "issuedAt">, now = new Date()): string {
  const unsigned = { ...t, issuedAt: now.toISOString() };
  const token: AccessToken = { ...unsigned, signature: signer.sign(accessDigest(unsigned)) };
  return `ZQ-Sig ${Buffer.from(JSON.stringify(token)).toString("base64url")}`;
}

/**
 * Check an access token for `requestHash` + `action`. Members are checked
 * against their registry signing key; a regulator must be active and must be the
 * one that made the request.
 */
export function checkAccess(
  reg: ConsortiumRegistry,
  header: string | null,
  want: { requestHash: string; action: AccessAction; party: AccessToken["party"]; regulatorId: string },
  now = new Date()
): { ok: true; id: string } | { ok: false; error: string } {
  if (!header?.startsWith("ZQ-Sig ")) return { ok: false, error: "Send Authorization: ZQ-Sig <signed access token>." };
  let t: AccessToken;
  try {
    t = JSON.parse(Buffer.from(header.slice(7), "base64url").toString("utf-8"));
  } catch {
    return { ok: false, error: "Access token is malformed." };
  }
  if (!t || typeof t !== "object" || !isValidHybridSignature(t.signature) || typeof t.issuedAt !== "string" || typeof t.id !== "string") {
    return { ok: false, error: "Access token is malformed." };
  }
  if (t.party !== want.party || t.requestHash !== want.requestHash || t.action !== want.action) {
    return { ok: false, error: `This token is not for ${want.action} on this request.` };
  }
  const at = Date.parse(t.issuedAt);
  if (!Number.isFinite(at) || Math.abs(at - now.getTime()) > ACCESS_TOKEN_WINDOW_MS) {
    return { ok: false, error: "Access token is expired or from the future. Sign a fresh one." };
  }
  const key =
    t.party === "member"
      ? reg.members.find((m) => String(m.index) === t.id)?.signing
      : t.id === want.regulatorId
      ? activeRegulator(reg, t.id, now)?.signing
      : undefined;
  if (!key || !verifyHybrid(key, accessDigest(t), t.signature)) {
    return { ok: false, error: "Access token does not verify for that party." };
  }
  return { ok: true, id: t.id };
}

// --- Server-side checks on what members post ---

export function checkShareRelease(reg: ConsortiumRegistry, requestHash: string, raw: unknown): string | null {
  const r = raw as Partial<ShareRelease> | null;
  if (!r || typeof r !== "object" || r.requestHash !== requestHash || !Number.isInteger(r.from) || !Array.isArray(r.boxes) || !isValidHybridSignature(r.signature)) {
    return "Body must be { requestHash, from, boxes, signature } for this request.";
  }
  const member = reg.members.find((m) => m.index === r.from);
  if (!member) return `No member ${r.from} in the registry.`;
  const others = new Set(reg.members.filter((m) => m.index !== r.from).map((m) => m.index));
  const seen = new Set<number>();
  for (const b of r.boxes) {
    if (!b || !others.has(b.to) || seen.has(b.to) || !isSealedBox(b.box)) return "Each box must go to a different other member, once.";
    seen.add(b.to);
  }
  if (seen.size < reg.threshold - 1) return `A release must reach at least ${reg.threshold - 1} other members.`;
  if (!verifyHybrid(member.signing, shareReleaseDigest(requestHash, r.from!, r.boxes), r.signature)) {
    return `Release signature does not verify under member ${r.from}'s key.`;
  }
  return null;
}

export function checkDelivery(reg: ConsortiumRegistry, requestHash: string, ciphertextHash: string, raw: unknown): string | null {
  const d = raw as Partial<Delivery> | null;
  if (!d || typeof d !== "object" || d.requestHash !== requestHash || !Number.isInteger(d.index) || !isSealedBox(d.box) || !isValidHybridSignature(d.signature)) {
    return "Body must be { requestHash, index, box, signature } for this request.";
  }
  const member = reg.members.find((m) => m.index === d.index);
  if (!member) return `No member ${d.index} in the registry.`;
  const digest = deliveryDigest({ requestHash, index: d.index!, ciphertextHash, deliveryHash: deliveryHash(d.box) });
  if (!verifyHybrid(member.signing, digest, d.signature)) return `Delivery receipt does not verify under member ${d.index}'s key.`;
  return null;
}

// --- Member side ---

/**
 * Everything a member checks before releasing its share. Doesn't trust the
 * server: re-verifies the regulator's signature, recomputes requestHash,
 * re-tallies the approvals and checks the escrow is the one the request names.
 */
export function verifyPackage(reg: ConsortiumRegistry, pkg: DisclosurePackage, now = new Date()): string[] {
  const problems: string[] = [];
  const req = pkg.signed?.request;
  const check = checkSignedRequest(reg, pkg.signed, new Date(req?.issuedAt));
  if (!check.ok) return [check.error];
  if (computeRequestHash(req, pkg.ciphertextHash) !== pkg.requestHash) problems.push("requestHash doesn't match the request and ciphertextHash.");
  if (req.expiresAt <= now.toISOString()) problems.push("The request has expired.");
  const tally = tallyApprovals(reg, pkg.requestHash, req.expiresAt, pkg.approvals ?? []);
  if (!tally.approved) problems.push(`Only ${tally.valid.length} valid approvals; ${reg.approvalThreshold} needed.`);
  const escrowHash = pkg.escrow?.envelope ? pkg.escrow.envelope.ciphertextHash : pkg.escrow?.ciphertext ? hashRevealCiphertext(pkg.escrow.ciphertext) : null;
  if (escrowHash !== pkg.ciphertextHash) problems.push("The escrow record is not the one this request was made for.");
  if (pkg.escrow?.envelope && pkg.escrow.envelope.txId !== req.txId) problems.push("The escrow envelope is for another transaction.");
  return problems;
}

function assertSigner(reg: ConsortiumRegistry, index: number, signer: HybridSigner) {
  const m = reg.members.find((x) => x.index === index);
  if (!m) throw new Error(`No member ${index} in the registry.`);
  if (m.signing.keyId !== signer.publicKey.keyId) throw new Error(`That signing key isn't member ${index}'s registered key.`);
  return m;
}

/** Round 1: unseal this member's escrow share and seal it to every other member. */
export function releaseShare(reg: ConsortiumRegistry, pkg: DisclosurePackage, memberKey: EscrowMemberKey, signer: HybridSigner): ShareRelease {
  const me = assertSigner(reg, memberKey.index, signer);
  if (me.kem !== memberKey.publicKey) throw new Error("That X-Wing key isn't this member's registered escrow key.");
  if (!pkg.escrow.envelope) throw new Error("This escrow record isn't sealed, so there is no share to release. Go straight to deliver.");
  const part = unsealEscrowShare(memberKey, pkg.escrow.envelope);
  const msg = Buffer.from(JSON.stringify(part));
  const boxes = reg.members
    .filter((m) => m.index !== me.index)
    .map((m) => ({ to: m.index, box: sealTo(m.kem, msg, shareContext(pkg.requestHash, me.index, m.index)) }));
  return { requestHash: pkg.requestHash, from: me.index, boxes, signature: signer.sign(shareReleaseDigest(pkg.requestHash, me.index, boxes)) };
}

/**
 * Round 2a: with this member's own share plus share parts released to it by
 * others, open the envelope. The inner ciphertext must hash to ciphertextHash.
 */
export function openForMember(reg: ConsortiumRegistry, pkg: DisclosurePackage, memberKey: EscrowMemberKey, releases: ShareRelease[]): RevealCiphertext {
  let ct: RevealCiphertext;
  if (pkg.escrow.ciphertext) {
    ct = pkg.escrow.ciphertext;
  } else {
    const env = pkg.escrow.envelope;
    const parts: EscrowSharePart[] = [unsealEscrowShare(memberKey, env)];
    for (const rel of releases) {
      if (rel.from === memberKey.index || checkShareRelease(reg, pkg.requestHash, rel)) continue;
      const mine = rel.boxes.find((b) => b.to === memberKey.index);
      if (!mine) continue;
      const part = JSON.parse(openBox(memberKey.secretKey, mine.box, shareContext(pkg.requestHash, rel.from, memberKey.index)).toString("utf-8")) as EscrowSharePart;
      if (part.format !== ESCROW_FORMAT || part.index !== rel.from) throw new Error(`Member ${rel.from} released a share part that isn't theirs.`);
      parts.push(part);
    }
    if (parts.length < env.threshold) throw new Error(`Have ${parts.length} share parts; ${env.threshold} needed. Wait for more members to release.`);
    ct = JSON.parse(openEscrow(env, parts).toString("utf-8"));
  }
  if (hashRevealCiphertext(ct) !== pkg.ciphertextHash) throw new Error("The opened ciphertext doesn't match ciphertextHash. Don't deliver.");
  return ct;
}

/** The consortium key, rebuilt from the members' registered reveal keys. */
export async function registryConsortiumKey(reg: ConsortiumRegistry): Promise<ConsortiumKey> {
  const vks = reg.members.filter((m) => m.revealKey).map((m) => ({ index: m.index, publicKey: m.revealKey! }));
  return consortiumKeyFromVerificationKeys(reg.threshold, reg.members.length, vks);
}

/** Round 2b: this member's partial decryption, sealed to the regulator, with a signed receipt. */
export async function prepareDelivery(
  reg: ConsortiumRegistry,
  pkg: DisclosurePackage,
  ct: RevealCiphertext,
  keyShare: KeyShare,
  signer: HybridSigner
): Promise<Delivery> {
  assertSigner(reg, keyShare.index, signer);
  const req = pkg.signed.request;
  const regulator = activeRegulator(reg, req.regulatorId);
  if (!regulator) throw new Error(`Regulator ${req.regulatorId} is no longer active in the registry. Don't deliver.`);
  const consortium = await registryConsortiumKey(reg);
  if (consortium.publicKey[0] !== ct.publicKey[0] || consortium.publicKey[1] !== ct.publicKey[1]) {
    throw new Error("The ciphertext wasn't encrypted to this consortium's key.");
  }
  const partial = await partialDecrypt(keyShare, ct);
  if (!(await verifyPartial(consortium, ct, partial))) throw new Error("Your partial doesn't verify against your registered reveal key. Wrong share file?");
  const contents: DeliveryContents = { format: DELIVERY_FORMAT, requestHash: pkg.requestHash, txId: req.txId, index: keyShare.index, ciphertext: ct, partial };
  const box = sealTo(regulator.kem, Buffer.from(JSON.stringify(contents)), deliveryContext(pkg.requestHash, keyShare.index, req.regulatorId));
  const signature = signer.sign(deliveryDigest({ requestHash: pkg.requestHash, index: keyShare.index, ciphertextHash: pkg.ciphertextHash, deliveryHash: deliveryHash(box) }));
  return { requestHash: pkg.requestHash, index: keyShare.index, box, signature };
}

// --- Regulator side ---

/**
 * Open k deliveries and read the identity. Every receipt, every partial proof and
 * the commitment are checked; one bad delivery is reported, not silently used.
 * `request` and `ciphertextHash` are the regulator's own copies from submission.
 */
export async function openDisclosure(
  reg: ConsortiumRegistry,
  mine: { request: DisclosureRequest; ciphertextHash: string },
  deliveries: Delivery[],
  regulatorKemSecretKey: string
): Promise<DisclosedIdentity> {
  const { request, ciphertextHash } = mine;
  const requestHash = computeRequestHash(request, ciphertextHash);
  const consortium = await registryConsortiumKey(reg);
  let ct: RevealCiphertext | null = null;
  const partials: PartialDecryption[] = [];
  for (const d of deliveries) {
    const why = checkDelivery(reg, requestHash, ciphertextHash, d);
    if (why) throw new Error(why);
    const c = JSON.parse(openBox(regulatorKemSecretKey, d.box, deliveryContext(requestHash, d.index, request.regulatorId)).toString("utf-8")) as DeliveryContents;
    if (c.format !== DELIVERY_FORMAT || c.requestHash !== requestHash || c.txId !== request.txId || c.index !== d.index || c.partial?.index !== d.index) {
      throw new Error(`Delivery from member ${d.index} doesn't belong to this request.`);
    }
    if (c.ciphertext?.format !== REVEAL_FORMAT || hashRevealCiphertext(c.ciphertext) !== ciphertextHash) {
      throw new Error(`Member ${d.index} delivered a different ciphertext than the one requested.`);
    }
    ct ??= c.ciphertext;
    if (!serializeRevealCiphertext(ct).equals(serializeRevealCiphertext(c.ciphertext))) throw new Error("Members delivered different ciphertexts.");
    partials.push(c.partial);
  }
  if (!ct) throw new Error("No deliveries.");
  const out = await combinePartials(consortium, ct, partials);
  if (!out.commitmentMatches) throw new Error("The decrypted identity doesn't match the commitment. Don't rely on it.");
  return {
    requestHash,
    regulatorId: request.regulatorId,
    txId: request.txId,
    idHash: out.idHash,
    birthYear: out.birthYear,
    salt: out.salt,
    commitment: ct.commitment,
    members: [...new Set(partials.map((p) => p.index))].sort((a, b) => a - b).slice(0, consortium.threshold),
  };
}
