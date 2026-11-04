/**
 * Signed audit checkpoints — what makes the audit log tamper-evident.
 *
 * Every audit record has a global sequence number and a recordHash. A
 * checkpoint covers the next run of sequence numbers and commits to them as a
 * hash chain that continues from the previous checkpoint:
 *
 *   h_0      = previous checkpoint's chainHash (64 zeros for the first)
 *   h_i      = SHA-256(h_{i-1} ‖ leaf_i)    leaf = recordHash, or SHA-256("void:<seq>")
 *   chainHash = h_last
 *
 * The checkpoint body is signed with Ed25519 + ML-DSA-65 (auditSigning.ts).
 * After that, changing, removing or reordering any covered record, or any
 * earlier checkpoint, breaks a hash or a signature.
 *
 * What it doesn't stop: whoever holds ZQUENT_AUDIT_SIGNING_KEY can sign a
 * different history. Publishing checkpoints (and, next, anchoring their
 * hashes on-chain) is what makes that visible.
 *
 * Sequence slots: a writer takes a number, then stores its record. A writer
 * that dies in between leaves a gap. A checkpoint stops at a gap; if the same
 * gap is still there GAP_TIMEOUT_MS later, it writes a "void" marker into the
 * slot (write-once, so a late writer loses and retries with a new number).
 */

import { createHash } from "crypto";
import { kv } from "@/lib/kv";
import { canonicalJson } from "@/lib/canonicalJson";
import type { HybridPublicKey, HybridSignature, HybridSigner } from "@/lib/auditSigning";
import { verifyHybrid } from "@/lib/auditSigning";
import { SEQ_KEY, recordKey, getAuditRecord, hashAuditRecord, type AuditRecord, type VoidedSlot } from "./auditLog";

// Frozen wire-format tag: written into stored records and checked on read.
// It keeps the pre-rename "vero-" prefix on purpose — changing it would orphan existing data.
export const CHECKPOINT_FORMAT = "vero-audit-checkpoint/v1";
export const GAP_TIMEOUT_MS = 10 * 60 * 1000;
/** Most records one checkpoint covers, so a single run stays well inside a serverless time limit. */
export const MAX_RECORDS_PER_CHECKPOINT = 2000;
const GENESIS = "0".repeat(64);

export interface CheckpointBody {
  format: typeof CHECKPOINT_FORMAT;
  index: number;           // 1, 2, 3, …
  fromSeq: number;
  toSeq: number;
  /** Sequence numbers in [fromSeq, toSeq] that were voided rather than written. */
  voided: number[];
  prevChainHash: string;
  chainHash: string;
  createdAt: string;
}

export interface AuditCheckpoint extends CheckpointBody {
  signature: HybridSignature;
}

interface Head {
  index: number;
  toSeq: number;
  chainHash: string;
  /** A gap seen by the last run, so the next run can tell how long it has been there. */
  pendingGap?: { seq: number; firstSeenAt: number };
}

const HEAD_KEY = "audit_checkpoint_head";
const checkpointKey = (index: number) => `audit_checkpoint:${index}`;

const sha256Hex = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

export function voidLeaf(seq: number): string {
  return sha256Hex(`void:${seq}`);
}

export function chainStep(prev: string, leaf: string): string {
  return sha256Hex(Buffer.concat([Buffer.from(prev, "hex"), Buffer.from(leaf, "hex")]));
}

export function checkpointMessage(body: CheckpointBody): Uint8Array {
  return new TextEncoder().encode(canonicalJson(body));
}

const isVoid = (r: AuditRecord | VoidedSlot): r is VoidedSlot => (r as VoidedSlot).void === true;

/**
 * Cover every new record since the last checkpoint with a signed checkpoint.
 * Returns null when there is nothing new to cover (or another run won the race).
 */
export async function createAuditCheckpoint(
  signer: HybridSigner,
  now: number = Date.now()
): Promise<AuditCheckpoint | null> {
  const head: Head = (await kv().get<Head>(HEAD_KEY)) ?? { index: 0, toSeq: 0, chainHash: GENESIS };
  const maxSeq = (await kv().get<number>(SEQ_KEY)) ?? 0;

  const leaves: string[] = [];
  const voided: number[] = [];
  let pendingGap: Head["pendingGap"];
  let seq = head.toSeq + 1;

  for (; seq <= maxSeq && leaves.length < MAX_RECORDS_PER_CHECKPOINT; seq++) {
    let slot = await getAuditRecord(seq);
    if (!slot) {
      const stale = head.pendingGap?.seq === seq && now - head.pendingGap.firstSeenAt >= GAP_TIMEOUT_MS;
      if (!stale) {
        pendingGap = head.pendingGap?.seq === seq ? head.pendingGap : { seq, firstSeenAt: now };
        break;
      }
      const marker: VoidedSlot = { void: true, seq };
      await kv().set(recordKey(seq), marker, { nx: true });
      slot = await getAuditRecord(seq); // the writer may have just won
      if (!slot) break;
    }
    if (isVoid(slot)) {
      voided.push(seq);
      leaves.push(voidLeaf(seq));
    } else {
      leaves.push(slot.recordHash ?? hashAuditRecord(slot));
    }
  }

  if (leaves.length === 0) {
    if (pendingGap && pendingGap !== head.pendingGap) await kv().set(HEAD_KEY, { ...head, pendingGap });
    return null;
  }

  const chainHash = leaves.reduce(chainStep, head.chainHash);
  const body: CheckpointBody = {
    format: CHECKPOINT_FORMAT,
    index: head.index + 1,
    fromSeq: head.toSeq + 1,
    toSeq: head.toSeq + leaves.length,
    voided,
    prevChainHash: head.chainHash,
    chainHash,
    createdAt: new Date(now).toISOString(),
  };
  const checkpoint: AuditCheckpoint = { ...body, signature: signer.sign(checkpointMessage(body)) };

  // Write-once per index: if two runs race, the second one's checkpoint is dropped.
  if (!(await kv().set(checkpointKey(checkpoint.index), checkpoint, { nx: true }))) return null;
  const next: Head = { index: checkpoint.index, toSeq: checkpoint.toSeq, chainHash, ...(pendingGap ? { pendingGap } : {}) };
  await kv().set(HEAD_KEY, next);
  return checkpoint;
}

export async function getCheckpoint(index: number): Promise<AuditCheckpoint | undefined> {
  return (await kv().get<AuditCheckpoint>(checkpointKey(index))) ?? undefined;
}

/** Most recent checkpoints first. */
export async function listCheckpoints(limit = 20): Promise<AuditCheckpoint[]> {
  const head = await kv().get<Head>(HEAD_KEY);
  if (!head) return [];
  const out: AuditCheckpoint[] = [];
  for (let i = head.index; i >= 1 && out.length < limit; i--) {
    const cp = await getCheckpoint(i);
    if (cp) out.push(cp);
  }
  return out;
}

/** The leaf hashes a checkpoint covers, in sequence order. Hashes only — no record content. */
export async function checkpointLeaves(cp: CheckpointBody): Promise<string[]> {
  const leaves: string[] = [];
  for (let seq = cp.fromSeq; seq <= cp.toSeq; seq++) {
    const slot = await getAuditRecord(seq);
    if (!slot) throw new Error(`Audit record ${seq} is missing from the store.`);
    leaves.push(isVoid(slot) ? voidLeaf(seq) : slot.recordHash ?? hashAuditRecord(slot));
  }
  return leaves;
}

// --- Verification (pure; also used by the CLI against downloaded data) ---

export type VerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Check a run of checkpoints: each signature (both halves), each link to the
 * one before, and contiguous sequence ranges. `checkpoints` in index order;
 * the first may start anywhere (its own prevChainHash is trusted).
 */
export function verifyCheckpoints(checkpoints: AuditCheckpoint[], key: HybridPublicKey): VerifyResult {
  let prev: AuditCheckpoint | undefined;
  for (const cp of checkpoints) {
    const { signature, ...body } = cp;
    if (body.format !== CHECKPOINT_FORMAT) return { ok: false, error: `Checkpoint ${cp.index}: unknown format.` };
    if (!verifyHybrid(key, checkpointMessage(body), signature)) {
      return { ok: false, error: `Checkpoint ${cp.index}: signature does not verify.` };
    }
    if (prev) {
      if (cp.index !== prev.index + 1) return { ok: false, error: `Checkpoint ${cp.index} does not follow ${prev.index}.` };
      if (cp.prevChainHash !== prev.chainHash) return { ok: false, error: `Checkpoint ${cp.index} does not link to ${prev.index}.` };
      if (cp.fromSeq !== prev.toSeq + 1) return { ok: false, error: `Checkpoint ${cp.index} leaves a sequence gap.` };
    } else if (cp.index === 1 && (cp.prevChainHash !== GENESIS || cp.fromSeq !== 1)) {
      return { ok: false, error: "Checkpoint 1 must start the chain." };
    }
    prev = cp;
  }
  return { ok: true };
}

/** Check that `leaves` are exactly what `cp` committed to. */
export function verifyLeaves(cp: CheckpointBody, leaves: string[]): VerifyResult {
  if (leaves.length !== cp.toSeq - cp.fromSeq + 1) return { ok: false, error: "Wrong number of leaves for this checkpoint." };
  for (const seq of cp.voided) {
    if (leaves[seq - cp.fromSeq] !== voidLeaf(seq)) return { ok: false, error: `Slot ${seq} is listed as voided but isn't.` };
  }
  return leaves.reduce(chainStep, cp.prevChainHash) === cp.chainHash
    ? { ok: true }
    : { ok: false, error: "Leaves do not hash to the checkpoint's chainHash." };
}

/** Check that one audit record is covered, unchanged, by `cp`. */
export function verifyRecordInclusion(record: AuditRecord, cp: CheckpointBody, leaves: string[]): VerifyResult {
  if (record.seq === undefined || record.recordHash === undefined) {
    return { ok: false, error: "Record predates the audit chain (no seq)." };
  }
  if (hashAuditRecord(record) !== record.recordHash) return { ok: false, error: "Record content does not match its recordHash." };
  if (record.seq < cp.fromSeq || record.seq > cp.toSeq) return { ok: false, error: `Record ${record.seq} is not in this checkpoint.` };
  const leavesOk = verifyLeaves(cp, leaves);
  if (!leavesOk.ok) return leavesOk;
  return leaves[record.seq - cp.fromSeq] === record.recordHash
    ? { ok: true }
    : { ok: false, error: `Leaf ${record.seq} is not this record.` };
}
