import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluatePayment,
  approveWithProof,
  getDailySpend,
  recordSpend,
  DAILY_ANONYMOUS_LIMIT,
} from "./engine";

// Isolate tests: use unique agentIds per test to avoid ledger bleed
let agentCounter = 0;
function freshAgent(): string {
  return `test-agent-${Date.now()}-${++agentCounter}`;
}

describe("Policy Engine — spend threshold", () => {
  it("approves anonymously when spend is below $1k limit", () => {
    const agentId = freshAgent();
    const decision = evaluatePayment({ agentId, amount: 999, recipient: "0xabc" });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresKYC).toBe(false);
    expect(decision.reason).toMatch(/approved/i);
  });

  it("requires ZK proof when projected spend hits exactly $1k", () => {
    const agentId = freshAgent();
    const decision = evaluatePayment({ agentId, amount: 1000, recipient: "0xabc" });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresKYC).toBe(true);
    expect(decision.reason).toMatch(/ZK proof/i);
  });

  it("requires ZK proof when projected spend exceeds $1k", () => {
    const agentId = freshAgent();
    const decision = evaluatePayment({ agentId, amount: 1001, recipient: "0xabc" });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresKYC).toBe(true);
  });

  it("approves $1,001 after proof is provided", () => {
    const agentId = freshAgent();
    // First confirm it requires KYC
    const challenged = evaluatePayment({ agentId, amount: 1001, recipient: "0xabc" });
    expect(challenged.requiresKYC).toBe(true);

    // After proof approval, spend is recorded and decision flips
    const approved = approveWithProof({ agentId, amount: 1001, recipient: "0xabc" });
    expect(approved.allowed).toBe(true);
    expect(approved.requiresKYC).toBe(false);
    expect(getDailySpend(agentId)).toBe(1001);
  });

  it("tracks cumulative spend across multiple transactions", () => {
    const agentId = freshAgent();

    // Two $400 payments — each individually below $1k
    const first = evaluatePayment({ agentId, amount: 400, recipient: "0xabc" });
    expect(first.allowed).toBe(true);
    recordSpend(agentId, 400);

    const second = evaluatePayment({ agentId, amount: 400, recipient: "0xabc" });
    expect(second.allowed).toBe(true);
    recordSpend(agentId, 400);

    // Third $400 would push total to $1,200 — KYC required
    const third = evaluatePayment({ agentId, amount: 400, recipient: "0xabc" });
    expect(third.allowed).toBe(false);
    expect(third.requiresKYC).toBe(true);
    expect(third.dailyTotal).toBe(800);
  });

  it("exposes correct remainingAnonymous budget", () => {
    const agentId = freshAgent();
    recordSpend(agentId, 300);

    const decision = evaluatePayment({ agentId, amount: 100, recipient: "0xabc" });
    expect(decision.dailyTotal).toBe(300);
    expect(decision.remainingAnonymous).toBe(DAILY_ANONYMOUS_LIMIT - 300);
  });

  it("clamps remainingAnonymous to 0 when limit is exhausted", () => {
    const agentId = freshAgent();
    recordSpend(agentId, 1200);

    const decision = evaluatePayment({ agentId, amount: 50, recipient: "0xabc" });
    expect(decision.remainingAnonymous).toBe(0);
  });
});
