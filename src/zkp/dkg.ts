/**
 * Distributed key generation for the threshold-reveal key (`vero-dkg/v1`) — ROADMAP D6.
 * Spec: docs/dkg.md.
 *
 * Replaces the trusted dealer in reveal.ts (`dealKeyShares`). No party ever
 * holds the consortium secret key; it exists only as the sum of every member's
 * random contribution. Joint-Feldman over the BabyJubJub prime subgroup:
 *
 *   1. Session. One public document fixes the consortium, k, n, the members'
 *      signing keys and a random nonce. Its hash is the sessionId.
 *   2. Deal. Each member i picks a random polynomial f_i of degree k−1, publishes
 *      Feldman commitments C_ik = a_ik · B, and seals f_i(j) to each other member j
 *      (sealed box, X-Wing). Signed with i's registry key.
 *   3. Finalize. Each member j checks every share it received against the dealer's
 *      commitments: f_i(j) · B == Σ_k C_ik · j^k. Its share is s_j = Σ_i f_i(j).
 *      The public key PK = Σ_i C_i0 and every Y_m = Σ_i Σ_k C_ik · m^k follow from
 *      the commitments alone. j signs a result naming PK and the Y_m.
 *   4. Verify. Anyone holding the transcript (session, deals, results) recomputes
 *      PK and the Y_m and checks every signature.
 *
 * The outputs are the same ConsortiumKey / KeyShare shapes the dealer produced,
 * so encryption, partial decryption and delivery are unchanged.
 *
 * v1 has no complaint round: if any share fails its check, or any deal is
 * missing, finalize refuses and the ceremony restarts with a new session.
 */

import { createHash, randomBytes } from "crypto";
import { canonicalJson } from "@/lib/canonicalJson";
import { isValidHybridSignature, verifyHybrid, type HybridSignature, type HybridSigner } from "@/lib/auditSigning";
import { openBox, sealTo, isSealedBox, type SealedBox } from "@/disclosure/sealedBox";
import type { ConsortiumRegistry } from "@/disclosure/keyRegistry";
import type { EscrowMemberKey } from "./escrowSeal";
import { add, base8, eq, getCrypto, inSubgroup, mod, mul, pt, randomScalar, str, type Crypto, type Point, type PointStr } from "./babyjub";
import { REVEAL_FORMAT, type ConsortiumKey, type KeyShare } from "./reveal";

export const DKG_FORMAT = "vero-dkg/v1";
export const DKG_SECRET_FORMAT = "vero-dkg-secret/v1";

// --- Formats ---

export interface DkgSession {
  format: typeof DKG_FORMAT;
  consortiumId: string;
  threshold: number;
  parties: number;
  /** Who takes part, by registry signing key. Every member must deal. */
  members: { index: number; signingKeyId: string }[];
  /** 32 random bytes (hex), so two ceremonies never share a sessionId. */
  nonce: string;
  createdAt: string;
}

export interface DkgDeal {
  sessionId: string;
  from: number;
  /** Feldman commitments C_0..C_{k-1}. C_0 is this member's contribution to PK. */
  commitments: PointStr[];
  /** f_from(to), sealed to each other member. */
  boxes: { to: number; box: SealedBox }[];
  signature: HybridSignature;
}

/** Kept by the dealer between deal and finalize: f_i(i). Secret. */
export interface DkgSecret {
  format: typeof DKG_SECRET_FORMAT;
  sessionId: string;
  index: number;
  ownShare: string;
}

/** A member's signed statement of the outcome it computed. */
export interface DkgResult {
  sessionId: string;
  index: number;
  publicKey: PointStr;
  /** SHA3-256 of canonicalJson(verificationKeys), so every member signs the same Y_m list. */
  verificationKeysHash: string;
  signature: HybridSignature;
}

export interface DkgTranscript {
  session: DkgSession;
  deals: DkgDeal[];
  results: DkgResult[];
}

// --- Digests ---

function sha3hex(...parts: string[]): string {
  const h = createHash("sha3-256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}
const bytes = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));

export function dkgSessionId(session: DkgSession): string {
  return sha3hex(`${DKG_FORMAT}|session|`, canonicalJson(session));
}

/** What a deal's signature covers. */
export const dkgDealDigest = (d: Omit<DkgDeal, "signature">) =>
  bytes(sha3hex(`${DKG_FORMAT}|deal|`, canonicalJson({ sessionId: d.sessionId, from: d.from, commitments: d.commitments, boxes: d.boxes })));

const resultDigest = (r: Omit<DkgResult, "signature">) =>
  bytes(sha3hex(`${DKG_FORMAT}|result|`, canonicalJson({ sessionId: r.sessionId, index: r.index, publicKey: r.publicKey, verificationKeysHash: r.verificationKeysHash })));

export const dkgShareContext = (sessionId: string, from: number, to: number) => `${DKG_FORMAT}|share|${sessionId}|${from}|${to}`;

export function verificationKeysHash(vks: ConsortiumKey["verificationKeys"]): string {
  return sha3hex(canonicalJson([...vks].sort((a, b) => a.index - b.index)));
}

// --- Polynomial helpers ---

/** Σ_k C_k · x^k, the public image of f(x). */
function evalCommitments(c: Crypto, commitments: Point[], x: number): Point {
  let acc: Point = [BigInt(0), BigInt(1)];
  let pow = BigInt(1);
  for (const C of commitments) {
    acc = add(c, acc, mul(c, C, pow));
    pow = mod(pow * BigInt(x), c.l);
  }
  return acc;
}

function evalPoly(c: Crypto, coeffs: bigint[], x: number): bigint {
  return coeffs.reduceRight((acc, a) => mod(acc * BigInt(x) + a, c.l), BigInt(0));
}

const IDENTITY: Point = [BigInt(0), BigInt(1)];

// --- Session ---

/** A new ceremony for every member in the registry, with k = registry threshold. */
export function newDkgSession(reg: ConsortiumRegistry, now = new Date()): DkgSession {
  return {
    format: DKG_FORMAT,
    consortiumId: reg.consortiumId,
    threshold: reg.threshold,
    parties: reg.members.length,
    members: [...reg.members].sort((a, b) => a.index - b.index).map((m) => ({ index: m.index, signingKeyId: m.signing.keyId })),
    nonce: randomBytes(32).toString("hex"),
    createdAt: now.toISOString(),
  };
}

/** The session must describe this registry exactly: same consortium, k, members and keys. */
export function sessionErrors(reg: ConsortiumRegistry, s: DkgSession): string[] {
  const errors: string[] = [];
  if (s?.format !== DKG_FORMAT) return [`Session must have format "${DKG_FORMAT}".`];
  if (s.consortiumId !== reg.consortiumId) errors.push("Session is for a different consortium.");
  if (s.threshold !== reg.threshold) errors.push(`Session threshold ${s.threshold} doesn't match the registry's ${reg.threshold}.`);
  if (s.parties !== reg.members.length || s.members?.length !== reg.members.length) errors.push("Session doesn't list every registry member.");
  for (const m of s.members ?? []) {
    const r = reg.members.find((x) => x.index === m.index);
    if (!r || r.signing.keyId !== m.signingKeyId) errors.push(`Session member ${m.index} doesn't match the registry's signing key.`);
  }
  if (!/^[0-9a-f]{64}$/.test(s.nonce ?? "")) errors.push("Session nonce must be 64 lowercase hex characters.");
  return errors;
}

function memberFor(reg: ConsortiumRegistry, index: number, signer?: HybridSigner) {
  const m = reg.members.find((x) => x.index === index);
  if (!m) throw new Error(`No member ${index} in the registry.`);
  if (signer && signer.publicKey.keyId !== m.signing.keyId) throw new Error(`That signing key isn't member ${index}'s registered key.`);
  return m;
}

// --- Deal ---

export async function dkgDeal(
  reg: ConsortiumRegistry,
  session: DkgSession,
  index: number,
  signer: HybridSigner
): Promise<{ deal: DkgDeal; secret: DkgSecret }> {
  const problems = sessionErrors(reg, session);
  if (problems.length) throw new Error(problems.join(" "));
  memberFor(reg, index, signer);
  const c = await getCrypto();
  const sessionId = dkgSessionId(session);
  const coeffs: bigint[] = [];
  for (let k = 0; k < session.threshold; k++) coeffs.push(await randomScalar());
  const B = base8(c);
  const commitments = coeffs.map((a) => str(mul(c, B, a)));
  const boxes = reg.members
    .filter((m) => m.index !== index)
    .sort((a, b) => a.index - b.index)
    .map((m) => ({
      to: m.index,
      box: sealTo(m.kem, Buffer.from(evalPoly(c, coeffs, m.index).toString()), dkgShareContext(sessionId, index, m.index)),
    }));
  const unsigned = { sessionId, from: index, commitments, boxes };
  const secret: DkgSecret = { format: DKG_SECRET_FORMAT, sessionId, index, ownShare: evalPoly(c, coeffs, index).toString() };
  coeffs.fill(BigInt(0));
  return { deal: { ...unsigned, signature: signer.sign(dkgDealDigest(unsigned)) }, secret };
}

/** Public checks on one deal: signature, commitment points, one box to every other member. */
export async function dealErrors(reg: ConsortiumRegistry, session: DkgSession, d: DkgDeal): Promise<string | null> {
  const sessionId = dkgSessionId(session);
  if (!d || d.sessionId !== sessionId) return "Deal is for a different session.";
  const m = reg.members.find((x) => x.index === d.from);
  if (!m) return `Deal from unknown member ${d.from}.`;
  if (!isValidHybridSignature(d.signature) || !verifyHybrid(m.signing, dkgDealDigest(d), d.signature)) {
    return `Deal from member ${d.from} is not signed by its registered key.`;
  }
  if (!Array.isArray(d.commitments) || d.commitments.length !== session.threshold) {
    return `Deal from member ${d.from} must have ${session.threshold} commitments.`;
  }
  const c = await getCrypto();
  try {
    for (const C of d.commitments) if (!inSubgroup(c, pt(C))) return `Deal from member ${d.from} has a commitment off the subgroup.`;
  } catch {
    return `Deal from member ${d.from} has a malformed commitment.`;
  }
  if (eq(pt(d.commitments[0]), IDENTITY)) return `Deal from member ${d.from} contributes nothing to the key.`;
  const others = reg.members.filter((x) => x.index !== d.from).map((x) => x.index).sort((a, b) => a - b);
  const to = (d.boxes ?? []).map((b) => b.to).sort((a, b) => a - b);
  if (JSON.stringify(to) !== JSON.stringify(others) || !d.boxes.every((b) => isSealedBox(b.box))) {
    return `Deal from member ${d.from} must seal exactly one share to each other member.`;
  }
  return null;
}

/** PK and every Y_m, from the commitments alone. */
async function publicOutcome(session: DkgSession, deals: DkgDeal[]): Promise<{ publicKey: PointStr; verificationKeys: ConsortiumKey["verificationKeys"] }> {
  const c = await getCrypto();
  const commits = deals.map((d) => d.commitments.map(pt));
  const PK = commits.reduce((acc, C) => add(c, acc, C[0]), IDENTITY);
  const verificationKeys = session.members.map(({ index }) => ({
    index,
    publicKey: str(commits.reduce((acc, C) => add(c, acc, evalCommitments(c, C, index)), IDENTITY)),
  }));
  return { publicKey: str(PK), verificationKeys };
}

async function allDeals(reg: ConsortiumRegistry, session: DkgSession, deals: DkgDeal[]): Promise<DkgDeal[]> {
  const byFrom = new Map<number, DkgDeal>();
  for (const d of deals) {
    if (byFrom.has(d.from)) throw new Error(`Two deals from member ${d.from}.`);
    const why = await dealErrors(reg, session, d);
    if (why) throw new Error(why);
    byFrom.set(d.from, d);
  }
  const missing = session.members.filter((m) => !byFrom.has(m.index)).map((m) => m.index);
  if (missing.length) throw new Error(`Missing deals from member${missing.length > 1 ? "s" : ""} ${missing.join(", ")}. Every member must deal.`);
  return session.members.map((m) => byFrom.get(m.index)!);
}

// --- Finalize ---

/**
 * Member `secret.index` checks every share sealed to it, then derives its key
 * share and signs the result. Throws, naming the dealer, if any share doesn't
 * match that dealer's commitments.
 */
export async function dkgFinalize(
  reg: ConsortiumRegistry,
  session: DkgSession,
  deals: DkgDeal[],
  secret: DkgSecret,
  memberKey: EscrowMemberKey,
  signer: HybridSigner
): Promise<{ keyShare: KeyShare; consortium: ConsortiumKey; result: DkgResult }> {
  const sessionId = dkgSessionId(session);
  if (secret.format !== DKG_SECRET_FORMAT || secret.sessionId !== sessionId) throw new Error("That secret file is from a different session.");
  const me = memberFor(reg, secret.index, signer);
  if (memberKey.index !== me.index || memberKey.publicKey !== me.kem) throw new Error("That X-Wing key isn't this member's registered key.");
  const ordered = await allDeals(reg, session, deals);
  const c = await getCrypto();
  const B = base8(c);

  let share = mod(BigInt(secret.ownShare), c.l);
  const own = ordered.find((d) => d.from === me.index)!;
  if (!eq(mul(c, B, share), evalCommitments(c, own.commitments.map(pt), me.index))) {
    throw new Error("Your own share doesn't match your own deal. Wrong secret file?");
  }
  for (const d of ordered) {
    if (d.from === me.index) continue;
    const box = d.boxes.find((b) => b.to === me.index)!;
    let s: bigint;
    try {
      s = BigInt(openBox(memberKey.secretKey, box.box, dkgShareContext(sessionId, d.from, me.index)).toString("utf-8"));
    } catch {
      throw new Error(`Member ${d.from}'s share to you doesn't open. Restart the ceremony without them.`);
    }
    if (s <= BigInt(0) || s >= c.l || !eq(mul(c, B, s), evalCommitments(c, d.commitments.map(pt), me.index))) {
      throw new Error(`Member ${d.from}'s share to you doesn't match their commitments. Restart the ceremony without them.`);
    }
    share = mod(share + s, c.l);
  }

  const { publicKey, verificationKeys } = await publicOutcome(session, ordered);
  const mine = verificationKeys.find((v) => v.index === me.index)!;
  if (!eq(mul(c, B, share), pt(mine.publicKey))) throw new Error("Derived share doesn't match the public verification key.");

  const unsigned = { sessionId, index: me.index, publicKey, verificationKeysHash: verificationKeysHash(verificationKeys) };
  return {
    keyShare: { format: REVEAL_FORMAT, index: me.index, share: share.toString(), consortiumPublicKey: publicKey },
    consortium: { format: REVEAL_FORMAT, threshold: session.threshold, parties: session.parties, publicKey, verificationKeys },
    result: { ...unsigned, signature: signer.sign(resultDigest(unsigned)) },
  };
}

// --- Verify ---

/**
 * Check a whole ceremony from its public transcript. Needs every deal and a
 * signed result from every member, all naming the same key. Returns the
 * ConsortiumKey to publish.
 */
export async function verifyDkgTranscript(reg: ConsortiumRegistry, t: DkgTranscript): Promise<ConsortiumKey> {
  const problems = sessionErrors(reg, t.session);
  if (problems.length) throw new Error(problems.join(" "));
  const sessionId = dkgSessionId(t.session);
  const ordered = await allDeals(reg, t.session, t.deals);
  const { publicKey, verificationKeys } = await publicOutcome(t.session, ordered);
  const vkHash = verificationKeysHash(verificationKeys);
  const seen = new Set<number>();
  for (const r of t.results) {
    const m = reg.members.find((x) => x.index === r.index);
    if (!m || r.sessionId !== sessionId) throw new Error(`Result from member ${r.index} is not for this session.`);
    if (!isValidHybridSignature(r.signature) || !verifyHybrid(m.signing, resultDigest(r), r.signature)) {
      throw new Error(`Result from member ${r.index} is not signed by its registered key.`);
    }
    if (!eq(pt(r.publicKey), pt(publicKey)) || r.verificationKeysHash !== vkHash) {
      throw new Error(`Member ${r.index} computed a different key than the transcript gives.`);
    }
    seen.add(r.index);
  }
  const missing = t.session.members.filter((m) => !seen.has(m.index)).map((m) => m.index);
  if (missing.length) throw new Error(`No signed result from member${missing.length > 1 ? "s" : ""} ${missing.join(", ")}.`);
  return { format: REVEAL_FORMAT, threshold: t.session.threshold, parties: t.session.parties, publicKey, verificationKeys };
}
