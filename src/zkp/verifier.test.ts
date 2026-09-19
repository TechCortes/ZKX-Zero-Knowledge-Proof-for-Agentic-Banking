/**
 * Verifier tests — real Groth16 proofs against the committed circuit artifacts.
 *
 * The key property: a proof is only valid for the public inputs the prover chose, so the
 * verifier must pin currentYear and minAge. Otherwise a prover can self-select minAge=0.
 */

import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { verifyKYCProof, checkChallengeSignals, REQUIRED_MIN_AGE } from "./verifier";

const ZK_DIR = path.join(process.cwd(), "public", "zk");
const YEAR = new Date().getUTCFullYear();
const SECRET = { idHash: "123456789", salt: "987654321" };

async function prove(overrides: { birthYear: number; currentYear: number; minAge: number }) {
  const snarkjs = await import("snarkjs");
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const commitment = poseidon.F.toString(poseidon([BigInt(SECRET.idHash), BigInt(SECRET.salt)]));
  return snarkjs.groth16.fullProve(
    { ...SECRET, commitment, ...overrides },
    path.join(ZK_DIR, "kyc_credential.wasm"),
    path.join(ZK_DIR, "kyc_credential_final.zkey")
  );
}

describe("checkChallengeSignals", () => {
  it("accepts current year and required minAge", () => {
    expect(checkChallengeSignals(["1", String(YEAR), String(REQUIRED_MIN_AGE)])).toBeNull();
  });

  it("tolerates the previous year (New Year UTC boundary)", () => {
    expect(checkChallengeSignals(["1", String(YEAR - 1), "18"])).toBeNull();
  });

  it("rejects minAge below the requirement", () => {
    expect(checkChallengeSignals(["1", String(YEAR), "0"])).not.toBeNull();
    expect(checkChallengeSignals(["1", String(YEAR), "17"])).not.toBeNull();
  });

  it("rejects a fabricated future year", () => {
    expect(checkChallengeSignals(["1", String(YEAR + 8), "18"])).not.toBeNull();
  });

  it("rejects the wrong number of public signals", () => {
    expect(checkChallengeSignals(["1"])).not.toBeNull();
    expect(checkChallengeSignals(["1", String(YEAR), "18", "x"])).not.toBeNull();
  });
});

describe("verifyKYCProof — real proofs", () => {
  let good: Awaited<ReturnType<typeof prove>>;
  let underageMinAge0: Awaited<ReturnType<typeof prove>>;
  let fakeYear: Awaited<ReturnType<typeof prove>>;

  beforeAll(async () => {
    good = await prove({ birthYear: YEAR - 30, currentYear: YEAR, minAge: 18 });
    // Attacks: a valid proof of a *weaker* statement than the server requires.
    underageMinAge0 = await prove({ birthYear: YEAR, currentYear: YEAR, minAge: 0 });
    fakeYear = await prove({ birthYear: 2015, currentYear: 2033, minAge: 18 });
  }, 60_000);

  it("accepts a valid proof for age >= 18", async () => {
    const res = await verifyKYCProof(good.proof, good.publicSignals);
    expect(res.valid).toBe(true);
    expect(res.commitment).toBe(good.publicSignals[0]);
  });

  it("rejects a tampered proof", async () => {
    const bad = JSON.parse(JSON.stringify(good.proof));
    bad.pi_a[0] = (BigInt(bad.pi_a[0]) + BigInt(1)).toString();
    const res = await verifyKYCProof(bad, good.publicSignals);
    expect(res.valid).toBe(false);
  });

  it("rejects a valid proof made with minAge=0 (underage self-certification)", async () => {
    const res = await verifyKYCProof(underageMinAge0.proof, underageMinAge0.publicSignals);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/minAge/);
  });

  it("rejects a valid proof made with a fabricated currentYear", async () => {
    const res = await verifyKYCProof(fakeYear.proof, fakeYear.publicSignals);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/currentYear/);
  });
});
