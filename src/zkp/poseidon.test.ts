/**
 * Poseidon commitment tests (Issue #2)
 *
 * Verifies the JS-side Poseidon implementation used by the prover
 * produces the same commitment the circom circuit would compute.
 *
 * The circuit constraint is:
 *   commitment === Poseidon(idHash, salt)
 *
 * If the JS and circom implementations diverge, proofs will silently fail
 * verification. These tests catch that at the unit level.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { buildPoseidon } from "circomlibjs";
import { deriveCommitment } from "./prover";

type PoseidonFn = {
  (inputs: bigint[]): Uint8Array;
  F: { toString: (e: Uint8Array) => string };
};

let poseidon: PoseidonFn;

beforeAll(async () => {
  poseidon = await buildPoseidon();
});

function poseidonHash(a: bigint, b: bigint): string {
  const out = poseidon([a, b]);
  return poseidon.F.toString(out);
}

describe("Poseidon commitment — JS vs circuit parity", () => {
  it("produces the same commitment from identical inputs", async () => {
    const idHash = "12345678901234567890";
    const salt = "98765432109876543210";

    const jsCommitment = await deriveCommitment({ idHash, birthYear: 1990, salt });
    const directCommitment = poseidonHash(BigInt(idHash), BigInt(salt));

    expect(jsCommitment).toBe(directCommitment);
  });

  it("produces different commitments for different salts (binding)", async () => {
    const idHash = "11111111111111111111";
    const commitment1 = await deriveCommitment({ idHash, birthYear: 1990, salt: "1000000" });
    const commitment2 = await deriveCommitment({ idHash, birthYear: 1990, salt: "2000000" });
    expect(commitment1).not.toBe(commitment2);
  });

  it("produces different commitments for different idHashes (binding)", async () => {
    const salt = "99999999999999999999";
    const commitment1 = await deriveCommitment({ idHash: "11111111111111111111", birthYear: 1990, salt });
    const commitment2 = await deriveCommitment({ idHash: "22222222222222222222", birthYear: 1990, salt });
    expect(commitment1).not.toBe(commitment2);
  });

  it("is deterministic — same inputs always produce same commitment", async () => {
    const secret = { idHash: "55555555555555555555", birthYear: 1985, salt: "77777777777777777777" };
    const c1 = await deriveCommitment(secret);
    const c2 = await deriveCommitment(secret);
    expect(c1).toBe(c2);
  });

  it("commitment is a decimal field element string (circom public signal format)", async () => {
    const commitment = await deriveCommitment({
      idHash: "12345678901234567890",
      birthYear: 1990,
      salt: "98765432109876543210",
    });
    // Must be a decimal string (no 0x prefix) — matches circom public signal format
    expect(commitment).toMatch(/^\d+$/);
    // Must fit in BN128 scalar field (~254 bits, so < 77 decimal digits)
    expect(commitment.length).toBeLessThan(80);
  });

  it("birthYear does not affect commitment (it is not an input to Poseidon)", async () => {
    const base = { idHash: "12345678901234567890", salt: "98765432109876543210" };
    const c1 = await deriveCommitment({ ...base, birthYear: 1990 });
    const c2 = await deriveCommitment({ ...base, birthYear: 2000 });
    // Commitment only hashes idHash+salt, so birthYear must not change it
    expect(c1).toBe(c2);
  });
});
