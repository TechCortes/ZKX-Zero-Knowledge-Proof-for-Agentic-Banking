/**
 * Server-side threshold reveal config.
 *
 * ZQUENT_REVEAL_PUBLIC_KEY="<x>,<y>" (legacy name VERO_REVEAL_PUBLIC_KEY still read) — the consortium public key from
 * `npm run reveal -- keygen` (consortium.json → publicKey). Unset means reveal is off
 * and the server keeps using the plain kyc_credential circuit.
 *
 * A set-but-invalid key throws instead of quietly turning reveal off: an
 * institution that configured reveal must never accept proofs without it.
 */

import { isValidRevealPublicKey } from "./reveal";
import { parseEscrowKeySet, type EscrowKeySet } from "./escrowSeal";
import { envLabel, readProtocolEnv } from "@/lib/env";

export type RevealPublicKey = [string, string];

let cached: { raw: string | undefined; key: RevealPublicKey | null } | null = null;

export async function getRevealPublicKey(): Promise<RevealPublicKey | null> {
  const raw = readProtocolEnv("REVEAL_PUBLIC_KEY");
  if (cached && cached.raw === raw) return cached.key;

  let key: RevealPublicKey | null = null;
  if (raw) {
    const parts = raw.split(",").map((s) => s.trim());
    if (parts.length !== 2 || !parts.every((p) => /^\d+$/.test(p)) || !(await isValidRevealPublicKey([parts[0], parts[1]]))) {
      throw new Error(`${envLabel("REVEAL_PUBLIC_KEY")} is set but is not a valid BabyJubJub point "<x>,<y>".`);
    }
    key = [parts[0], parts[1]];
  }
  cached = { raw, key };
  return key;
}

/**
 * ZQUENT_ESCROW_KEYS (legacy name VERO_ESCROW_KEYS still read) — the consortium's X-Wing public keys (JSON, `vero-escrow-keys/v1`,
 * printed by `npm run reveal -- escrow-keys`). When set, every reveal ciphertext is
 * sealed in a post-quantum envelope before it is stored. Unset means ciphertexts are
 * stored unsealed (`vero-reveal/v1` only), and a warning is logged once.
 *
 * A set-but-invalid value throws, for the same reason as above.
 */
let escrowCached: { raw: string | undefined; keys: EscrowKeySet | null } | null = null;

export function getEscrowKeySet(): EscrowKeySet | null {
  const raw = readProtocolEnv("ESCROW_KEYS");
  if (escrowCached && escrowCached.raw === raw) return escrowCached.keys;

  let keys: EscrowKeySet | null = null;
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`${envLabel("ESCROW_KEYS")} is set but is not valid JSON.`);
    }
    try {
      keys = parseEscrowKeySet(parsed);
    } catch (e) {
      throw new Error(`${envLabel("ESCROW_KEYS")} is set but invalid: ${(e as Error).message}`);
    }
  }
  escrowCached = { raw, keys };
  return keys;
}
