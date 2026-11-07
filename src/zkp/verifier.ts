/**
 * ZQUENT Verifier — server-side ZK proof verification using snarkjs
 *
 * Runs in the Next.js API route. Verifies Groth16 proofs against
 * the compiled verification key.
 *
 * Two circuits, both checking an issuer-signed credential (docs/credentials.md):
 *   - kyc_credential : the default. Commitment, issuer signature, age, expiry,
 *                      daily nullifier.
 *   - kyc_reveal     : opt-in (ZQUENT_REVEAL_PUBLIC_KEY set). Same proof, plus a
 *                      ciphertext of the identity encrypted to the consortium key.
 *                      See src/zkp/reveal.ts and docs/threshold-reveal.md.
 */

import path from "path";
import fs from "fs";
import { REVEAL_SIGNALS, ciphertextFromSignals, type RevealCiphertext } from "./reveal";
import { NULLIFIER_SCOPE, epochDay } from "./credential";

export interface VerificationResult {
  valid: boolean;
  commitment?: string;
  /** The server challenge this proof is bound to. Consume it before trusting the proof. */
  txNonce?: string;
  /** Same for one person on one day, across all their agents. Use it for per-person caps. */
  nullifier?: string;
  /** Present only for a valid kyc_reveal proof. Store it next to the commitment. */
  revealCiphertext?: RevealCiphertext;
  error?: string;
}

/** Age requirement the server enforces; must match the challenge issued by /api/v1/payment. */
export const REQUIRED_MIN_AGE = 18;

type PublicKey = [string, string];

/**
 * Where each circuit puts its public signals. kyc_credential:
 * [nullifier, commitment, currentYear, minAge, txNonce, issuer.x, issuer.y, currentDay, nullifierScope]
 */
const LAYOUT = {
  kyc_credential: {
    count: 9, nullifier: 0, commitment: 1, currentYear: 2, minAge: 3, txNonce: 4,
    issuer: [5, 6], currentDay: 7, nullifierScope: 8,
  },
  kyc_reveal: REVEAL_SIGNALS,
} as const;

const VKEY_FILE = {
  kyc_credential: "verification_key.json",
  kyc_reveal: "kyc_reveal_verification_key.json",
} as const;

type Circuit = keyof typeof LAYOUT;

const circuitFor = (revealKey?: PublicKey | null): Circuit => (revealKey ? "kyc_reveal" : "kyc_credential");

/** The commitment a proof claims, read from the right slot for the active circuit. */
export function commitmentFromSignals(publicSignals: string[], revealKey?: PublicKey | null): string | undefined {
  return publicSignals[LAYOUT[circuitFor(revealKey)].commitment];
}

/** The txNonce a proof was generated for (see src/policy/challenges.ts). */
export function txNonceFromSignals(publicSignals: string[], revealKey?: PublicKey | null): string | undefined {
  const layout = LAYOUT[circuitFor(revealKey)];
  return publicSignals.length === layout.count ? publicSignals[layout.txNonce] : undefined;
}

export interface ChallengeExpectations {
  /** The pinned credential issuer. Without one, no proof is accepted. */
  issuerKey: PublicKey | null;
  revealKey?: PublicKey | null;
  /** The day the challenge was issued for. Without it, today or yesterday (UTC) is accepted. */
  currentDay?: number;
  now?: Date;
}

/**
 * A Groth16 proof is only valid *for the public inputs the prover chose*, so the server must
 * pin them — otherwise a prover could pick minAge=0 (or a fake currentYear) and still verify.
 * The issuer key is pinned the same way: a prover who could pick it would sign their own
 * credential. With reveal on, the consortium key is pinned too: a prover who could pick
 * their own key could encrypt to themselves and the ciphertext would be useless.
 * Returns an error message, or null if the signals match the server's challenge.
 */
export function checkChallengeSignals(publicSignals: string[], expect: ChallengeExpectations): string | null {
  const now = expect.now ?? new Date();
  const revealKey = expect.revealKey ?? null;
  const circuit = circuitFor(revealKey);
  const layout = LAYOUT[circuit];
  if (publicSignals.length !== layout.count) {
    return circuit === "kyc_reveal"
      ? "Threshold reveal is required: expected a kyc_reveal proof with an issuer-signed credential."
      : "Unexpected public signals: expected a kyc_credential proof with an issuer-signed credential.";
  }
  if (!expect.issuerKey) {
    return "No credential issuer is configured, so no proof can be accepted.";
  }
  const year = now.getUTCFullYear();
  const proofYear = publicSignals[layout.currentYear];
  // Accept the prior year too so a proof generated just before New Year UTC isn't rejected;
  // an earlier year only makes the age check stricter for the prover.
  if (proofYear !== String(year) && proofYear !== String(year - 1)) {
    return "Proof currentYear does not match the server's challenge.";
  }
  if (publicSignals[layout.minAge] !== String(REQUIRED_MIN_AGE)) {
    return `Proof minAge must be ${REQUIRED_MIN_AGE}.`;
  }
  const [ix, iy] = layout.issuer;
  if (publicSignals[ix] !== expect.issuerKey[0] || publicSignals[iy] !== expect.issuerKey[1]) {
    return "Proof credential was not signed by the configured issuer.";
  }
  // The nullifier is per day, so the day must be one the server chose. Otherwise a
  // prover could pick any day and get a fresh nullifier for every payment.
  const day = publicSignals[layout.currentDay];
  const today = epochDay(now);
  const allowed = expect.currentDay !== undefined ? [expect.currentDay] : [today, today - 1];
  if (!allowed.map(String).includes(day)) {
    return "Proof currentDay does not match the server's challenge.";
  }
  if (publicSignals[layout.nullifierScope] !== NULLIFIER_SCOPE) {
    return "Proof nullifierScope does not match this server.";
  }
  if (revealKey) {
    const [px, py] = REVEAL_SIGNALS.publicKey;
    if (publicSignals[px] !== revealKey[0] || publicSignals[py] !== revealKey[1]) {
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
  expect: ChallengeExpectations
): Promise<VerificationResult> {
  const revealKey = expect.revealKey ?? null;
  const circuit = circuitFor(revealKey);

  // Fail closed: without a verification key there is no basis to trust a proof.
  if (!fs.existsSync(vkeyPath(circuit))) {
    return {
      valid: false,
      error:
        circuit === "kyc_reveal"
          ? "Threshold reveal is configured but the kyc_reveal verification key is missing. See docs/ceremony.md."
          : "Verification key not found — server is not configured to verify proofs. See docs/ceremony.md.",
    };
  }

  const signalError = checkChallengeSignals(publicSignals, expect);
  if (signalError) {
    return { valid: false, error: signalError };
  }

  try {
    const snarkjs = await import("snarkjs");
    const valid = await snarkjs.groth16.verify(getVerificationKey(circuit), publicSignals, proof);

    if (!valid) {
      return { valid: false, error: "Proof verification failed." };
    }

    const layout = LAYOUT[circuit];
    const result: VerificationResult = {
      valid: true,
      commitment: publicSignals[layout.commitment],
      txNonce: publicSignals[layout.txNonce],
      nullifier: publicSignals[layout.nullifier],
    };
    if (revealKey) result.revealCiphertext = ciphertextFromSignals(publicSignals);
    return result;
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown verification error.",
    };
  }
}
