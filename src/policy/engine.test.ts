import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluatePayment,
  approveWithProof,
  getDailySpend,
  recordSpend,
  DAILY_ANONYMOUS_LIMIT,
  MAX_PAYMENT_USD,
  usdAmountError,
  reservePersonSpend,
  getPersonDailyLimit,
} from "./engine";

// Isolate tests: use unique agentIds per test to avoid ledger bleed
let agentCounter = 0;
function freshAgent(): string {
  return `test-agent-${Date.now()}-${++agentCounter}`;
}

describe("Policy Engine — spend threshold", () => {
  it("approves anonymously when spend is below $1k limit", async () => {
    const agentId = freshAgent();
    const decision = await evaluatePayment({ agentId, amount: 999, recipient: "0xabc" });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresKYC).toBe(false);
    expect(decision.reason).toMatch(/approved/i);
  });

  it("requires ZK proof when projected spend hits exactly $1k", async () => {
    const agentId = freshAgent();
    const decision = await evaluatePayment({ agentId, amount: 1000, recipient: "0xabc" });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresKYC).toBe(true);
    expect(decision.reason).toMatch(/ZK proof/i);
  });

  it("requires ZK proof when projected spend exceeds $1k", async () => {
    const agentId = freshAgent();
    const decision = await evaluatePayment({ agentId, amount: 1001, recipient: "0xabc" });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresKYC).toBe(true);
  });

  it("approves $1,001 after proof is provided", async () => {
    const agentId = freshAgent();
    // First confirm it requires KYC
    const challenged = await evaluatePayment({ agentId, amount: 1001, recipient: "0xabc" });
    expect(challenged.requiresKYC).toBe(true);

    // After proof approval, spend is recorded and decision flips
    const approved = await approveWithProof({ agentId, amount: 1001, recipient: "0xabc" });
    expect(approved.allowed).toBe(true);
    expect(approved.requiresKYC).toBe(false);
    expect(await getDailySpend(agentId)).toBe(1001);
  });

  it("tracks cumulative spend across multiple transactions", async () => {
    const agentId = freshAgent();

    // Two $400 payments — each individually below $1k
    const first = await evaluatePayment({ agentId, amount: 400, recipient: "0xabc" });
    expect(first.allowed).toBe(true);
    await recordSpend(agentId, 400);

    const second = await evaluatePayment({ agentId, amount: 400, recipient: "0xabc" });
    expect(second.allowed).toBe(true);
    await recordSpend(agentId, 400);

    // Third $400 would push total to $1,200 — KYC required
    const third = await evaluatePayment({ agentId, amount: 400, recipient: "0xabc" });
    expect(third.allowed).toBe(false);
    expect(third.requiresKYC).toBe(true);
    expect(third.dailyTotal).toBe(800);
  });

  it("exposes correct remainingAnonymous budget", async () => {
    const agentId = freshAgent();
    await recordSpend(agentId, 300);

    const decision = await evaluatePayment({ agentId, amount: 100, recipient: "0xabc" });
    expect(decision.dailyTotal).toBe(300);
    expect(decision.remainingAnonymous).toBe(DAILY_ANONYMOUS_LIMIT - 300);
  });

  it("clamps remainingAnonymous to 0 when limit is exhausted", async () => {
    const agentId = freshAgent();
    await recordSpend(agentId, 1200);

    const decision = await evaluatePayment({ agentId, amount: 50, recipient: "0xabc" });
    expect(decision.remainingAnonymous).toBe(0);
  });
});

describe("Policy Engine — amounts", () => {
  it("keeps cent-exact totals (no float drift)", async () => {
    const agentId = freshAgent();
    for (let i = 0; i < 10; i++) await recordSpend(agentId, 0.1);
    expect(await getDailySpend(agentId)).toBe(1);
    await recordSpend(agentId, 0.2);
    expect(await getDailySpend(agentId)).toBe(1.2);
  });

  it("validates amounts", () => {
    expect(usdAmountError(12.34)).toBeNull();
    expect(usdAmountError(MAX_PAYMENT_USD)).toBeNull();
    expect(usdAmountError(0)).toMatch(/positive/);
    expect(usdAmountError(-5)).toMatch(/positive/);
    expect(usdAmountError(Number.NaN)).toMatch(/positive/);
    expect(usdAmountError(Infinity)).toMatch(/positive/);
    expect(usdAmountError("10")).toMatch(/positive/);
    expect(usdAmountError(MAX_PAYMENT_USD + 1)).toMatch(/at most/);
    expect(usdAmountError(1.005)).toMatch(/two decimal/);
  });
});

describe("Policy Engine — spending_limit rule", () => {
  const limit = [{ type: "spending_limit" as const, value: 500 }];

  it("denies a single payment that would overshoot the limit", async () => {
    const agentId = freshAgent();
    const decision = await evaluatePayment({ agentId, amount: 600, recipient: "0xabc" }, limit);
    expect(decision.allowed).toBe(false);
    expect(decision.requiresKYC).toBe(false);
    expect(decision.reason).toMatch(/over the policy limit/);
  });

  it("counts today's spend plus this payment", async () => {
    const agentId = freshAgent();
    await recordSpend(agentId, 450);
    expect((await evaluatePayment({ agentId, amount: 50, recipient: "0xabc" }, limit)).allowed).toBe(true);
    expect((await evaluatePayment({ agentId, amount: 50.01, recipient: "0xabc" }, limit)).allowed).toBe(false);
  });
});

describe("Policy Engine — per-person daily cap (nullifier)", () => {
  const prev = process.env.ZQUENT_PERSON_DAILY_LIMIT;
  const restore = () => {
    if (prev === undefined) delete process.env.ZQUENT_PERSON_DAILY_LIMIT;
    else process.env.ZQUENT_PERSON_DAILY_LIMIT = prev;
  };
  const nullifier = () => `n-${Date.now()}-${++agentCounter}`;

  it("counts but doesn't cap when unset", async () => {
    delete process.env.ZQUENT_PERSON_DAILY_LIMIT;
    try {
      const n = nullifier();
      expect(await reservePersonSpend(n, 5000)).toEqual({ ok: true, personDailyTotal: 5000 });
      expect(await reservePersonSpend(n, 0.1)).toEqual({ ok: true, personDailyTotal: 5000.1 });
    } finally {
      restore();
    }
  });

  it("caps one person across agents and rolls back the rejected amount", async () => {
    process.env.ZQUENT_PERSON_DAILY_LIMIT = "3000";
    try {
      const n = nullifier();
      expect((await reservePersonSpend(n, 2000)).ok).toBe(true);
      expect(await reservePersonSpend(n, 1500)).toEqual({ ok: false, personDailyTotal: 2000, limit: 3000 });
      expect(await reservePersonSpend(n, 1000)).toEqual({ ok: true, personDailyTotal: 3000 });
      expect((await reservePersonSpend(nullifier(), 3000)).ok).toBe(true); // someone else
    } finally {
      restore();
    }
  });

  it("throws on an invalid limit instead of lifting it", () => {
    process.env.ZQUENT_PERSON_DAILY_LIMIT = "lots";
    try {
      expect(() => getPersonDailyLimit()).toThrow(/positive USD/);
    } finally {
      restore();
    }
  });
});
