/**
 * ZQUENT Prover — client-side ZK proof generation using snarkjs
 *
 * The circuit proves, without revealing any of it:
 *   1. I know (idHash, salt) that hash to `commitment`
 *   2. an issuer signed my (idHash, birthYear, expiryDay), and it hasn't expired
 *   3. currentYear - birthYear >= minAge
 * and outputs a per-person daily nullifier. See docs/credentials.md.
 *
 * The user's idHash, birthYear, salt and credential never leave the browser in the clear.
 * If the server's challenge includes a reveal key (threshold reveal, ROADMAP phase 2),
 * the kyc_reveal circuit is used instead: same proof, plus the identity encrypted
 * to the consortium key so k-of-n members can decrypt it under legal process.
 */

import type { Credential } from "./credential";

export interface IdentitySecret {
  idHash: string;    // Poseidon hash of government ID (as BigInt string)
  birthYear: number;
  salt: string;      // random BigInt string
}

export interface ZKProof {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

/** A random BN128-scalar-field element, as a decimal string (248-bit, always < the field prime). */
export function randomFieldElement(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return BigInt(
    "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  ).toString();
}

/** `challenge` from a 402 /api/v1/payment response. Pass it through untouched. */
export interface ProofChallenge {
  currentYear: number;
  minAge: number;
  commitment: string;
  txNonce: string;
  credential: { issuerPublicKey: [string, string]; currentDay: number; nullifierScope: string };
  /** Present when the server requires threshold reveal. */
  reveal?: { publicKey: [string, string] } | null;
}

/**
 * Generate a ZK proof of KYC credential in the browser.
 *
 * @param secret     - The user's private identity data (stays in browser)
 * @param credential - The issuer-signed credential for that identity (stays in browser)
 * @param challenge  - The server's challenge for this one payment
 */
export async function generateKYCProof(
  secret: IdentitySecret,
  credential: Credential,
  challenge: ProofChallenge
): Promise<ZKProof> {
  const snarkjs = await import("snarkjs");
  const { credentialWitness } = await import("./credential");

  if (credential.subject.idHash !== secret.idHash || credential.subject.birthYear !== secret.birthYear) {
    throw new Error("This credential was issued for a different identity.");
  }
  const [ix, iy] = challenge.credential.issuerPublicKey;
  if (credential.issuer.publicKey[0] !== ix || credential.issuer.publicKey[1] !== iy) {
    throw new Error("This credential is from a different issuer than the one the server accepts.");
  }
  if (credential.subject.expiryDay < challenge.credential.currentDay) {
    throw new Error("This credential has expired. Get a new one from the issuer.");
  }

  let input: Record<string, unknown> = {
    idHash: secret.idHash,
    birthYear: secret.birthYear,
    salt: secret.salt,
    ...credentialWitness(credential),
    commitment: challenge.commitment,
    currentYear: challenge.currentYear,
    minAge: challenge.minAge,
    txNonce: challenge.txNonce,
    issuerPubKey: challenge.credential.issuerPublicKey,
    currentDay: challenge.credential.currentDay,
    nullifierScope: challenge.credential.nullifierScope,
  };
  let circuit = "kyc_credential";
  if (challenge.reveal) {
    const { randomRevealNonce } = await import("./reveal");
    // Fresh per proof: reusing the nonce would make two ciphertexts linkable.
    input = { ...input, revealNonce: await randomRevealNonce(), revealPubKey: challenge.reveal.publicKey };
    circuit = "kyc_reveal";
  }

  // Wasm and zkey are served from /public/zk/
  const wasmPath = `/zk/${circuit}.wasm`;
  const zkeyPath = `/zk/${circuit}_final.zkey`;

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  return { proof, publicSignals };
}

/**
 * Ask the server's demo issuer to sign this identity. Only idHash and birthYear are
 * sent (never the salt). A real deployment gets this from a KYC provider instead.
 */
export async function requestDemoCredential(secret: IdentitySecret): Promise<Credential> {
  const res = await fetch("/api/v1/credentials/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idHash: secret.idHash, birthYear: secret.birthYear }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.credential) {
    throw new Error(data.error ?? `Credential issuer returned ${res.status}.`);
  }
  return data.credential as Credential;
}

/**
 * Derive the Poseidon commitment from a user's identity secret.
 * Run this once during onboarding to register the commitment.
 */
export async function deriveCommitment(secret: IdentitySecret): Promise<string> {
  // Dynamic import so this only loads when needed
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();

  const hash = poseidon([BigInt(secret.idHash), BigInt(secret.salt)]);
  return poseidon.F.toString(hash);
}
