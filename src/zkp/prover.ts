/**
 * ZKX Prover — client-side ZK proof generation using snarkjs
 *
 * The circuit proves:
 *   1. I know a preimage (idHash, salt) that hashes to `commitment`
 *   2. currentYear - birthYear >= minAge
 *
 * The user's idHash, birthYear, and salt never leave the browser.
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

/**
 * Generate a ZK proof of KYC credential in the browser.
 *
 * @param secret  - The user's private identity data (stays in browser)
 * @param commitment - The public commitment stored on-chain / with verifier
 * @param minAge  - Age requirement (default 18)
 */
export async function generateKYCProof(
  secret: IdentitySecret,
  commitment: string,
  minAge = 18
): Promise<ZKProof> {
  const snarkjs = await import("snarkjs");

  const input: ProofInput = {
    idHash: secret.idHash,
    birthYear: secret.birthYear,
    salt: secret.salt,
    commitment,
    currentYear: new Date().getUTCFullYear(),
    minAge,
  };

  // Wasm and zkey are served from /public/zk/
  const wasmPath = "/zk/kyc_credential.wasm";
  const zkeyPath = "/zk/kyc_credential_final.zkey";

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
