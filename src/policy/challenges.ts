/**
 * Proof challenges — binds every ZK proof to one specific payment.
 *
 * POST /api/v1/payment issues a random `txNonce` when a payment needs a proof
 * and remembers which payment it was for. The nonce is a public input of both
 * circuits, so a proof is only valid for the nonce it was generated with.
 * POST /api/v1/verify-proof consumes the nonce atomically before verifying:
 *
 *   - a proof can't be replayed (the nonce is gone after first use)
 *   - a proof for one payment can't approve another (amount/recipient must match)
 *   - one agent's challenge can't be used by another (keys are per agent)
 *   - stale challenges expire
 */

import { kv } from "@/lib/kv";

/** Long enough for slow in-browser proving; short enough that a leaked nonce is useless soon. */
export const CHALLENGE_TTL_SECONDS = 10 * 60;

export interface ChallengedPayment {
  amount: number;
  recipient: string;
  chainId?: string;
  issuedAt: string;
}

const key = (agentId: string, nonce: string) => `challenge:${agentId}:${nonce}`;

/** Random BN254 field element (248 bits, always below the field prime) as a decimal string. */
function randomNonce(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return BigInt("0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")).toString();
}

export async function issueChallenge(
  agentId: string,
  payment: Omit<ChallengedPayment, "issuedAt">
): Promise<string> {
  const nonce = randomNonce();
  const record: ChallengedPayment = {
    amount: payment.amount,
    recipient: payment.recipient,
    ...(payment.chainId ? { chainId: payment.chainId } : {}),
    issuedAt: new Date().toISOString(),
  };
  await kv().set(key(agentId, nonce), record, { ex: CHALLENGE_TTL_SECONDS });
  return nonce;
}

export type ChallengeResult =
  | { ok: true; payment: ChallengedPayment }
  | { ok: false; error: string };

/**
 * Single use: the nonce is deleted whether or not the payment details match,
 * so a failed attempt can't be retried against the same challenge.
 */
export async function consumeChallenge(
  agentId: string,
  nonce: string | undefined,
  submitted: { amount: number; recipient: string; chainId?: string }
): Promise<ChallengeResult> {
  if (!nonce || !/^\d{1,78}$/.test(nonce)) {
    return { ok: false, error: "Proof is missing a valid txNonce." };
  }
  const payment = await kv().getdel<ChallengedPayment>(key(agentId, nonce));
  if (!payment) {
    return { ok: false, error: "Challenge expired or already used. Request a new one from /api/v1/payment." };
  }
  if (
    payment.amount !== submitted.amount ||
    payment.recipient !== submitted.recipient ||
    (payment.chainId ?? undefined) !== (submitted.chainId ?? undefined)
  ) {
    return { ok: false, error: "Payment details don't match the challenge this proof was made for." };
  }
  return { ok: true, payment };
}
