/**
 * Vero Protocol Policy Engine — OWS Compliance Middleware
 *
 * Enforces the rule:
 *   - Daily spend < $1,000  → anonymous micropayments, no KYC required
 *   - Daily spend >= $1,000 → valid ZK proof of identity required
 *
 * Policy rules follow the Open Wallet Standard typed-rule format:
 *   allowed_chains, expires_at, spending_limit
 */

import { createHash } from "crypto";
import { OWSErrorCode } from "@/lib/ows-errors";
import { kv } from "@/lib/kv";

// --- OWS policy rule types ---

export type PolicyRuleType = "allowed_chains" | "expires_at" | "spending_limit";

export interface PolicyRule {
  type: PolicyRuleType;
  /** chains: string[]; expires_at: ISO-8601 string; spending_limit: number (USD) */
  value: string | string[] | number;
}

export interface PolicyContext {
  chainId?: string;
  agentId: string;
  timestamp: string; // ISO-8601
  spending: { dailyTotal: number; date: string };
}

export interface RuleEvalResult {
  denied: boolean;
  reason?: string;
  errorCode?: OWSErrorCode;
}

/**
 * Evaluate OWS-style typed rules against a request context.
 * All rules use AND semantics — one denial blocks the operation.
 */
export function evaluateRules(rules: PolicyRule[], context: PolicyContext): RuleEvalResult {
  for (const rule of rules) {
    if (rule.type === "allowed_chains") {
      const allowed = rule.value as string[];
      if (context.chainId && !allowed.includes(context.chainId)) {
        return {
          denied: true,
          reason: `Chain '${context.chainId}' is not permitted by policy. Allowed: ${allowed.join(", ")}.`,
          errorCode: OWSErrorCode.CHAIN_NOT_SUPPORTED,
        };
      }
    }

    if (rule.type === "expires_at") {
      if (new Date() > new Date(rule.value as string)) {
        return {
          denied: true,
          reason: "Agent API key has expired.",
          errorCode: OWSErrorCode.API_KEY_EXPIRED,
        };
      }
    }

    if (rule.type === "spending_limit") {
      const limit = rule.value as number;
      if (context.spending.dailyTotal >= limit) {
        return {
          denied: true,
          reason: `Daily spend of $${context.spending.dailyTotal.toLocaleString()} has reached the policy limit of $${limit.toLocaleString()}.`,
          errorCode: OWSErrorCode.POLICY_DENIED,
        };
      }
    }
  }
  return { denied: false };
}

// --- Core request/decision types ---

export interface PaymentRequest {
  agentId: string;
  amount: number; // USD
  recipient: string;
  memo?: string;
  chainId?: string; // CAIP-2 identifier (e.g. "eip155:1", "solana:mainnet")
}

export interface PolicyDecision {
  allowed: boolean;
  requiresKYC: boolean;
  dailyTotal: number;
  remainingAnonymous: number;
  reason: string;
  errorCode?: OWSErrorCode;
  policyContext?: Pick<PolicyContext, "chainId" | "timestamp" | "spending">;
}

export interface ProofSubmission {
  proof: object;
  publicSignals: string[];
}

// Daily spend tracker (keyed by agentId + UTC date) — shared across serverless instances.
const LEDGER_TTL_SECONDS = 60 * 60 * 48; // 48h: outlives the UTC day boundary, then cleans up

function ledgerKey(agentId: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return `spend:${agentId}::${today}`;
}

export async function getDailySpend(agentId: string): Promise<number> {
  return (await kv().get<number>(ledgerKey(agentId))) ?? 0;
}

export async function recordSpend(agentId: string, amount: number): Promise<number> {
  return kv().incrby(ledgerKey(agentId), amount, { ex: LEDGER_TTL_SECONDS });
}

export const DAILY_ANONYMOUS_LIMIT = 1_000; // USD

/**
 * Hash of the effective policy config (the global threshold + this agent's
 * typed rules) at decision time. Lets an audit record be replayed against
 * the exact policy that was active when it was written, even if the
 * threshold or rules change later. Not a security boundary — a versioning
 * fingerprint for compliance replay.
 */
export function computePolicyVersionHash(rules: PolicyRule[] = []): string {
  const canonical = JSON.stringify({
    dailyAnonymousLimit: DAILY_ANONYMOUS_LIMIT,
    rules: [...rules].sort((a, b) => a.type.localeCompare(b.type)),
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/**
 * Evaluate whether a payment can proceed and whether KYC is needed.
 * Optionally evaluates OWS policy rules (allowed_chains, expires_at, etc.)
 * Does NOT record the spend — call recordSpend() after payment is confirmed.
 */
export async function evaluatePayment(
  request: PaymentRequest,
  rules: PolicyRule[] = []
): Promise<PolicyDecision> {
  const daily = await getDailySpend(request.agentId);
  const projectedTotal = daily + request.amount;
  const remaining = Math.max(0, DAILY_ANONYMOUS_LIMIT - daily);
  const context: PolicyContext = {
    chainId: request.chainId,
    agentId: request.agentId,
    timestamp: new Date().toISOString(),
    spending: { dailyTotal: daily, date: new Date().toISOString().slice(0, 10) },
  };

  // OWS rule evaluation — AND semantics
  if (rules.length > 0) {
    const ruleResult = evaluateRules(rules, context);
    if (ruleResult.denied) {
      return {
        allowed: false,
        requiresKYC: false,
        dailyTotal: daily,
        remainingAnonymous: remaining,
        reason: ruleResult.reason!,
        errorCode: ruleResult.errorCode,
        policyContext: { chainId: context.chainId, timestamp: context.timestamp, spending: context.spending },
      };
    }
  }

  if (projectedTotal < DAILY_ANONYMOUS_LIMIT) {
    return {
      allowed: true,
      requiresKYC: false,
      dailyTotal: daily,
      remainingAnonymous: remaining,
      reason: "Below daily anonymous limit — payment approved.",
      policyContext: { chainId: context.chainId, timestamp: context.timestamp, spending: context.spending },
    };
  }

  return {
    allowed: false,
    requiresKYC: true,
    dailyTotal: daily,
    remainingAnonymous: remaining,
    reason: `Daily spend would reach $${projectedTotal.toLocaleString()} — ZK proof of identity required above $${DAILY_ANONYMOUS_LIMIT.toLocaleString()}/day.`,
    policyContext: { chainId: context.chainId, timestamp: context.timestamp, spending: context.spending },
  };
}

/**
 * After a valid ZK proof is verified, approve the payment and record spend.
 */
export async function approveWithProof(request: PaymentRequest): Promise<PolicyDecision> {
  const daily = await recordSpend(request.agentId, request.amount);
  return {
    allowed: true,
    requiresKYC: false,
    dailyTotal: daily,
    remainingAnonymous: 0,
    reason: "ZK proof verified — identity confirmed without disclosure. Payment approved.",
    policyContext: {
      chainId: request.chainId,
      timestamp: new Date().toISOString(),
      spending: { dailyTotal: daily, date: new Date().toISOString().slice(0, 10) },
    },
  };
}
