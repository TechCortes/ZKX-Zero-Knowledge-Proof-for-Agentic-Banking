/**
 * Threshold reveal — verifier pinning + real kyc_reveal proofs.
 *
 * The "real proofs" block runs only once the circuit artifacts exist
 * (npm run compile-circuit:reveal, then the ceremony in docs/ceremony.md).
 * The signal-pinning tests always run.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { verifyKYCProof, checkChallengeSignals, commitmentFromSignals, txNonceFromSignals } from "./verifier";
import { dealKeyShares, partialDecrypt, combinePartials, type ConsortiumKey, type KeyShare } from "./reveal";
import { getRevealPublicKey } from "./revealConfig";
import { NULLIFIER_SCOPE, computeNullifier, type Credential } from "./credential";
import { TODAY, YEAR, ZK_DIR, credentialFor, makeIdentity, makeIssuer, proofInput, prove, type Identity } from "./proofFixtures";

const HAVE_REVEAL_CIRCUIT =
  fs.existsSync(path.join(ZK_DIR, "kyc_reveal_final.zkey")) &&
  fs.existsSync(path.join(ZK_DIR, "kyc_reveal_verification_key.json"));
const PK: [string, string] = ["11", "22"];
const ISSUER: [string, string] = ["5", "6"];

/**
 * [R.x, R.y, c0, c1, c2, nullifier, commitment, currentYear, minAge, PK.x, PK.y,
 *  txNonce, issuer.x, issuer.y, currentDay, nullifierScope]
 */
const revealSignals = (o: Partial<{ year: number; minAge: number; pk: [string, string] }> = {}) => [
  "1", "2", "3", "4", "5", "99", "777",
  String(o.year ?? YEAR), String(o.minAge ?? 18), ...(o.pk ?? PK), "42",
  ...ISSUER, String(TODAY), NULLIFIER_SCOPE,
];
const credentialSignals = ["99", "777", String(YEAR), "18", "42", ...ISSUER, String(TODAY), NULLIFIER_SCOPE];

describe("checkChallengeSignals — reveal mode", () => {
  const expect_ = { issuerKey: ISSUER, revealKey: PK };

  it("accepts a kyc_reveal layout encrypted to the configured key", () => {
    expect(checkChallengeSignals(revealSignals(), expect_)).toBeNull();
  });

  it("rejects a proof encrypted to any other key", () => {
    expect(checkChallengeSignals(revealSignals({ pk: ["11", "23"] }), expect_)).toMatch(/consortium key/);
  });

  it("rejects a plain kyc_credential proof when reveal is required", () => {
    expect(checkChallengeSignals(credentialSignals, expect_)).toMatch(/kyc_reveal/);
  });

  it("still pins minAge, currentYear and the issuer", () => {
    expect(checkChallengeSignals(revealSignals({ minAge: 0 }), expect_)).toMatch(/minAge/);
    expect(checkChallengeSignals(revealSignals({ year: YEAR + 5 }), expect_)).toMatch(/currentYear/);
    expect(checkChallengeSignals(revealSignals(), { ...expect_, issuerKey: ["5", "7"] })).toMatch(/issuer/);
  });

  it("reads the commitment from the right slot for each circuit", () => {
    expect(commitmentFromSignals(revealSignals(), PK)).toBe("777");
    expect(commitmentFromSignals(credentialSignals, null)).toBe("777");
  });

  it("reads the txNonce from the right slot for each circuit", () => {
    expect(txNonceFromSignals(revealSignals(), PK)).toBe("42");
    expect(txNonceFromSignals(credentialSignals, null)).toBe("42");
    expect(txNonceFromSignals(["777", String(YEAR), "18", "42"], null)).toBeUndefined();
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
  let issuer: Awaited<ReturnType<typeof makeIssuer>>;
  let alice: Identity;
  let cred: Credential;
  let consortium: ConsortiumKey;
  let shares: KeyShare[];

  const proveTo = (pk: [string, string], overrides: Record<string, unknown> = {}) =>
    prove("kyc_reveal", proofInput(alice, cred, overrides), pk);
  const expect_ = () => ({ issuerKey: issuer.publicKey, revealKey: consortium.publicKey, currentDay: TODAY });

  beforeAll(async () => {
    issuer = await makeIssuer();
    alice = await makeIdentity();
    cred = await credentialFor(issuer.privateKey, alice);
    ({ consortium, shares } = await dealKeyShares(2, 3));
  }, 60_000);

  it("proof verifies, and k consortium members can recover exactly the proven identity", async () => {
    const { proof, publicSignals } = await proveTo(consortium.publicKey);
    const res = await verifyKYCProof(proof, publicSignals, expect_());
    expect(res.valid).toBe(true);
    expect(res.commitment).toBe(alice.commitment);
    expect(res.txNonce).toBe("424242");
    expect(res.nullifier).toBe(await computeNullifier(alice.idHash, TODAY));

    const ct = res.revealCiphertext!;
    const partials = await Promise.all([partialDecrypt(shares[0], ct), partialDecrypt(shares[2], ct)]);
    expect(await combinePartials(consortium, ct, partials)).toEqual({
      idHash: alice.idHash, birthYear: alice.birthYear, salt: alice.salt, commitmentMatches: true,
    });
  }, 180_000);

  it("a valid proof encrypted to the prover's own key is rejected", async () => {
    const attacker = await dealKeyShares(1, 1);
    const { proof, publicSignals } = await proveTo(attacker.consortium.publicKey);
    const res = await verifyKYCProof(proof, publicSignals, expect_());
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/consortium key/);
  }, 180_000);

  it("swapping in a different ciphertext, txNonce or nullifier breaks the proof", async () => {
    const { proof, publicSignals } = await proveTo(consortium.publicKey);
    for (const slot of [2, 11, 5]) {
      const tampered = [...publicSignals];
      tampered[slot] = (BigInt(tampered[slot]) + BigInt(1)).toString();
      expect((await verifyKYCProof(proof, tampered, expect_())).valid).toBe(false);
    }
  }, 180_000);

  it("the witness can't be built for a key that isn't on the curve, or without a valid credential", async () => {
    await expect(proveTo(["1", "2"])).rejects.toThrow();
    await expect(proveTo(consortium.publicKey, { birthYear: alice.birthYear - 1 })).rejects.toThrow();
  }, 180_000);
});
