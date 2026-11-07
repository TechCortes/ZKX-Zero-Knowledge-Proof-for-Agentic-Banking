/**
 * Server-side credential issuer config (plan item I1). See docs/credentials.md.
 *
 * ZQUENT_ISSUER_PUBLIC_KEY="<x>,<y>" — the issuer every proof must be signed by.
 *   The verifier pins it as a public input, so a credential from any other
 *   issuer (or a self-signed one) is rejected.
 * ZQUENT_ISSUER_PRIVATE_KEY=<64 hex> — turns on the DEMO issuer at
 *   POST /api/v1/credentials/issue. Leave it unset when pinning a real issuer.
 *   If only this is set, the public key is derived from it.
 *
 * With neither set, proofs can't verify (fail closed). Set-but-invalid values throw.
 * `npm run issuer -- keygen` prints a fresh pair.
 */

import { issuerPublicKey, isValidIssuerPublicKey } from "./credential";
import { envLabel, readProtocolEnv } from "@/lib/env";
import type { PointStr } from "./babyjub";

let cached: { raw: string; value: { publicKey: PointStr | null; privateKey: string | null } } | null = null;

async function load() {
  const pubRaw = readProtocolEnv("ISSUER_PUBLIC_KEY");
  const privRaw = readProtocolEnv("ISSUER_PRIVATE_KEY");
  const raw = `${pubRaw ?? ""}|${privRaw ?? ""}`;
  if (cached && cached.raw === raw) return cached.value;

  let publicKey: PointStr | null = null;
  if (pubRaw) {
    const parts = pubRaw.split(",").map((s) => s.trim());
    if (parts.length !== 2 || !parts.every((p) => /^\d+$/.test(p)) || !(await isValidIssuerPublicKey([parts[0], parts[1]]))) {
      throw new Error(`${envLabel("ISSUER_PUBLIC_KEY")} is set but is not a valid BabyJubJub point "<x>,<y>".`);
    }
    publicKey = [parts[0], parts[1]];
  }

  let privateKey: string | null = null;
  if (privRaw) {
    let derived: PointStr;
    try {
      derived = await issuerPublicKey(privRaw);
    } catch {
      throw new Error(`${envLabel("ISSUER_PRIVATE_KEY")} is set but is not 32 bytes of hex.`);
    }
    if (publicKey && (derived[0] !== publicKey[0] || derived[1] !== publicKey[1])) {
      throw new Error(`${envLabel("ISSUER_PRIVATE_KEY")} does not match ${envLabel("ISSUER_PUBLIC_KEY")}.`);
    }
    publicKey = publicKey ?? derived;
    privateKey = privRaw.replace(/^0x/, "");
  }

  const value = { publicKey, privateKey };
  cached = { raw, value };
  return value;
}

/** The pinned issuer public key, or null if none is configured. */
export async function getIssuerPublicKey(): Promise<PointStr | null> {
  return (await load()).publicKey;
}

/** The demo issuer's signing key, or null when the demo issuer is off. */
export async function getDemoIssuerPrivateKey(): Promise<string | null> {
  return (await load()).privateKey;
}
