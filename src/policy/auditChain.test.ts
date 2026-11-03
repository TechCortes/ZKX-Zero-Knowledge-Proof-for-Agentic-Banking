import { describe, it, expect, beforeAll } from "vitest";
import { recordAuditEntry, hashAuditRecord, getAuditRecord, SEQ_KEY, recordKey, type AuditRecord } from "./auditLog";
import {
  createAuditCheckpoint,
  listCheckpoints,
  checkpointLeaves,
  verifyCheckpoints,
  verifyLeaves,
  verifyRecordInclusion,
  GAP_TIMEOUT_MS,
  type AuditCheckpoint,
} from "./auditCheckpoint";
import { computePolicyVersionHash } from "./engine";
import { signerFromSeed, generateAuditSigningSeed, type HybridSigner } from "@/lib/auditSigning";
import { kv } from "@/lib/kv";

let signer: HybridSigner;
let n = 0;

beforeAll(() => {
  signer = signerFromSeed(generateAuditSigningSeed());
});

const write = (dailyTotal = 1) =>
  recordAuditEntry({
    agentId: `chain-agent-${++n}`,
    policyVersionHash: computePolicyVersionHash(),
    decision: "approved_anonymous",
    thresholdMet: false,
    dailyTotal,
  });

/** Checkpoint everything written so far (other test files share the in-memory store). */
async function checkpointAll(): Promise<AuditCheckpoint[]> {
  const made: AuditCheckpoint[] = [];
  for (;;) {
    const cp = await createAuditCheckpoint(signer);
    if (!cp) return made;
    made.push(cp);
  }
}

describe("audit chain — records", () => {
  it("hashes each record over its canonical content", async () => {
    const r = await write(5);
    expect(r.recordHash).toBe(hashAuditRecord(r));
    // Key order doesn't matter, content does.
    const reordered = Object.fromEntries(Object.entries(r).reverse()) as AuditRecord;
    expect(hashAuditRecord(reordered)).toBe(r.recordHash);
    expect(hashAuditRecord({ ...r, dailyTotal: 6 })).not.toBe(r.recordHash);
  });
});

describe("audit chain — checkpoints", () => {
  it("covers new records, links checkpoints, and verifies", async () => {
    await checkpointAll();
    const a = await write();
    const b = await write();
    const [cp1] = await checkpointAll();
    const c = await write();
    const [cp2] = await checkpointAll();

    expect(cp1.toSeq).toBeGreaterThanOrEqual(b.seq!);
    expect(cp2.fromSeq).toBe(cp1.toSeq + 1);
    expect(cp2.prevChainHash).toBe(cp1.chainHash);
    expect(verifyCheckpoints([cp1, cp2], signer.publicKey)).toEqual({ ok: true });

    const leaves1 = await checkpointLeaves(cp1);
    expect(verifyLeaves(cp1, leaves1)).toEqual({ ok: true });
    expect(verifyRecordInclusion(a, cp1, leaves1)).toEqual({ ok: true });
    expect(verifyRecordInclusion(c, cp2, await checkpointLeaves(cp2))).toEqual({ ok: true });

    expect(await createAuditCheckpoint(signer)).toBeNull(); // nothing new
    expect((await listCheckpoints(1))[0].index).toBe(cp2.index);
  });

  it("detects an edited record", async () => {
    await checkpointAll();
    const r = await write(100);
    const [cp] = await checkpointAll();
    const leaves = await checkpointLeaves(cp);

    const edited = { ...r, dailyTotal: 1 };
    expect(verifyRecordInclusion(edited, cp, leaves).ok).toBe(false);
    // Re-hashing the edited record doesn't help: the checkpoint still commits to the old hash.
    const rehashed = { ...edited, recordHash: hashAuditRecord(edited) };
    expect(verifyRecordInclusion(rehashed, cp, leaves).ok).toBe(false);
  });

  it("detects reordered or removed leaves", async () => {
    await checkpointAll();
    await write();
    await write();
    const [cp] = await checkpointAll();
    const leaves = await checkpointLeaves(cp);
    expect(leaves.length).toBeGreaterThanOrEqual(2);
    const swapped = [...leaves];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(verifyLeaves(cp, swapped).ok).toBe(false);
    expect(verifyLeaves(cp, leaves.slice(1)).ok).toBe(false);
  });

  it("rejects a forged or re-signed checkpoint", async () => {
    await checkpointAll();
    await write();
    const [cp] = await checkpointAll();

    expect(verifyCheckpoints([{ ...cp, toSeq: cp.toSeq + 1 }], signer.publicKey).ok).toBe(false);

    const other = signerFromSeed(generateAuditSigningSeed());
    expect(verifyCheckpoints([cp], other.publicKey).ok).toBe(false);

    // Both halves are required: a valid Ed25519 signature with a broken ML-DSA one fails.
    const halfForged = { ...cp, signature: { ...cp.signature, mlDsa65: other.sign(new Uint8Array([1])).mlDsa65 } };
    expect(verifyCheckpoints([halfForged], signer.publicKey).ok).toBe(false);
  });
});

describe("audit chain — sequence gaps", () => {
  it("waits on a fresh gap, voids it once stale, and a late writer moves on", async () => {
    await checkpointAll();
    // Simulate a writer that took a sequence number and died before storing its record.
    const lost = await kv().incrby(SEQ_KEY, 1);
    const after = await write();

    const t0 = Date.now();
    const first = await createAuditCheckpoint(signer, t0);
    expect(first === null || first.toSeq < lost).toBe(true); // stops at the gap

    expect(await createAuditCheckpoint(signer, t0 + 1000)).toBeNull(); // still waiting

    const cp = await createAuditCheckpoint(signer, t0 + GAP_TIMEOUT_MS + 1);
    expect(cp).not.toBeNull();
    expect(cp!.voided).toContain(lost);
    expect(cp!.toSeq).toBeGreaterThanOrEqual(after.seq!);
    expect(verifyLeaves(cp!, await checkpointLeaves(cp!))).toEqual({ ok: true });

    // The voided slot is write-once: a late writer can't fill it.
    expect(await kv().set(recordKey(lost), { late: true }, { nx: true })).toBe(false);
    expect(await getAuditRecord(lost)).toEqual({ void: true, seq: lost });
  });
});
