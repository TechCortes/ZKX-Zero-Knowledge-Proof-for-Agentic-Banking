import { describe, it, expect } from "vitest";
import { storeRevealEscrow, getRevealEscrow, hashRevealCiphertext } from "./escrow";
import { recordAuditEntry, getAuditLog } from "./auditLog";
import { computePolicyVersionHash } from "./engine";
import { kv } from "@/lib/kv";
import type { RevealCiphertext } from "@/zkp/reveal";

let n = 0;
const fresh = (p: string) => `${p}-${Date.now()}-${++n}`;

const sampleCt = (commitment = "42"): RevealCiphertext => ({
  format: "vero-reveal/v1",
  commitment,
  publicKey: ["1", "2"],
  ephemeral: ["3", "4"],
  ciphertext: ["5", "6", "7"],
});

describe("Reveal escrow", () => {
  it("stores the ciphertext under its txId and returns only a hash", async () => {
    const txId = fresh("tx");
    const ref = await storeRevealEscrow({ txId, agentId: "a", txNonce: "9", ciphertext: sampleCt() });
    expect(ref).toEqual({ format: "vero-reveal/v1", ciphertextHash: hashRevealCiphertext(sampleCt()) });

    const record = await getRevealEscrow(txId);
    expect(record?.ciphertext).toEqual(sampleCt());
    expect(record?.commitment).toBe("42");
    expect(record?.txNonce).toBe("9");
  });

  it("never overwrites an existing record", async () => {
    const txId = fresh("tx");
    await storeRevealEscrow({ txId, agentId: "a", ciphertext: sampleCt("1") });
    await storeRevealEscrow({ txId, agentId: "a", ciphertext: sampleCt("2") });
    expect((await getRevealEscrow(txId))?.commitment).toBe("1");
  });

  it("hashes independently of JSON key order", () => {
    const ct = sampleCt();
    const reordered = { ciphertext: ct.ciphertext, ephemeral: ct.ephemeral, publicKey: ct.publicKey, commitment: ct.commitment, format: ct.format };
    expect(hashRevealCiphertext(reordered)).toBe(hashRevealCiphertext(ct));
    expect(hashRevealCiphertext({ ...ct, ciphertext: ["5", "6", "8"] })).not.toBe(hashRevealCiphertext(ct));
  });
});

describe("Audit log — ciphertexts stay out of the agent view", () => {
  it("moves a legacy inline ciphertext to escrow and returns only its hash", async () => {
    const agentId = fresh("agent");
    const txId = fresh("tx");
    await kv().lpush(`audit:${agentId}`, {
      id: "old", agentId, txId, policyVersionHash: "x", timestamp: "2026-10-31T00:00:00.000Z",
      decision: "approved_proof", thresholdMet: true, dailyTotal: 1500, txNonce: "7",
      revealCiphertext: sampleCt(),
    });

    const [entry] = await getAuditLog(agentId);
    expect(entry).not.toHaveProperty("revealCiphertext");
    expect(JSON.stringify(entry)).not.toContain('"ephemeral"');
    expect(entry.revealEscrow?.ciphertextHash).toBe(hashRevealCiphertext(sampleCt()));

    const escrowed = await getRevealEscrow(txId);
    expect(escrowed?.ciphertext).toEqual(sampleCt());
    expect(escrowed?.createdAt).toBe("2026-10-31T00:00:00.000Z");
  });

  it("writes every record to the untrimmed compliance stream", async () => {
    const agentId = fresh("agent");
    const record = await recordAuditEntry({
      agentId, policyVersionHash: computePolicyVersionHash(), decision: "approved_anonymous",
      thresholdMet: false, dailyTotal: 10,
    });
    const stream = await kv().lrange<{ id: string }>("audit_stream", 0, 50);
    expect(stream.some((r) => r.id === record.id)).toBe(true);
  });
});
