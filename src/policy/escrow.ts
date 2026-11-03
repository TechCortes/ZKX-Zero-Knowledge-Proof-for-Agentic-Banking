/**
 * Reveal escrow — where threshold-reveal ciphertexts live.
 *
 * The ciphertext is kept apart from the audit log on purpose:
 *   - agents read their own audit trail (GET /api/v1/audit); they get only a
 *     hash of the ciphertext, never the ciphertext itself
 *   - escrow records are never trimmed, so an old payment stays disclosable
 *     for as long as the law requires
 *   - only the operator (direct store access) or, later, the regulator
 *     disclosure flow reads them
 *
 * With VERO_ESCROW_KEYS set, each ciphertext is sealed in a post-quantum
 * envelope (`vero-escrow/v2`, see src/zkp/escrowSeal.ts) before it's stored;
 * the store then never holds the inner ciphertext at all. Without it, records
 * are stored unsealed and a warning is logged.
 */

import { createHash } from "crypto";
import { kv } from "@/lib/kv";
import { logger } from "@/lib/logger";
import type { RevealCiphertext } from "@/zkp/reveal";
import { sealEscrow, type EscrowEnvelope, type EscrowKeySet } from "@/zkp/escrowSeal";
import { getEscrowKeySet } from "@/zkp/revealConfig";

interface EscrowRecordBase {
  txId: string;
  agentId: string;
  commitment: string;
  txNonce?: string;
  createdAt: string; // ISO-8601
  ciphertextHash: string;
}

/** Exactly one of `envelope` (sealed, v2) or `ciphertext` (unsealed, v1) is present. */
export type EscrowRecord = EscrowRecordBase &
  ({ envelope: EscrowEnvelope; ciphertext?: undefined } | { ciphertext: RevealCiphertext; envelope?: undefined });

/** What the audit log keeps instead of the ciphertext. */
export interface EscrowReference {
  format: string;
  ciphertextHash: string;
  /** True when the stored record is a post-quantum envelope. */
  sealed: boolean;
}

const escrowKey = (txId: string) => `escrow:${txId}`;
const INDEX_KEY = "escrow_index";

/** SHA-256 over the ciphertext's fields in a fixed order — stable across JSON key order. */
export function hashRevealCiphertext(ct: RevealCiphertext): string {
  const canonical = JSON.stringify([ct.format, ct.commitment, ct.publicKey, ct.ephemeral, ct.ciphertext]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** The exact bytes sealed inside an envelope: the ciphertext with a fixed key order. */
export function serializeRevealCiphertext(ct: RevealCiphertext): Buffer {
  return Buffer.from(JSON.stringify({
    format: ct.format,
    commitment: ct.commitment,
    publicKey: ct.publicKey,
    ephemeral: ct.ephemeral,
    ciphertext: ct.ciphertext,
  }));
}

let warnedUnsealed = false;

function buildRecord(
  base: EscrowRecordBase,
  ciphertext: RevealCiphertext,
  keys: EscrowKeySet | null
): EscrowRecord {
  if (keys) {
    return { ...base, envelope: sealEscrow(keys, base.txId, serializeRevealCiphertext(ciphertext), base.ciphertextHash) };
  }
  if (!warnedUnsealed) {
    warnedUnsealed = true;
    logger.warn("escrow", "stored_unsealed", { reason: "VERO_ESCROW_KEYS is not set" });
  }
  return { ...base, ciphertext };
}

/**
 * Store a ciphertext under its txId, sealed when escrow keys are configured.
 * Idempotent: an existing record for the same txId is kept, never overwritten.
 */
export async function storeRevealEscrow(entry: {
  txId: string;
  agentId: string;
  txNonce?: string;
  ciphertext: RevealCiphertext;
  createdAt?: string;
}): Promise<EscrowReference> {
  const ciphertextHash = hashRevealCiphertext(entry.ciphertext);
  const record = buildRecord(
    {
      txId: entry.txId,
      agentId: entry.agentId,
      commitment: entry.ciphertext.commitment,
      ...(entry.txNonce ? { txNonce: entry.txNonce } : {}),
      createdAt: entry.createdAt ?? new Date().toISOString(),
      ciphertextHash,
    },
    entry.ciphertext,
    getEscrowKeySet()
  );
  const created = await kv().set(escrowKey(entry.txId), record, { nx: true });
  if (created) await kv().lpush(INDEX_KEY, entry.txId);
  const stored = created ? record : (await getRevealEscrow(entry.txId)) ?? record;
  return { format: entry.ciphertext.format, ciphertextHash: stored.ciphertextHash, sealed: Boolean(stored.envelope) };
}

export async function getRevealEscrow(txId: string): Promise<EscrowRecord | undefined> {
  return (await kv().get<EscrowRecord>(escrowKey(txId))) ?? undefined;
}

/**
 * Seal every unsealed record in the index with `keys`. For records stored
 * before VERO_ESCROW_KEYS was configured. Safe to re-run: sealed records are
 * skipped. Returns how many were sealed and how many were already sealed.
 */
export async function sealUnsealedEscrows(keys: EscrowKeySet): Promise<{ sealed: number; alreadySealed: number }> {
  const txIds = await kv().lrange<string>(INDEX_KEY, 0, -1);
  let sealed = 0;
  let alreadySealed = 0;
  for (const txId of new Set(txIds)) {
    const record = await getRevealEscrow(txId);
    if (!record) continue;
    if (record.envelope) {
      alreadySealed++;
      continue;
    }
    const { ciphertext, ...base } = record;
    await kv().set(escrowKey(txId), buildRecord(base, ciphertext, keys));
    sealed++;
  }
  return { sealed, alreadySealed };
}
