import { describe, it, expect } from "vitest";
import { recordAuditEntry, getAuditLog, auditLogSize } from "./auditLog";
import { computePolicyVersionHash } from "./engine";

let agentCounter = 0;
function freshAgent(): string {
  return `audit-test-agent-${Date.now()}-${++agentCounter}`;
}

describe("Audit Log", () => {
  it("records an entry and assigns id + timestamp", () => {
    const agentId = freshAgent();
    const before = auditLogSize();

    const record = recordAuditEntry({
      agentId,
      policyVersionHash: computePolicyVersionHash(),
      decision: "approved_anonymous",
      thresholdMet: false,
      dailyTotal: 200,
    });

    expect(record.id).toBeTruthy();
    expect(record.timestamp).toBeTruthy();
    expect(auditLogSize()).toBe(before + 1);
  });

  it("scopes getAuditLog to the requested agent only", () => {
    const agentA = freshAgent();
    const agentB = freshAgent();

    recordAuditEntry({
      agentId: agentA,
      policyVersionHash: computePolicyVersionHash(),
      decision: "approved_anonymous",
      thresholdMet: false,
      dailyTotal: 100,
    });
    recordAuditEntry({
      agentId: agentB,
      policyVersionHash: computePolicyVersionHash(),
      decision: "kyc_required",
      thresholdMet: true,
      dailyTotal: 1000,
    });

    const logA = getAuditLog(agentA);
    expect(logA).toHaveLength(1);
    expect(logA[0].agentId).toBe(agentA);

    const logB = getAuditLog(agentB);
    expect(logB).toHaveLength(1);
    expect(logB[0].decision).toBe("kyc_required");
  });

  it("returns entries most-recent-first", async () => {
    const agentId = freshAgent();

    recordAuditEntry({
      agentId,
      policyVersionHash: computePolicyVersionHash(),
      decision: "approved_anonymous",
      thresholdMet: false,
      dailyTotal: 100,
    });
    await new Promise((r) => setTimeout(r, 2));
    const second = recordAuditEntry({
      agentId,
      policyVersionHash: computePolicyVersionHash(),
      decision: "approved_anonymous",
      thresholdMet: false,
      dailyTotal: 200,
    });

    const log = getAuditLog(agentId);
    expect(log[0].id).toBe(second.id);
  });

  it("omits commitment/txId when not provided (kyc_required challenge)", () => {
    const agentId = freshAgent();
    recordAuditEntry({
      agentId,
      policyVersionHash: computePolicyVersionHash(),
      decision: "kyc_required",
      thresholdMet: true,
      dailyTotal: 1000,
    });

    const [entry] = getAuditLog(agentId);
    expect(entry.commitment).toBeUndefined();
    expect(entry.txId).toBeUndefined();
  });
});

describe("computePolicyVersionHash", () => {
  it("is stable for the same rule set", () => {
    const rules = [{ type: "spending_limit" as const, value: 5000 }];
    expect(computePolicyVersionHash(rules)).toBe(computePolicyVersionHash(rules));
  });

  it("changes when rules change", () => {
    const a = computePolicyVersionHash([{ type: "spending_limit" as const, value: 5000 }]);
    const b = computePolicyVersionHash([{ type: "spending_limit" as const, value: 9000 }]);
    expect(a).not.toBe(b);
  });

  it("is order-independent across rule arrays", () => {
    const a = computePolicyVersionHash([
      { type: "spending_limit" as const, value: 5000 },
      { type: "allowed_chains" as const, value: ["eip155:1"] },
    ]);
    const b = computePolicyVersionHash([
      { type: "allowed_chains" as const, value: ["eip155:1"] },
      { type: "spending_limit" as const, value: 5000 },
    ]);
    expect(a).toBe(b);
  });

  it("defaults to a hash of the empty rule set", () => {
    expect(computePolicyVersionHash()).toBe(computePolicyVersionHash([]));
  });
});
