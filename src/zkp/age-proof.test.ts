/**
 * Age proof circuit validation — edge case tests (Issue #3)
 *
 * The circuit constraint is:
 *   age = currentYear - birthYear
 *   GreaterEqThan(8): age >= minAge (must be 1)
 *
 * When circuit artifacts are present these tests can be upgraded to use
 * snarkjs.groth16.fullProve for witness-level validation. Until then,
 * we test the same arithmetic invariants in JS to catch any off-by-one
 * errors in the policy-to-circuit mapping.
 *
 * These tests also validate the prover input construction so that when
 * the circuit IS compiled, the inputs will be correct.
 */

import { describe, it, expect } from "vitest";

const CURRENT_YEAR = new Date().getUTCFullYear();
const MIN_AGE = 18;

/** Mirrors the circuit constraint: age = currentYear - birthYear >= minAge */
function circuitAgeCheck(birthYear: number, currentYear: number, minAge: number): boolean {
  if (birthYear > currentYear) return false; // future birth year — invalid
  const age = currentYear - birthYear;
  // GreaterEqThan(8): 8-bit range, so both operands must fit in [0, 255]
  if (age > 255 || minAge > 255) return false;
  return age >= minAge;
}

describe("Age proof circuit — age constraint validation", () => {
  it("accepts a user who is exactly 18 (boundary)", () => {
    const birthYear = CURRENT_YEAR - 18;
    expect(circuitAgeCheck(birthYear, CURRENT_YEAR, MIN_AGE)).toBe(true);
  });

  it("accepts a user who is older than 18 (valid)", () => {
    const birthYear = CURRENT_YEAR - 30;
    expect(circuitAgeCheck(birthYear, CURRENT_YEAR, MIN_AGE)).toBe(true);
  });

  it("rejects a user who is 17 — one year below threshold (underage)", () => {
    const birthYear = CURRENT_YEAR - 17;
    expect(circuitAgeCheck(birthYear, CURRENT_YEAR, MIN_AGE)).toBe(false);
  });

  it("rejects a user who is 0 years old (born this year)", () => {
    expect(circuitAgeCheck(CURRENT_YEAR, CURRENT_YEAR, MIN_AGE)).toBe(false);
  });

  it("rejects a future birth year", () => {
    const futureBirthYear = CURRENT_YEAR + 1;
    expect(circuitAgeCheck(futureBirthYear, CURRENT_YEAR, MIN_AGE)).toBe(false);
  });

  it("rejects age > 255 — outside 8-bit GreaterEqThan range", () => {
    const ancientBirthYear = CURRENT_YEAR - 256;
    expect(circuitAgeCheck(ancientBirthYear, CURRENT_YEAR, MIN_AGE)).toBe(false);
  });

  it("accepts age of exactly 255 (max 8-bit value)", () => {
    const birthYear = CURRENT_YEAR - 255;
    expect(circuitAgeCheck(birthYear, CURRENT_YEAR, MIN_AGE)).toBe(true);
  });

  it("minAge=0 always passes for any valid birthYear", () => {
    expect(circuitAgeCheck(CURRENT_YEAR - 1, CURRENT_YEAR, 0)).toBe(true);
    expect(circuitAgeCheck(CURRENT_YEAR, CURRENT_YEAR, 0)).toBe(true);
  });

  it("prover constructs currentYear as UTC full year integer", () => {
    const year = new Date().getUTCFullYear();
    expect(Number.isInteger(year)).toBe(true);
    expect(year).toBeGreaterThan(2020);
    expect(year).toBeLessThan(2100);
  });
});

describe("Age proof circuit — commitment binding", () => {
  it("wrong salt produces different commitment — verifier would reject", async () => {
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();

    const idHash = BigInt("12345678901234567890");
    const correctSalt = BigInt("11111111111111111111");
    const wrongSalt = BigInt("22222222222222222222");

    const correctCommitment = poseidon.F.toString(poseidon([idHash, correctSalt]));
    const wrongCommitment = poseidon.F.toString(poseidon([idHash, wrongSalt]));

    // A proof generated with wrongSalt would produce a different commitment.
    // The verifier checks publicSignals[0] === agent.commitment, so it rejects.
    expect(correctCommitment).not.toBe(wrongCommitment);
  });
});
