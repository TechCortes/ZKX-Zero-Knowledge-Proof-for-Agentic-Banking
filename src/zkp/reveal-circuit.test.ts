/**
 * Threshold reveal — verifier pinning + real kyc_reveal proofs.
 *
 * The "real proofs" block runs only once the circuit artifacts exist
 * (npm run compile-circuit:reveal && npm run setup-zk:reveal). The signal-pinning
 * tests always run.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { verifyKYCProof, checkChallengeSignals, commitmentFromSignals } from "./verifier";
import { dealKeyShares, partialDecrypt, combinePartials, randomRevealNonce, type ConsortiumKey, type KeyShare } from "./reveal";
import { getRevealPublicKey } from "./revealConfig";

const ZK_DIR = path.join(process.cwd(), "public", "zk");
const HAVE_REVEAL_CIRCUIT =
  fs.existsSync(path.join(ZK_DIR, "kyc_reveal_final.zkey")) &&
  fs.existsSync(path.join(ZK_DIR, "kyc_reveal_verification_key.json"));
const YEAR = new Date().getUTCFullYear();
const PK: [string, string] = ["11", "22"];

/** [R.x, R.y, c0, c1, c2, commitment, currentYear, minAge, PK.x, PK.y] */
const revealSignals = (o: Partial<{ year: number; minAge: number; pk: [string, string] }> = {}) => [
  "1", "2", "3", "4", "5", "777",
  String(o.year ?? YEAR), String(o.minAge ?? 18), ...(o.pk ?? PK),
];

describe("checkChallengeSignals — reveal mode", () => {
  it("accepts a kyc_reveal layout encrypted to the configured key", () => {
    expect(checkChallengeSignals(revealSignals(), new Date(), PK)).toBeNull();
  });

  it("rejects a proof encrypted to any other key", () => {
    expect(checkChallengeSignals(revealSignals({ pk: ["11", "23"] }), new Date(), PK)).toMatch(/consortium key/);
  });

  it("rejects a plain kyc_credential proof when reveal is required", () => {
    expect(checkChallengeSignals(["777", String(YEAR), "18"], new Date(), PK)).toMatch(/kyc_reveal/);
  });

  it("still pins minAge and currentYear", () => {
    expect(checkChallengeSignals(revealSignals({ minAge: 0 }), new Date(), PK)).toMatch(/minAge/);
    expect(checkChallengeSignals(revealSignals({ year: YEAR + 5 }), new Date(), PK)).toMatch(/currentYear/);
  });

  it("reads the commitment from the right slot for each circuit", () => {
    expect(commitmentFromSignals(revealSignals(), PK)).toBe("777");
    expect(commitmentFromSignals(["777", String(YEAR), "18"], null)).toBe("777");
  });
});

describe("getRevealPublicKey", () => {
  it("is off when unset, and throws (fails closed) when set to garbage", async () => {
    const prev = process.env.VERO_REVEAL_PUBLIC_KEY;
    try {
      delete process.env.VERO_REVEAL_PUBLIC_KEY;
      expect(await getRevealPublicKey()).toBeNull();
      process.env.VERO_REVEAL_PUBLIC_KEY = "1,2";
      await expect(getRevealPublicKey()).rejects.toThrow(/not a valid/);
      const { consortium } = await dealKeyShares(1, 1);
      process.env.VERO_REVEAL_PUBLIC_KEY = consortium.publicKey.join(",");
      expect(await getRevealPublicKey()).toEqual(consortium.publicKey);
    } finally {
      if (prev === undefined) delete process.env.VERO_REVEAL_PUBLIC_KEY;
      else process.env.VERO_REVEAL_PUBLIC_KEY = prev;
    }
  });
});

describe.skipIf(!HAVE_REVEAL_CIRCUIT)("kyc_reveal — real proofs", () => {
  const SECRET = { idHash: "123456789", salt: "987654321", birthYear: YEAR - 30 };
  let consortium: ConsortiumKey;
  let shares: KeyShare[];
  let commitment: string;

  async function prove(pk: [string, string], overrides: Record<string, unknown> = {}) {
    const snarkjs = await import("snarkjs");
    return snarkjs.groth16.fullProve(
      {
        ...SECRET, commitment, currentYear: YEAR, minAge: 18,
        revealNonce: await randomRevealNonce(), revealPubKey: pk, ...overrides,
      },
      path.join(ZK_DIR, "kyc_reveal.wasm"),
      path.join(ZK_DIR, "kyc_reveal_final.zkey")
    );
  }

  beforeAll(async () => {
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();
    commitment = poseidon.F.toString(poseidon([BigInt(SECRET.idHash), BigInt(SECRET.salt)]));
    ({ consortium, shares } = await dealKeyShares(2, 3));
  }, 60_000);

  it("proof verifies, and k consortium members can recover exactly the proven identity", async () => {
    const { proof, publicSignals } = await prove(consortium.publicKey);
    const res = await verifyKYCProof(proof, publicSignals, { revealPublicKey: consortium.publicKey });
    expect(res.valid).toBe(true);
    expect(res.commitment).toBe(commitment);

    const ct = res.revealCiphertext!;
    const partials = await Promise.all([partialDecrypt(shares[0], ct), partialDecrypt(shares[2], ct)]);
    expect(await combinePartials(consortium, ct, partials)).toEqual({
      idHash: SECRET.idHash, birthYear: SECRET.birthYear, salt: SECRET.salt, commitmentMatches: true,
    });
  }, 120_000);

  it("a valid proof encrypted to the prover's own key is rejected", async () => {
    const attacker = await dealKeyShares(1, 1);
    const { proof, publicSignals } = await prove(attacker.consortium.publicKey);
    const res = await verifyKYCProof(proof, publicSignals, { revealPublicKey: consortium.publicKey });
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/consortium key/);
  }, 120_000);

  it("swapping in a different ciphertext breaks the proof", async () => {
    const { proof, publicSignals } = await prove(consortium.publicKey);
    const tampered = [...publicSignals];
    tampered[2] = (BigInt(tampered[2]) + BigInt(1)).toString();
    const res = await verifyKYCProof(proof, tampered, { revealPublicKey: consortium.publicKey });
    expect(res.valid).toBe(false);
  }, 120_000);

  it("the witness can't be built for a key that isn't on the curve", async () => {
    await expect(prove(["1", "2"])).rejects.toThrow();
  }, 120_000);
});
