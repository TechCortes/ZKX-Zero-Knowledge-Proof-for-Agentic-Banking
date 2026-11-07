/**
 * Issuer-signed KYC credentials (plan item I1). Format spec: docs/credentials.md.
 *
 * A KYC issuer checks a person's documents once and signs
 *
 *     M = Poseidon(CREDENTIAL_TAG, idHash, birthYear, expiryDay)
 *
 * with EdDSA-Poseidon on BabyJubJub. Both circuits verify that signature
 * privately (circuits/lib/credential.circom), so a proof now shows the identity
 * was vouched for by the pinned issuer, not just typed in by the holder.
 *
 * The issuer in this repo is a DEMO issuer: it signs whatever idHash and
 * birthYear it is sent. It exists so the full flow runs end to end. A real
 * deployment pins the public key of a real KYC provider instead.
 *
 * Also here: the per-person daily nullifier Poseidon(idHash, scope, day), which
 * lets the server cap spend per person per day across any number of agents.
 */

import { eq, getCrypto, hash, inSubgroup, pt, type PointStr } from "./babyjub";

/** New wire format, so it gets the ZQUENT prefix (the frozen vero-* tags are older formats). */
export const CREDENTIAL_FORMAT = "zquent-credential/v1";

/** ASCII "zq-cred/v1" as a field element. Must match CREDENTIAL_TAG() in credential.circom. */
export const CREDENTIAL_TAG = BigInt("578216463573960094610993");

/** ASCII "zq-daily/v1" as a field element. Public input `nullifierScope`, pinned by the server. */
export const NULLIFIER_SCOPE = "148023414742210737297389105";

/** How long the demo issuer's credentials last. */
export const DEMO_CREDENTIAL_DAYS = 365;

export const DEMO_ISSUER_NAME = "ZQUENT Demo Issuer (not a real KYC provider)";

const DAY_MS = 86_400_000;

/** Whole days since 1970-01-01 UTC. The circuit's `currentDay` and `expiryDay` use this. */
export function epochDay(now: Date = new Date()): number {
  return Math.floor(now.getTime() / DAY_MS);
}

export interface Credential {
  format: typeof CREDENTIAL_FORMAT;
  issuer: { name: string; publicKey: PointStr; demo: boolean };
  subject: { idHash: string; birthYear: number; expiryDay: number };
  signature: { R8: PointStr; S: string };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let eddsaPromise: Promise<any> | null = null;
function getEddsa(): Promise<any> {
  if (!eddsaPromise) eddsaPromise = import("circomlibjs").then((m) => m.buildEddsa());
  return eddsaPromise;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function privateKeyBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("Issuer private key must be 32 bytes of hex.");
  }
  return Uint8Array.from(clean.match(/../g)!.map((b) => parseInt(b, 16)));
}

/** A fresh issuer private key, as 64 hex chars. Keep it secret. */
export function generateIssuerPrivateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issuerPublicKey(privateKeyHex: string): Promise<PointStr> {
  const eddsa = await getEddsa();
  const A = eddsa.prv2pub(privateKeyBytes(privateKeyHex));
  return [eddsa.F.toObject(A[0]).toString(), eddsa.F.toObject(A[1]).toString()];
}

/** Is this a usable issuer public key (in the prime subgroup, not the identity)? */
export async function isValidIssuerPublicKey(pk: PointStr): Promise<boolean> {
  try {
    const c = await getCrypto();
    const p = pt(pk);
    return !eq(p, [BigInt(0), BigInt(1)]) && inSubgroup(c, p);
  } catch {
    return false;
  }
}

/** The message the issuer signs. Mirrors `msg` in credential.circom. */
export async function credentialMessage(subject: Credential["subject"]): Promise<bigint> {
  const c = await getCrypto();
  return hash(c, [CREDENTIAL_TAG, BigInt(subject.idHash), BigInt(subject.birthYear), BigInt(subject.expiryDay)]);
}

export interface CredentialRequest {
  idHash: string;
  birthYear: number;
  /** Defaults to today + DEMO_CREDENTIAL_DAYS. */
  expiryDay?: number;
}

/** Field and range checks shared by the issuer and the circuit's range checks. */
export function credentialRequestError(req: Partial<CredentialRequest>, now: Date = new Date()): string | null {
  if (typeof req.idHash !== "string" || !/^\d{1,77}$/.test(req.idHash)) {
    return "idHash must be a decimal field element.";
  }
  const year = now.getUTCFullYear();
  if (!Number.isInteger(req.birthYear) || req.birthYear! < year - 150 || req.birthYear! > year) {
    return `birthYear must be a whole year between ${year - 150} and ${year}.`;
  }
  if (req.expiryDay !== undefined && (!Number.isInteger(req.expiryDay) || req.expiryDay < epochDay(now))) {
    return "expiryDay must be a whole day number, today or later.";
  }
  return null;
}

/** Sign a credential. Throws on bad input. */
export async function issueCredential(
  privateKeyHex: string,
  req: CredentialRequest,
  opts: { name?: string; demo?: boolean; now?: Date } = {}
): Promise<Credential> {
  const now = opts.now ?? new Date();
  const error = credentialRequestError(req, now);
  if (error) throw new Error(error);

  const subject = {
    idHash: BigInt(req.idHash).toString(),
    birthYear: req.birthYear,
    expiryDay: req.expiryDay ?? epochDay(now) + DEMO_CREDENTIAL_DAYS,
  };
  const eddsa = await getEddsa();
  const sig = eddsa.signPoseidon(privateKeyBytes(privateKeyHex), eddsa.F.e(await credentialMessage(subject)));
  return {
    format: CREDENTIAL_FORMAT,
    issuer: {
      name: opts.name ?? DEMO_ISSUER_NAME,
      publicKey: await issuerPublicKey(privateKeyHex),
      demo: opts.demo ?? true,
    },
    subject,
    signature: {
      R8: [eddsa.F.toObject(sig.R8[0]).toString(), eddsa.F.toObject(sig.R8[1]).toString()],
      S: sig.S.toString(),
    },
  };
}

/** Check a credential's signature (and optionally that it's from `expectedIssuer`) outside the circuit. */
export async function verifyCredential(cred: Credential, expectedIssuer?: PointStr): Promise<boolean> {
  try {
    if (cred.format !== CREDENTIAL_FORMAT) return false;
    if (expectedIssuer && !eq(pt(cred.issuer.publicKey), pt(expectedIssuer))) return false;
    if (!(await isValidIssuerPublicKey(cred.issuer.publicKey))) return false;
    const eddsa = await getEddsa();
    const F = eddsa.F;
    return eddsa.verifyPoseidon(
      F.e(await credentialMessage(cred.subject)),
      { R8: [F.e(BigInt(cred.signature.R8[0])), F.e(BigInt(cred.signature.R8[1]))], S: BigInt(cred.signature.S) },
      [F.e(BigInt(cred.issuer.publicKey[0])), F.e(BigInt(cred.issuer.publicKey[1]))]
    );
  } catch {
    return false;
  }
}

/** Poseidon(idHash, scope, day). Mirrors `nullHash` in credential.circom. */
export async function computeNullifier(idHash: string, day: number, scope: string = NULLIFIER_SCOPE): Promise<string> {
  const c = await getCrypto();
  return hash(c, [BigInt(idHash), BigInt(scope), BigInt(day)]).toString();
}

/** The credential's private circuit inputs. */
export function credentialWitness(cred: Credential) {
  return {
    expiryDay: cred.subject.expiryDay,
    sigR8: cred.signature.R8,
    sigS: cred.signature.S,
  };
}
