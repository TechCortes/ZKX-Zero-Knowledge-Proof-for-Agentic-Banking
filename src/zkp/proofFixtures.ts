/**
 * Test helpers: a holder identity, an issuer, a credential, and real proofs
 * for either circuit. Used by the circuit tests only; nothing in the app imports it.
 */

import path from "path";
import { getCrypto, hash, type PointStr } from "./babyjub";
import {
  NULLIFIER_SCOPE,
  credentialWitness,
  epochDay,
  generateIssuerPrivateKey,
  issueCredential,
  type Credential,
} from "./credential";
import { randomRevealNonce } from "./reveal";

export const ZK_DIR = path.join(process.cwd(), "public", "zk");
export const YEAR = new Date().getUTCFullYear();
export const TODAY = epochDay();

export interface Identity {
  idHash: string;
  birthYear: number;
  salt: string;
  commitment: string;
}

export async function makeIdentity(idHash = "123456789", salt = "987654321", birthYear = YEAR - 30): Promise<Identity> {
  const c = await getCrypto();
  return { idHash, salt, birthYear, commitment: hash(c, [BigInt(idHash), BigInt(salt)]).toString() };
}

export async function makeIssuer() {
  const privateKey = generateIssuerPrivateKey();
  const sample = await issueCredential(privateKey, { idHash: "1", birthYear: 2000 });
  return { privateKey, publicKey: sample.issuer.publicKey as PointStr };
}

export function credentialFor(issuerKey: string, who: Identity, expiryDay?: number): Promise<Credential> {
  return issueCredential(issuerKey, { idHash: who.idHash, birthYear: who.birthYear, expiryDay });
}

/** Circuit inputs for an honest proof; override anything to build an attack. */
export function proofInput(who: Identity, cred: Credential, overrides: Record<string, unknown> = {}) {
  return {
    idHash: who.idHash,
    birthYear: who.birthYear,
    salt: who.salt,
    ...credentialWitness(cred),
    commitment: who.commitment,
    currentYear: YEAR,
    minAge: 18,
    txNonce: "424242",
    issuerPubKey: cred.issuer.publicKey,
    currentDay: TODAY,
    nullifierScope: NULLIFIER_SCOPE,
    ...overrides,
  };
}

export async function prove(
  circuit: "kyc_credential" | "kyc_reveal",
  input: Record<string, unknown>,
  revealPubKey?: PointStr
) {
  const snarkjs = await import("snarkjs");
  const full = circuit === "kyc_reveal" ? { ...input, revealNonce: await randomRevealNonce(), revealPubKey } : input;
  return snarkjs.groth16.fullProve(
    full,
    path.join(ZK_DIR, `${circuit}.wasm`),
    path.join(ZK_DIR, `${circuit}_final.zkey`)
  );
}
