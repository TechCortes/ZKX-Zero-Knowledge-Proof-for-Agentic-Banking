/**
 * Hybrid signatures for audit checkpoints: Ed25519 + ML-DSA-65 (FIPS 204).
 *
 * A checkpoint is valid only if BOTH signatures verify, so forging one needs
 * breaking Ed25519 (classical) and ML-DSA-65 (post-quantum) at once.
 *
 * VERO_AUDIT_SIGNING_KEY is one base64 32-byte seed; both key pairs are
 * derived from it with HKDF, so there's a single secret to store. Generate it
 * with `npm run audit -- keygen`.
 *
 * `@noble/post-quantum` is not audited and not constant-time. An institution
 * would sign inside an HSM.
 */

import { createPrivateKey, createPublicKey, hkdfSync, sign, verify, randomBytes, createHash, type KeyObject } from "crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

export const SIGNATURE_SUITE = "ed25519+ml-dsa-65";

export interface HybridPublicKey {
  suite: typeof SIGNATURE_SUITE;
  ed25519: string;  // base64, 32 bytes raw
  mlDsa65: string;  // base64, 1952 bytes
  /** SHA-256 over both public keys (hex, first 16 chars) — a short name for the key. */
  keyId: string;
}

export interface HybridSignature {
  suite: typeof SIGNATURE_SUITE;
  keyId: string;
  ed25519: string; // base64
  mlDsa65: string; // base64
}

export interface HybridSigner {
  publicKey: HybridPublicKey;
  sign(message: Uint8Array): HybridSignature;
}

const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

function derive(seed: Uint8Array, label: string): Buffer {
  return Buffer.from(hkdfSync("sha256", seed, new Uint8Array(0), `vero-audit-signing|${label}`, 32));
}

function ed25519PublicFromRaw(raw: Uint8Array): KeyObject {
  return createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw]), format: "der", type: "spki" });
}

function keyIdOf(ed: Uint8Array, pq: Uint8Array): string {
  return createHash("sha256").update(ed).update(pq).digest("hex").slice(0, 16);
}

export function generateAuditSigningSeed(): string {
  return b64(randomBytes(32));
}

export function signerFromSeed(seedB64: string): HybridSigner {
  const seed = unb64(seedB64);
  if (seed.length !== 32) throw new Error("Audit signing seed must be 32 bytes (base64).");

  const edPriv = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, derive(seed, "ed25519")]),
    format: "der",
    type: "pkcs8",
  });
  const edPub = new Uint8Array(createPublicKey(edPriv).export({ format: "der", type: "spki" }).subarray(ED25519_SPKI_PREFIX.length));
  const pq = ml_dsa65.keygen(new Uint8Array(derive(seed, "ml-dsa-65")));

  const publicKey: HybridPublicKey = {
    suite: SIGNATURE_SUITE,
    ed25519: b64(edPub),
    mlDsa65: b64(pq.publicKey),
    keyId: keyIdOf(edPub, pq.publicKey),
  };

  return {
    publicKey,
    sign(message) {
      return {
        suite: SIGNATURE_SUITE,
        keyId: publicKey.keyId,
        ed25519: b64(sign(null, message, edPriv)),
        mlDsa65: b64(ml_dsa65.sign(message, pq.secretKey)),
      };
    },
  };
}

/** True only if both signatures verify under `key`. */
export function verifyHybrid(key: HybridPublicKey, message: Uint8Array, sig: HybridSignature): boolean {
  if (sig.suite !== SIGNATURE_SUITE || key.suite !== SIGNATURE_SUITE || sig.keyId !== key.keyId) return false;
  const ed = unb64(key.ed25519);
  const pq = unb64(key.mlDsa65);
  if (keyIdOf(ed, pq) !== key.keyId) return false;
  try {
    return verify(null, message, ed25519PublicFromRaw(ed), Buffer.from(sig.ed25519, "base64")) &&
      ml_dsa65.verify(unb64(sig.mlDsa65), message, pq);
  } catch {
    return false;
  }
}

let cached: { raw: string | undefined; signer: HybridSigner | null } | null = null;

/** The checkpoint signer from VERO_AUDIT_SIGNING_KEY, or null when unset. Throws if malformed. */
export function getAuditSigner(): HybridSigner | null {
  const raw = process.env.VERO_AUDIT_SIGNING_KEY?.trim() || undefined;
  if (cached && cached.raw === raw) return cached.signer;
  let signer: HybridSigner | null = null;
  if (raw) {
    try {
      signer = signerFromSeed(raw);
    } catch (e) {
      throw new Error(`VERO_AUDIT_SIGNING_KEY is set but invalid: ${(e as Error).message}`);
    }
  }
  cached = { raw, signer };
  return signer;
}
