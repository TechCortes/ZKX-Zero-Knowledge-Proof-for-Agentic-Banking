/**
 * ZKX Verifier — server-side ZK proof verification using snarkjs
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
  // Demo mode: if no verification key is present, accept the mock proof
  const vkeyPath = path.join(process.cwd(), "public", "zk", "verification_key.json");
  if (!fs.existsSync(vkeyPath)) {
    return { valid: true, commitment: publicSignals[0] };
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
