/**
 * Vero Protocol Verifier — server-side ZK proof verification using snarkjs
 *
 * Runs in the Next.js API route. Verifies Groth16 proofs against
 * the compiled verification key.
 *
 * Two circuits:
 *   - kyc_credential : the default. Proves commitment + age, nothing else.
 *   - kyc_reveal     : opt-in (VERO_REVEAL_PUBLIC_KEY set). Same proof, plus a
 *                      ciphertext of the identity encrypted to the consortium key.
 *                      See src/zkp/reveal.ts and docs/threshold-reveal.md.
 */

import path from "path";
import fs from "fs";
import { REVEAL_SIGNALS, ciphertextFromSignals, type RevealCiphertext } from "./reveal";

export interface VerificationResult {
  valid: boolean;
  commitment?: string;
  /** Present only for a valid kyc_reveal proof. Store it next to the commitment. */
  revealCiphertext?: RevealCiphertext;
  error?: string;
}

/** Age requirement the server enforces; must match the challenge issued by /api/v1/payment. */
export const REQUIRED_MIN_AGE = 18;

type RevealPublicKey = [string, string];

/** Where each circuit puts its public signals. */
const LAYOUT = {
  kyc_credential: { count: 3, commitment: 0, currentYear: 1, minAge: 2 },
  kyc_reveal: REVEAL_SIGNALS,
} as const;

const VKEY_FILE = {
  kyc_credential: "verification_key.json",
  kyc_reveal: "kyc_reveal_verification_key.json",
} as const;

type Circuit = keyof typeof LAYOUT;

const circuitFor = (revealKey?: RevealPublicKey | null): Circuit => (revealKey ? "kyc_reveal" : "kyc_credential");

/** The commitment a proof claims, read from the right slot for the active circuit. */
export function commitmentFromSignals(publicSignals: string[], revealKey?: RevealPublicKey | null): string | undefined {
  return publicSignals[LAYOUT[circuitFor(revealKey)].commitment];
}

/**
 * A Groth16 proof is only valid *for the public inputs the prover chose*, so the server must
 * pin them — otherwise a prover could pick minAge=0 (or a fake currentYear) and still verify.
 * With reveal on, the consortium key is pinned the same way: a prover who could pick their
 * own key could encrypt to themselves and the ciphertext would be useless.
 * Returns an error message, or null if the signals match the server's challenge.
 */
export function checkChallengeSignals(
  publicSignals: string[],
  now: Date = new Date(),
  revealKey?: RevealPublicKey | null
): string | null {
  const circuit = circuitFor(revealKey);
  const layout = LAYOUT[circuit];
  if (publicSignals.length !== layout.count) {
    return circuit === "kyc_reveal"
      ? "Threshold reveal is required: expected a kyc_reveal proof."
      : "Unexpected public signals: expected [commitment, currentYear, minAge].";
  }
  const year = now.getUTCFullYear();
  const proofYear = publicSignals[layout.currentYear];
  const proofMinAge = publicSignals[layout.minAge];
  // Accept the prior year too so a proof generated just before New Year UTC isn't rejected;
  // an earlier year only makes the age check stricter for the prover.
  if (proofYear !== String(year) && proofYear !== String(year - 1)) {
    return "Proof currentYear does not match the server's challenge.";
  }
  if (proofMinAge !== String(REQUIRED_MIN_AGE)) {
    return `Proof minAge must be ${REQUIRED_MIN_AGE}.`;
  }
  if (revealKey) {
    const [ix, iy] = REVEAL_SIGNALS.publicKey;
    if (publicSignals[ix] !== revealKey[0] || publicSignals[iy] !== revealKey[1]) {
      return "Proof was not encrypted to the configured reveal consortium key.";
    }
  }
  return null;
}

const vkeyPath = (circuit: Circuit) => path.join(process.cwd(), "public", "zk", VKEY_FILE[circuit]);
const cachedVKeys: Partial<Record<Circuit, object>> = {};

function getVerificationKey(circuit: Circuit): object {
  if (!cachedVKeys[circuit]) {
    cachedVKeys[circuit] = JSON.parse(fs.readFileSync(vkeyPath(circuit), "utf-8"));
  }
  return cachedVKeys[circuit]!;
}

export async function verifyKYCProof(
  proof: object,
  publicSignals: string[],
  options: { revealPublicKey?: RevealPublicKey | null } = {}
): Promise<VerificationResult> {
  const revealKey = options.revealPublicKey ?? null;
  const circuit = circuitFor(revealKey);

  // Fail closed: without a verification key there is no basis to trust a proof.
  if (!fs.existsSync(vkeyPath(circuit))) {
    return {
      valid: false,
      error:
        circuit === "kyc_reveal"
          ? "Threshold reveal is configured but the kyc_reveal verification key is missing. Run `npm run setup-zk:reveal`."
          : "Verification key not found — server is not configured to verify proofs. Run `npm run setup-zk`.",
    };
  }

  const signalError = checkChallengeSignals(publicSignals, new Date(), revealKey);
  if (signalError) {
    return { valid: false, error: signalError };
  }

  try {
    const snarkjs = await import("snarkjs");
    const valid = await snarkjs.groth16.verify(getVerificationKey(circuit), publicSignals, proof);

    if (!valid) {
      return { valid: false, error: "Proof verification failed." };
    }

    const commitment = publicSignals[LAYOUT[circuit].commitment];
    return revealKey
      ? { valid: true, commitment, revealCiphertext: ciphertextFromSignals(publicSignals) }
      : { valid: true, commitment };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown verification error.",
    };
  }
}
