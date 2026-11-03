/**
 * Post-quantum sealed escrow (`vero-escrow/v2`).
 *
 * Wraps a threshold-reveal ciphertext so that a stolen copy of the escrow
 * store is useless even to an attacker with a future quantum computer
 * ("harvest now, decrypt later"):
 *
 *   1. A fresh AES-256-GCM key K encrypts the reveal ciphertext.
 *   2. K is Shamir-split k-of-n over the prime field 2^521 − 1.
 *   3. Share i is sealed to consortium member i's X-Wing public key
 *      (ML-KEM-768 + X25519 hybrid KEM, draft-connolly-cfrg-xwing-kem).
 *
 * Opening needs k members to unseal their shares, then the existing k-of-n
 * ElGamal partial decryption on the inner ciphertext. The inner layer is
 * classical (BabyJubJub); the outer layer is post-quantum. An attacker has
 * to break both.
 *
 * Members generate their own X-Wing keys. Nobody ever holds all the shares,
 * and there is no dealer. Only the server briefly sees K, at seal time.
 *
 * Not independently audited. `@noble/post-quantum` is not constant-time and
 * not FIPS-validated.
 */

import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "crypto";
import { ml_kem768_x25519 as xwing } from "@noble/post-quantum/hybrid.js";

export const ESCROW_FORMAT = "vero-escrow/v2";
export const ESCROW_KEYS_FORMAT = "vero-escrow-keys/v1";
export const XWING_PUBLIC_KEY_BYTES = 1216;

// --- Formats ---

/** Public escrow configuration — the members' X-Wing public keys and the threshold. */
export interface EscrowKeySet {
  format: typeof ESCROW_KEYS_FORMAT;
  threshold: number;
  members: { index: number; publicKey: string /* base64 */ }[];
}

/** A member's own X-Wing key pair. Secret; stays with that member. */
export interface EscrowMemberKey {
  format: typeof ESCROW_KEYS_FORMAT;
  index: number;
  publicKey: string; // base64
  secretKey: string; // base64 (32-byte X-Wing seed)
}

interface Sealed {
  iv: string;   // base64, 12 bytes
  data: string; // base64, ciphertext ‖ 16-byte GCM tag
}

export interface EscrowEnvelope {
  format: typeof ESCROW_FORMAT;
  txId: string;
  threshold: number;
  parties: number;
  /** SHA-256 of the inner reveal ciphertext (hex); checked again after opening. */
  ciphertextHash: string;
  /** SHA-256 over the member public keys in index order (hex). */
  keySetId: string;
  body: Sealed;
  shares: ({ index: number; kem: string /* base64 */ } & Sealed)[];
}

/** One member's unsealed share. Safe to send to whoever opens the envelope, not to anyone else. */
export interface EscrowSharePart {
  format: typeof ESCROW_FORMAT;
  txId: string;
  keySetId: string;
  index: number;
  share: string; // hex, 66 bytes
}

// --- Shamir over GF(2^521 − 1) ---

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const P = (ONE << BigInt(521)) - ONE; // Mersenne prime, comfortably larger than a 256-bit key
const SHARE_BYTES = 66;

const mod = (a: bigint) => ((a % P) + P) % P;

function modPow(base: bigint, exp: bigint): bigint {
  let result = ONE;
  base = mod(base);
  while (exp > ZERO) {
    if (exp & ONE) result = (result * base) % P;
    base = (base * base) % P;
    exp >>= ONE;
  }
  return result;
}

const inv = (a: bigint) => modPow(a, P - TWO);

/** Uniform in [0, P): mask 66 random bytes to 521 bits, reject the single value P itself. */
function randomFieldElement(): bigint {
  for (;;) {
    const b = randomBytes(SHARE_BYTES);
    b[0] &= 0x01; // 528 bits → 521 bits
    const v = bytesToBigInt(b);
    if (v < P) return v;
  }
}

function splitSecret(secret: bigint, k: number, n: number): bigint[] {
  const coeffs = [secret, ...Array.from({ length: k - 1 }, randomFieldElement)];
  return Array.from({ length: n }, (_, i) => {
    const x = BigInt(i + 1);
    return coeffs.reduceRight((acc, c) => mod(acc * x + c), ZERO);
  });
}

function combineShares(points: { index: number; value: bigint }[]): bigint {
  let secret = ZERO;
  for (const { index: i, value } of points) {
    let num = ONE;
    let den = ONE;
    for (const { index: j } of points) {
      if (j === i) continue;
      num = mod(num * BigInt(j));
      den = mod(den * BigInt(j - i));
    }
    secret = mod(secret + value * num * inv(den));
  }
  return secret;
}

// --- Byte helpers ---

function bytesToBigInt(b: Uint8Array): bigint {
  return b.length === 0 ? ZERO : BigInt("0x" + Buffer.from(b).toString("hex"));
}

function bigIntToBytes(v: bigint, len: number): Buffer {
  return Buffer.from(v.toString(16).padStart(len * 2, "0"), "hex");
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

// --- AES-256-GCM ---

function seal(key: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return { iv: b64(iv), data: b64(data) };
}

function open(key: Uint8Array, sealed: Sealed, aad: Uint8Array): Buffer {
  const raw = Buffer.from(sealed.data, "base64");
  if (raw.length < 16) throw new Error("Sealed data is too short.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAAD(aad);
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(0, raw.length - 16)), decipher.final()]);
}

// --- Binding ---

export function keySetId(keys: EscrowKeySet): string {
  const h = createHash("sha256");
  for (const m of [...keys.members].sort((a, b) => a.index - b.index)) {
    h.update(`${m.index}:`).update(unb64(m.publicKey));
  }
  return h.digest("hex");
}

/** Everything the envelope commits to, outside the ciphertexts themselves. */
function headerAad(env: Pick<EscrowEnvelope, "format" | "txId" | "threshold" | "parties" | "ciphertextHash" | "keySetId">): Buffer {
  return Buffer.from(JSON.stringify([env.format, env.txId, env.threshold, env.parties, env.ciphertextHash, env.keySetId]));
}

function shareKey(sharedSecret: Uint8Array, txId: string, index: number): Uint8Array {
  return new Uint8Array(hkdfSync("sha256", sharedSecret, new Uint8Array(0), `${ESCROW_FORMAT}|share|${txId}|${index}`, 32));
}

// --- Keys ---

export function generateEscrowMemberKey(index: number): EscrowMemberKey {
  if (!Number.isInteger(index) || index < 1) throw new Error("Member index must be a positive integer.");
  const { publicKey, secretKey } = xwing.keygen();
  return { format: ESCROW_KEYS_FORMAT, index, publicKey: b64(publicKey), secretKey: b64(secretKey) };
}

/** Validate a key set; throws with a readable message when it's malformed. */
export function parseEscrowKeySet(raw: unknown): EscrowKeySet {
  const ks = raw as Partial<EscrowKeySet>;
  if (!ks || ks.format !== ESCROW_KEYS_FORMAT) throw new Error(`Escrow key set must have format "${ESCROW_KEYS_FORMAT}".`);
  if (!Array.isArray(ks.members) || ks.members.length === 0) throw new Error("Escrow key set has no members.");
  const n = ks.members.length;
  if (!Number.isInteger(ks.threshold) || ks.threshold! < 1 || ks.threshold! > n) {
    throw new Error(`Escrow threshold must be between 1 and ${n}.`);
  }
  const seen = new Set<number>();
  for (const m of ks.members) {
    if (!Number.isInteger(m?.index) || m.index < 1 || m.index > n || seen.has(m.index)) {
      throw new Error(`Escrow member indices must be 1..${n}, each used once.`);
    }
    seen.add(m.index);
    if (typeof m.publicKey !== "string" || unb64(m.publicKey).length !== XWING_PUBLIC_KEY_BYTES) {
      throw new Error(`Escrow member ${m.index} has an invalid X-Wing public key.`);
    }
  }
  return { format: ESCROW_KEYS_FORMAT, threshold: ks.threshold!, members: ks.members.map(({ index, publicKey }) => ({ index, publicKey })) };
}

// --- Seal / open ---

/**
 * Seal `plaintext` (the canonical inner reveal ciphertext) for `txId`.
 * `ciphertextHash` is recorded in the header and authenticated by every share.
 */
export function sealEscrow(keys: EscrowKeySet, txId: string, plaintext: Uint8Array, ciphertextHash: string): EscrowEnvelope {
  const header = {
    format: ESCROW_FORMAT,
    txId,
    threshold: keys.threshold,
    parties: keys.members.length,
    ciphertextHash,
    keySetId: keySetId(keys),
  } as const;
  const aad = headerAad(header);

  const k = randomBytes(32);
  const body = seal(k, plaintext, aad);

  const members = [...keys.members].sort((a, b) => a.index - b.index);
  const values = splitSecret(bytesToBigInt(k), keys.threshold, members.length);
  const shares = members.map((m) => {
    const { cipherText, sharedSecret } = xwing.encapsulate(unb64(m.publicKey));
    const sealed = seal(shareKey(sharedSecret, txId, m.index), bigIntToBytes(values[m.index - 1], SHARE_BYTES), aad);
    return { index: m.index, kem: b64(cipherText), ...sealed };
  });
  k.fill(0);

  return { ...header, body, shares };
}

/** Run by ONE member: recover their share of the envelope key. */
export function unsealEscrowShare(member: EscrowMemberKey, env: EscrowEnvelope): EscrowSharePart {
  assertEnvelope(env);
  const entry = env.shares.find((s) => s.index === member.index);
  if (!entry) throw new Error(`Envelope has no share for member ${member.index}.`);
  const sharedSecret = xwing.decapsulate(unb64(entry.kem), unb64(member.secretKey));
  let share: Buffer;
  try {
    share = open(shareKey(sharedSecret, env.txId, member.index), entry, headerAad(env));
  } catch {
    throw new Error(`Member ${member.index}: share did not decrypt. Wrong key, or the envelope was altered.`);
  }
  return { format: ESCROW_FORMAT, txId: env.txId, keySetId: env.keySetId, index: member.index, share: share.toString("hex") };
}

/** Combine at least `threshold` share parts and decrypt the inner reveal ciphertext. */
export function openEscrow(env: EscrowEnvelope, parts: EscrowSharePart[]): Buffer {
  assertEnvelope(env);
  const usable = new Map<number, bigint>();
  for (const p of parts) {
    if (p.txId !== env.txId || p.keySetId !== env.keySetId) {
      throw new Error(`Share part from member ${p.index} belongs to a different envelope.`);
    }
    if (!/^[0-9a-f]+$/.test(p.share) || p.share.length !== SHARE_BYTES * 2) {
      throw new Error(`Share part from member ${p.index} is malformed.`);
    }
    usable.set(p.index, BigInt("0x" + p.share));
  }
  if (usable.size < env.threshold) {
    throw new Error(`Need ${env.threshold} distinct share parts, got ${usable.size}.`);
  }
  const points = [...usable].slice(0, env.threshold).map(([index, value]) => ({ index, value }));
  const k = combineShares(points);
  if (k >= ONE << BigInt(256)) throw new Error("Share parts do not combine to a valid key.");
  try {
    return open(bigIntToBytes(k, 32), env.body, headerAad(env));
  } catch {
    throw new Error("Envelope did not decrypt. A share part is wrong, or the envelope was altered.");
  }
}

function assertEnvelope(env: EscrowEnvelope) {
  if (!env || env.format !== ESCROW_FORMAT) throw new Error(`Not a ${ESCROW_FORMAT} envelope.`);
}
