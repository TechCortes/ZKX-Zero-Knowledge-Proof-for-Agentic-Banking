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
 * The ciphertext is still classical BabyJubJub ElGamal. A post-quantum
 * envelope around it is the next step (plan item D1).
 */

import { createHash } from "crypto";
import { kv } from "@/lib/kv";
import type { RevealCiphertext } from "@/zkp/reveal";

export interface EscrowRecord {
  txId: string;
  agentId: string;
  commitment: string;
  txNonce?: string;
  createdAt: string; // ISO-8601
  ciphertextHash: string;
  ciphertext: RevealCiphertext;
}

/** What the audit log keeps instead of the ciphertext. */
export interface EscrowReference {
  format: string;
  ciphertextHash: string;
}

const escrowKey = (txId: string) => `escrow:${txId}`;

/** SHA-256 over the ciphertext's fields in a fixed order — stable across JSON key order. */
export function hashRevealCiphertext(ct: RevealCiphertext): string {
  const canonical = JSON.stringify([ct.format, ct.commitment, ct.publicKey, ct.ephemeral, ct.ciphertext]);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Store a ciphertext under its txId. Idempotent: an existing record for the
 * same txId is kept, never overwritten.
 */
export async function storeRevealEscrow(entry: {
  txId: string;
  agentId: string;
  txNonce?: string;
  ciphertext: RevealCiphertext;
  createdAt?: string;
}): Promise<EscrowReference> {
  const ciphertextHash = hashRevealCiphertext(entry.ciphertext);
  const record: EscrowRecord = {
    txId: entry.txId,
    agentId: entry.agentId,
    commitment: entry.ciphertext.commitment,
    ...(entry.txNonce ? { txNonce: entry.txNonce } : {}),
    createdAt: entry.createdAt ?? new Date().toISOString(),
    ciphertextHash,
    ciphertext: entry.ciphertext,
  };
  await kv().set(escrowKey(entry.txId), record, { nx: true });
  return { format: entry.ciphertext.format, ciphertextHash };
}

export async function getRevealEscrow(txId: string): Promise<EscrowRecord | undefined> {
  return (await kv().get<EscrowRecord>(escrowKey(txId))) ?? undefined;
}
