/**
 * Server-side threshold reveal config.
 *
 * VERO_REVEAL_PUBLIC_KEY="<x>,<y>" — the consortium public key from
 * `npm run reveal -- keygen` (consortium.json → publicKey). Unset means reveal is off
 * and the server keeps using the plain kyc_credential circuit.
 *
 * A set-but-invalid key throws instead of quietly turning reveal off: an
 * institution that configured reveal must never accept proofs without it.
 */

import { isValidRevealPublicKey } from "./reveal";

export type RevealPublicKey = [string, string];

let cached: { raw: string | undefined; key: RevealPublicKey | null } | null = null;

export async function getRevealPublicKey(): Promise<RevealPublicKey | null> {
  const raw = process.env.VERO_REVEAL_PUBLIC_KEY?.trim() || undefined;
  if (cached && cached.raw === raw) return cached.key;

  let key: RevealPublicKey | null = null;
  if (raw) {
    const parts = raw.split(",").map((s) => s.trim());
    if (parts.length !== 2 || !parts.every((p) => /^\d+$/.test(p)) || !(await isValidRevealPublicKey([parts[0], parts[1]]))) {
      throw new Error("VERO_REVEAL_PUBLIC_KEY is set but is not a valid BabyJubJub point \"<x>,<y>\".");
    }
    key = [parts[0], parts[1]];
  }
  cached = { raw, key };
  return key;
}
