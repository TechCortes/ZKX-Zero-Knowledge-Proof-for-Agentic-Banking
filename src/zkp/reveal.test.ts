/**
 * Threshold reveal — crypto round-trip tests (no compiled circuit needed).
 *
 * The circuit-level tests (real kyc_reveal proofs) live in reveal-circuit.test.ts
 * and skip until the circuit artifacts exist.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  dealKeyShares,
  encryptForReveal,
  partialDecrypt,
  verifyPartial,
  combinePartials,
  ciphertextFromSignals,
  isValidRevealPublicKey,
  randomRevealNonce,
  REVEAL_SIGNALS,
  type ConsortiumKey,
  type KeyShare,
  type RevealCiphertext,
} from "./reveal";

const IDENTITY = { idHash: "123456789", birthYear: 1990, salt: "987654321" };
let commitment: string;
let consortium: ConsortiumKey;
let shares: KeyShare[];
let ct: RevealCiphertext;

beforeAll(async () => {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  commitment = poseidon.F.toString(poseidon([BigInt(IDENTITY.idHash), BigInt(IDENTITY.salt)]));
  ({ consortium, shares } = await dealKeyShares(3, 5));
  ct = await encryptForReveal(consortium.publicKey, IDENTITY, commitment, await randomRevealNonce());
});

describe("dealKeyShares", () => {
  it("produces a valid public key and one verification key per party", async () => {
    expect(await isValidRevealPublicKey(consortium.publicKey)).toBe(true);
    expect(shares).toHaveLength(5);
    expect(consortium.verificationKeys.map((v) => v.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects threshold > parties and threshold < 1", async () => {
    await expect(dealKeyShares(4, 3)).rejects.toThrow();
    await expect(dealKeyShares(0, 3)).rejects.toThrow();
  });
});

describe("threshold decryption", () => {
  it("any k partials recover the identity, and it matches the commitment", async () => {
    for (const subset of [[0, 1, 2], [2, 3, 4], [0, 2, 4], [4, 1, 3]]) {
      const partials = await Promise.all(subset.map((i) => partialDecrypt(shares[i], ct)));
      const out = await combinePartials(consortium, ct, partials);
      expect(out).toEqual({ ...IDENTITY, commitmentMatches: true });
    }
  });

  it("more than k partials also works", async () => {
    const partials = await Promise.all(shares.map((s) => partialDecrypt(s, ct)));
    expect((await combinePartials(consortium, ct, partials)).commitmentMatches).toBe(true);
  });

  it("k-1 partials are refused", async () => {
    const partials = await Promise.all(shares.slice(0, 2).map((s) => partialDecrypt(s, ct)));
    await expect(combinePartials(consortium, ct, partials)).rejects.toThrow(/Need 3/);
  });

  it("duplicate partials from one party don't count twice", async () => {
    const p = await partialDecrypt(shares[0], ct);
    const q = await partialDecrypt(shares[1], ct);
    await expect(combinePartials(consortium, ct, [p, p, q])).rejects.toThrow(/Need 3/);
  });

  it("a tampered partial is caught and the party is named", async () => {
    const partials = await Promise.all(shares.slice(0, 3).map((s) => partialDecrypt(s, ct)));
    const other = await partialDecrypt(shares[3], ct);
    partials[1] = { ...partials[1], partial: other.partial }; // party 2 lies
    expect(await verifyPartial(consortium, ct, partials[1])).toBe(false);
    await expect(combinePartials(consortium, ct, partials)).rejects.toThrow(/party 2/);
  });

  it("a partial made for one ciphertext doesn't verify against another", async () => {
    const ct2 = await encryptForReveal(consortium.publicKey, IDENTITY, commitment, await randomRevealNonce());
    const pd = await partialDecrypt(shares[0], ct);
    expect(await verifyPartial(consortium, ct, pd)).toBe(true);
    expect(await verifyPartial(consortium, ct2, pd)).toBe(false);
  });

  it("a share from another consortium is refused", async () => {
    const other = await dealKeyShares(2, 3);
    await expect(partialDecrypt(other.shares[0], ct)).rejects.toThrow(/different consortium/);
  });

  it("tampered ciphertext decrypts to garbage that fails the commitment check", async () => {
    const bad: RevealCiphertext = { ...ct, ciphertext: [String(BigInt(ct.ciphertext[0]) + BigInt(1)), ct.ciphertext[1], ct.ciphertext[2]] };
    const partials = await Promise.all(shares.slice(0, 3).map((s) => partialDecrypt(s, bad)));
    expect((await combinePartials(consortium, bad, partials)).commitmentMatches).toBe(false);
  });

  it("fresh nonces give unlinkable ciphertexts for the same identity", async () => {
    const ct2 = await encryptForReveal(consortium.publicKey, IDENTITY, commitment, await randomRevealNonce());
    expect(ct2.ephemeral).not.toEqual(ct.ephemeral);
    expect(ct2.ciphertext).not.toEqual(ct.ciphertext);
  });
});

describe("isValidRevealPublicKey", () => {
  it("rejects the identity point, off-curve points, and garbage", async () => {
    expect(await isValidRevealPublicKey(["0", "1"])).toBe(false);
    expect(await isValidRevealPublicKey(["1", "2"])).toBe(false);
    expect(await isValidRevealPublicKey(["x", "y"])).toBe(false);
  });
});

describe("ciphertextFromSignals", () => {
  it("maps the kyc_reveal signal layout", () => {
    const signals = Array.from({ length: REVEAL_SIGNALS.count }, (_, i) => String(i));
    expect(ciphertextFromSignals(signals)).toMatchObject({
      ephemeral: ["0", "1"],
      ciphertext: ["2", "3", "4"],
      commitment: "5",
      publicKey: ["8", "9"],
    });
  });

  it("rejects the wrong signal count", () => {
    expect(() => ciphertextFromSignals(["1", "2", "3"])).toThrow();
  });
});
