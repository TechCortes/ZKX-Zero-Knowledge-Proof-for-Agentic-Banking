/**
 * Threshold reveal — ROADMAP.md phase 2. Format spec: docs/threshold-reveal.md.
 *
 * The kyc_reveal circuit encrypts (idHash, birthYear, salt) to a consortium public
 * key PK and proves the ciphertext is honest. This module is everything outside the
 * circuit:
 *
 *   - dealKeyShares      : split a consortium secret key k-of-n (Shamir over the
 *                          BabyJubJub subgroup order). REFERENCE ONLY — a trusted
 *                          dealer sees the whole key. Use ./dkg.ts instead: a
 *                          DKG that produces the same shapes with no dealer.
 *   - encryptForReveal   : JS mirror of the circuit's encryption (tests, tooling).
 *   - partialDecrypt     : one party's share applied to a ciphertext, plus a
 *                          Chaum-Pedersen proof that it used its real share.
 *   - combinePartials    : any k valid partials → plaintext, checked against the
 *                          public commitment so a wrong answer can't go unnoticed.
 *
 * Nothing here talks to the network or stores keys. Callers own key custody.
 */

// Frozen wire-format tag: written into stored records and checked on read.
// It keeps the pre-rename "vero-" prefix on purpose — changing it would orphan existing data.
export const REVEAL_FORMAT = "vero-reveal/v1";

import {
  add, base8, eq, getCrypto, hash, inSubgroup, mod, modInverse, mul, pt, randomScalar, str,
  type Crypto, type Point, type PointStr,
} from "./babyjub";

export type { Point } from "./babyjub";

/** Public consortium description: safe to publish, configure on the server, and share. */
export interface ConsortiumKey {
  format: typeof REVEAL_FORMAT;
  threshold: number;
  parties: number;
  /** PK = sk * Base8. The only value the circuit and server need. */
  publicKey: PointStr;
  /** Y_i = share_i * Base8 per party, used to check each partial decryption. */
  verificationKeys: { index: number; publicKey: PointStr }[];
}

/** One party's secret share. Never leaves that party's custody. */
export interface KeyShare {
  format: typeof REVEAL_FORMAT;
  index: number;
  share: string;
  /** The consortium PK this share belongs to — guards against mixing consortia. */
  consortiumPublicKey: PointStr;
}

/** What gets stored next to a commitment after a reveal-enabled proof verifies. */
export interface RevealCiphertext {
  format: typeof REVEAL_FORMAT;
  commitment: string;
  publicKey: PointStr;
  ephemeral: PointStr;
  ciphertext: [string, string, string];
}

export interface PartialDecryption {
  format: typeof REVEAL_FORMAT;
  index: number;
  /** D_i = share_i * R */
  partial: PointStr;
  /** Chaum-Pedersen proof that log_Base8(Y_i) == log_R(D_i). */
  proof: { a1: PointStr; a2: PointStr; z: string };
}

export interface RevealedIdentity {
  idHash: string;
  birthYear: number;
  salt: string;
  /** Poseidon(idHash, salt) == ciphertext.commitment. False means the result is not trustworthy. */
  commitmentMatches: boolean;
}

/**
 * Layout of kyc_reveal's publicSignals (outputs first, then public inputs):
 * [R.x, R.y, c0, c1, c2, commitment, currentYear, minAge, PK.x, PK.y, txNonce]
 */
export const REVEAL_SIGNALS = {
  count: 11,
  ephemeral: [0, 1],
  ciphertext: [2, 3, 4],
  commitment: 5,
  currentYear: 6,
  minAge: 7,
  publicKey: [8, 9],
  txNonce: 10,
} as const;

/** The circuit's private `revealNonce` (r). Fresh per proof — reusing it links ciphertexts. */
export async function randomRevealNonce(): Promise<string> {
  return (await randomScalar()).toString();
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * Trusted-dealer k-of-n key generation. REFERENCE ONLY: the dealer briefly holds
 * the full secret key. Real deployments use the DKG (./dkg.ts) or an HSM ceremony that
 * outputs the same ConsortiumKey + KeyShare shapes.
 */
export async function dealKeyShares(
  threshold: number,
  parties: number
): Promise<{ consortium: ConsortiumKey; shares: KeyShare[] }> {
  if (!Number.isInteger(threshold) || !Number.isInteger(parties) || threshold < 1 || parties < threshold) {
    throw new Error("Need integers with 1 <= threshold <= parties.");
  }
  const c = await getCrypto();
  // f(x) = sk + a1*x + ... + a_{k-1}*x^{k-1}; share_i = f(i), sk = f(0)
  const coeffs: bigint[] = [];
  for (let i = 0; i < threshold; i++) coeffs.push(await randomScalar());
  const evalAt = (x: bigint) => coeffs.reduceRight((acc, a) => mod(acc * x + a, c.l), BigInt(0));

  const B = base8(c);
  const publicKey = str(mul(c, B, coeffs[0]));
  const shares: KeyShare[] = [];
  const verificationKeys: ConsortiumKey["verificationKeys"] = [];
  for (let i = 1; i <= parties; i++) {
    const s = evalAt(BigInt(i));
    shares.push({ format: REVEAL_FORMAT, index: i, share: s.toString(), consortiumPublicKey: publicKey });
    verificationKeys.push({ index: i, publicKey: str(mul(c, B, s)) });
  }
  return {
    consortium: { format: REVEAL_FORMAT, threshold, parties, publicKey, verificationKeys },
    shares,
  };
}

/** Is this a usable consortium public key (on the curve, in the prime subgroup, not identity)? */
export async function isValidRevealPublicKey(pk: PointStr): Promise<boolean> {
  try {
    const c = await getCrypto();
    const p = pt(pk);
    return !eq(p, [BigInt(0), BigInt(1)]) && inSubgroup(c, p);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Encryption (mirror of the circuit) and ciphertext extraction
// ---------------------------------------------------------------------------

async function streamPad(c: Crypto, S: Point): Promise<bigint[]> {
  return [BigInt(0), BigInt(1), BigInt(2)].map((i) => hash(c, [S[0], S[1], i]));
}

/** Exactly what kyc_reveal.circom computes. Used by tests and tooling; the prover gets this from the witness. */
export async function encryptForReveal(
  publicKey: PointStr,
  plaintext: { idHash: string; birthYear: number; salt: string },
  commitment: string,
  nonce: string
): Promise<RevealCiphertext> {
  const c = await getCrypto();
  const p = BigInt(c.poseidon.F.p.toString());
  const r = BigInt(nonce);
  const R = mul(c, base8(c), r);
  const S = mul(c, pt(publicKey), r);
  const pad = await streamPad(c, S);
  const m = [BigInt(plaintext.idHash), BigInt(plaintext.birthYear), BigInt(plaintext.salt)];
  const ct = m.map((v, i) => mod(v + pad[i], p).toString()) as [string, string, string];
  return { format: REVEAL_FORMAT, commitment, publicKey, ephemeral: str(R), ciphertext: ct };
}

/** Pull the stored ciphertext out of a verified kyc_reveal proof's publicSignals. */
export function ciphertextFromSignals(publicSignals: string[]): RevealCiphertext {
  if (publicSignals.length !== REVEAL_SIGNALS.count) {
    throw new Error(`Expected ${REVEAL_SIGNALS.count} public signals for kyc_reveal.`);
  }
  const s = publicSignals;
  const L = REVEAL_SIGNALS;
  return {
    format: REVEAL_FORMAT,
    commitment: s[L.commitment],
    publicKey: [s[L.publicKey[0]], s[L.publicKey[1]]],
    ephemeral: [s[L.ephemeral[0]], s[L.ephemeral[1]]],
    ciphertext: [s[L.ciphertext[0]], s[L.ciphertext[1]], s[L.ciphertext[2]]],
  };
}

// ---------------------------------------------------------------------------
// Threshold decryption
// ---------------------------------------------------------------------------

/** sum(lambda_i * P_i) with Lagrange coefficients at x = 0: lambda_i = prod_{j != i} x_j / (x_j - x_i), mod l. */
function interpolateAtZero(c: Crypto, points: { index: number; point: Point }[]): Point {
  const xs = points.map((p) => BigInt(p.index));
  let acc: Point = [BigInt(0), BigInt(1)];
  points.forEach((p, i) => {
    let num = BigInt(1);
    let den = BigInt(1);
    xs.forEach((xj, j) => {
      if (j === i) return;
      num = mod(num * xj, c.l);
      den = mod(den * (xj - xs[i]), c.l);
    });
    acc = add(c, acc, mul(c, p.point, mod(num * modInverse(den, c.l), c.l)));
  });
  return acc;
}

/**
 * Rebuild the public ConsortiumKey from the members' published verification keys
 * Y_i (for example, from the key registry): PK = sum(lambda_i * Y_i). With more than
 * `threshold` keys, every window of `threshold` consecutive keys must give the same
 * PK, so inconsistent keys are caught instead of silently trusted.
 */
export async function consortiumKeyFromVerificationKeys(
  threshold: number,
  parties: number,
  verificationKeys: { index: number; publicKey: PointStr }[]
): Promise<ConsortiumKey> {
  const vks = [...verificationKeys].sort((a, b) => a.index - b.index);
  if (new Set(vks.map((v) => v.index)).size !== vks.length) throw new Error("Duplicate verification key index.");
  if (vks.length < threshold) throw new Error(`Need ${threshold} verification keys, got ${vks.length}.`);
  const c = await getCrypto();
  const points = vks.map((v) => {
    const p = pt(v.publicKey);
    if (!inSubgroup(c, p)) throw new Error(`Verification key ${v.index} is not a valid subgroup point.`);
    return { index: v.index, point: p };
  });
  const pk = interpolateAtZero(c, points.slice(0, threshold));
  for (let i = 1; i + threshold <= points.length; i++) {
    if (!eq(interpolateAtZero(c, points.slice(i, i + threshold)), pk)) {
      throw new Error("Verification keys are inconsistent: they don't all come from one consortium key.");
    }
  }
  return { format: REVEAL_FORMAT, threshold, parties, publicKey: str(pk), verificationKeys: vks };
}

/** DLEQ challenge, Fiat-Shamir over Poseidon. Binds the ciphertext so a proof can't be replayed onto another one. */
function dleqChallenge(c: Crypto, Y: Point, R: Point, D: Point, A1: Point, A2: Point): bigint {
  return mod(hash(c, [...Y, ...R, ...D, ...A1, ...A2]), c.l);
}

/** One consortium member's contribution to decrypting a single ciphertext. */
export async function partialDecrypt(share: KeyShare, ct: RevealCiphertext): Promise<PartialDecryption> {
  if (share.consortiumPublicKey[0] !== ct.publicKey[0] || share.consortiumPublicKey[1] !== ct.publicKey[1]) {
    throw new Error("This share belongs to a different consortium key than the ciphertext.");
  }
  const c = await getCrypto();
  const R = pt(ct.ephemeral);
  if (!inSubgroup(c, R)) throw new Error("Ciphertext ephemeral key is not a valid subgroup point.");

  const s = BigInt(share.share);
  const B = base8(c);
  const D = mul(c, R, s);
  const Y = mul(c, B, s);
  const w = await randomScalar();
  const A1 = mul(c, B, w);
  const A2 = mul(c, R, w);
  const e = dleqChallenge(c, Y, R, D, A1, A2);
  const z = mod(w + e * s, c.l);
  return { format: REVEAL_FORMAT, index: share.index, partial: str(D), proof: { a1: str(A1), a2: str(A2), z: z.toString() } };
}

/** Check a partial against the party's published verification key. */
export async function verifyPartial(
  consortium: ConsortiumKey,
  ct: RevealCiphertext,
  pd: PartialDecryption
): Promise<boolean> {
  try {
    const vk = consortium.verificationKeys.find((v) => v.index === pd.index);
    if (!vk) return false;
    const c = await getCrypto();
    const Y = pt(vk.publicKey);
    const R = pt(ct.ephemeral);
    const D = pt(pd.partial);
    const A1 = pt(pd.proof.a1);
    const A2 = pt(pd.proof.a2);
    if (![R, D, A1, A2].every((p) => inSubgroup(c, p))) return false;
    const e = dleqChallenge(c, Y, R, D, A1, A2);
    const z = BigInt(pd.proof.z);
    const B = base8(c);
    return eq(mul(c, B, z), add(c, A1, mul(c, Y, e))) && eq(mul(c, R, z), add(c, A2, mul(c, D, e)));
  } catch {
    return false;
  }
}

/**
 * Combine at least `threshold` partials into the plaintext. Every partial is
 * verified first; invalid ones are reported by index rather than silently used.
 */
export async function combinePartials(
  consortium: ConsortiumKey,
  ct: RevealCiphertext,
  partials: PartialDecryption[]
): Promise<RevealedIdentity> {
  if (consortium.publicKey[0] !== ct.publicKey[0] || consortium.publicKey[1] !== ct.publicKey[1]) {
    throw new Error("Ciphertext was encrypted to a different consortium key.");
  }
  const seen = new Set<number>();
  const valid: PartialDecryption[] = [];
  const invalid: number[] = [];
  for (const pd of partials) {
    if (seen.has(pd.index)) continue;
    seen.add(pd.index);
    if (await verifyPartial(consortium, ct, pd)) valid.push(pd);
    else invalid.push(pd.index);
  }
  if (invalid.length) {
    throw new Error(`Invalid partial decryption from part${invalid.length > 1 ? "ies" : "y"} ${invalid.join(", ")}.`);
  }
  if (valid.length < consortium.threshold) {
    throw new Error(`Need ${consortium.threshold} valid partials, got ${valid.length}.`);
  }

  const c = await getCrypto();
  const used = valid.slice(0, consortium.threshold);
  // S = sum(lambda_i * D_i)
  const S = interpolateAtZero(c, used.map((pd) => ({ index: pd.index, point: pt(pd.partial) })));

  const p = BigInt(c.poseidon.F.p.toString());
  const pad = await streamPad(c, S);
  const m = ct.ciphertext.map((v, i) => mod(BigInt(v) - pad[i], p));
  const commitment = hash(c, [m[0], m[2]]);
  return {
    idHash: m[0].toString(),
    birthYear: Number(m[1]),
    salt: m[2].toString(),
    commitmentMatches: commitment.toString() === ct.commitment,
  };
}
