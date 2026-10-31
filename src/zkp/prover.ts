/**
 * Vero Protocol Prover — client-side ZK proof generation using snarkjs
 *
 * The circuit proves:
 *   1. I know a preimage (idHash, salt) that hashes to `commitment`
 *   2. currentYear - birthYear >= minAge
 *
 * The user's idHash, birthYear, and salt never leave the browser in the clear.
 * If the server's challenge includes a reveal key (threshold reveal, ROADMAP phase 2),
 * the kyc_reveal circuit is used instead: same proof, plus the identity encrypted
 * to the consortium key so k-of-n members can decrypt it under legal process.
 */

export interface IdentitySecret {
  idHash: string;    // Poseidon hash of government ID (as BigInt string)
  birthYear: number;
  salt: string;      // random BigInt string
}

export interface ProofInput {
  // Private
  idHash: string;
  birthYear: number;
  salt: string;
  // Public
  commitment: string;
  currentYear: number;
  minAge: number;
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

/** `challenge.reveal` from a 402 /api/v1/payment response, when the server requires reveal. */
export interface RevealChallenge {
  publicKey: [string, string];
}

/**
 * Generate a ZK proof of KYC credential in the browser.
 *
 * @param secret  - The user's private identity data (stays in browser)
 * @param commitment - The public commitment stored on-chain / with verifier
 * @param minAge  - Age requirement (default 18)
 * @param reveal  - Pass the challenge's `reveal` field through untouched; omit when absent
 */
export async function generateKYCProof(
  secret: IdentitySecret,
  commitment: string,
  minAge = 18,
  reveal?: RevealChallenge | null
): Promise<ZKProof> {
  const snarkjs = await import("snarkjs");

  const base: ProofInput = {
    idHash: secret.idHash,
    birthYear: secret.birthYear,
    salt: secret.salt,
    commitment,
    currentYear: new Date().getUTCFullYear(),
    minAge,
  };

  let input: Record<string, unknown> = { ...base };
  let circuit = "kyc_credential";
  if (reveal) {
    const { randomRevealNonce } = await import("./reveal");
    // Fresh per proof: reusing the nonce would make two ciphertexts linkable.
    input = { ...base, revealNonce: await randomRevealNonce(), revealPubKey: reveal.publicKey };
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
