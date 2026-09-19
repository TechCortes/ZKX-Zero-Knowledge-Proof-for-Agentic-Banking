/**
 * Vero Protocol Verifier — server-side ZK proof verification using snarkjs
 *
 * Runs in the Next.js API route. Verifies Groth16 proofs against
 * the compiled verification key.
 */

import path from "path";
import fs from "fs";

export interface VerificationResult {
  valid: boolean;
  commitment?: string;
  error?: string;
}

/** Age requirement the server enforces; must match the challenge issued by /api/v1/payment. */
export const REQUIRED_MIN_AGE = 18;

/**
 * The circuit's public signals are [commitment, currentYear, minAge]. A Groth16 proof is
 * only valid *for the public inputs the prover chose*, so the server must pin them —
 * otherwise a prover could pick minAge=0 (or a fake currentYear) and still verify.
 * Returns an error message, or null if the signals match the server's challenge.
 */
export function checkChallengeSignals(
  publicSignals: string[],
  now: Date = new Date()
): string | null {
  if (publicSignals.length !== 3) {
    return "Unexpected public signals: expected [commitment, currentYear, minAge].";
  }
  const year = now.getUTCFullYear();
  const [, proofYear, proofMinAge] = publicSignals;
  // Accept the prior year too so a proof generated just before New Year UTC isn't rejected;
  // an earlier year only makes the age check stricter for the prover.
  if (proofYear !== String(year) && proofYear !== String(year - 1)) {
    return "Proof currentYear does not match the server's challenge.";
  }
  if (proofMinAge !== String(REQUIRED_MIN_AGE)) {
    return `Proof minAge must be ${REQUIRED_MIN_AGE}.`;
  }
  return null;
}

let cachedVKey: object | null = null;

function getVerificationKey(): object {
  if (cachedVKey) return cachedVKey;

  const vkeyPath = path.join(process.cwd(), "public", "zk", "verification_key.json");

  if (!fs.existsSync(vkeyPath)) {
    throw new Error(
      "Verification key not found. Run `npm run setup-zk` to generate circuit artifacts."
    );
  }

  cachedVKey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));
  return cachedVKey!;
}

export async function verifyKYCProof(
  proof: object,
  publicSignals: string[]
): Promise<VerificationResult> {
  // Fail closed: without a verification key there is no basis to trust a proof.
  const vkeyPath = path.join(process.cwd(), "public", "zk", "verification_key.json");
  if (!fs.existsSync(vkeyPath)) {
    return {
      valid: false,
      error: "Verification key not found — server is not configured to verify proofs. Run `npm run setup-zk`.",
    };
  }

  const signalError = checkChallengeSignals(publicSignals);
  if (signalError) {
    return { valid: false, error: signalError };
  }

  try {
    const snarkjs = await import("snarkjs");
    const vkey = getVerificationKey();

    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    if (!valid) {
      return { valid: false, error: "Proof verification failed." };
    }

    return { valid: true, commitment: publicSignals[0] };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown verification error.",
    };
  }
}
