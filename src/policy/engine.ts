/**
 * ZKX Policy Engine — OWS Compliance Middleware
 *
 * Enforces the rule:
 *   - Daily spend < $1,000  → anonymous micropayments, no KYC required
 *   - Daily spend >= $1,000 → valid ZK proof of identity required
 */

export interface PaymentRequest {
  agentId: string;
  amount: number; // USD
  recipient: string;
  memo?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresKYC: boolean;
  dailyTotal: number;
  remainingAnonymous: number;
  reason: string;
}

export interface ProofSubmission {
  proof: object;
  publicSignals: string[];
}

// In-memory daily spend tracker (keyed by agentId + UTC date)
const spendLedger = new Map<string, number>();

function ledgerKey(agentId: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return `${agentId}::${today}`;
}

export function getDailySpend(agentId: string): number {
  return spendLedger.get(ledgerKey(agentId)) ?? 0;
}

export function recordSpend(agentId: string, amount: number): number {
  const key = ledgerKey(agentId);
  const current = spendLedger.get(key) ?? 0;
  const updated = current + amount;
  spendLedger.set(key, updated);
  return updated;
}

export const DAILY_ANONYMOUS_LIMIT = 1_000; // USD

/**
 * Evaluate whether a payment can proceed and whether KYC is needed.
 * Does NOT record the spend — call recordSpend() after payment is confirmed.
 */
export function evaluatePayment(request: PaymentRequest): PolicyDecision {
  const daily = getDailySpend(request.agentId);
  const projectedTotal = daily + request.amount;
  const remaining = Math.max(0, DAILY_ANONYMOUS_LIMIT - daily);

  if (projectedTotal < DAILY_ANONYMOUS_LIMIT) {
    return {
      allowed: true,
      requiresKYC: false,
      dailyTotal: daily,
      remainingAnonymous: remaining,
      reason: "Below daily anonymous limit — payment approved.",
    };
  }

  return {
    allowed: false,
    requiresKYC: true,
    dailyTotal: daily,
    remainingAnonymous: remaining,
    reason: `Daily spend would reach $${projectedTotal.toLocaleString()} — ZK proof of identity required above $${DAILY_ANONYMOUS_LIMIT.toLocaleString()}/day.`,
  };
}

/**
 * After a valid ZK proof is verified, approve the payment and record spend.
 */
export function approveWithProof(request: PaymentRequest): PolicyDecision {
  const daily = recordSpend(request.agentId, request.amount);
  return {
    allowed: true,
    requiresKYC: false,
    dailyTotal: daily,
    remainingAnonymous: 0,
    reason: "ZK proof verified — identity confirmed without disclosure. Payment approved.",
  };
}
