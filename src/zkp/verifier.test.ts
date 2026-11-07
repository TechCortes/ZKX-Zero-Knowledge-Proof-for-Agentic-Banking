/**
 * Verifier tests — real Groth16 proofs against the committed kyc_credential artifacts.
 *
 * The key property: a proof is only valid for the public inputs the prover chose, so the
 * verifier must pin currentYear, minAge, the issuer key, the day and the nullifier scope.
 * Otherwise a prover can self-select minAge=0, sign their own credential, or pick a day
 * to get a fresh nullifier.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { verifyKYCProof, checkChallengeSignals, REQUIRED_MIN_AGE } from "./verifier";
import { NULLIFIER_SCOPE, computeNullifier, type Credential } from "./credential";
import {
  TODAY, YEAR, credentialFor, makeIdentity, makeIssuer, proofInput, prove, type Identity,
} from "./proofFixtures";

const ISSUER: [string, string] = ["5", "6"];

/** [nullifier, commitment, currentYear, minAge, txNonce, issuer.x, issuer.y, currentDay, nullifierScope] */
const signals = (o: Partial<{ year: number; minAge: number; issuer: [string, string]; day: number; scope: string }> = {}) => [
  "99", "777", String(o.year ?? YEAR), String(o.minAge ?? REQUIRED_MIN_AGE), "42",
  ...(o.issuer ?? ISSUER), String(o.day ?? TODAY), o.scope ?? NULLIFIER_SCOPE,
];

describe("checkChallengeSignals", () => {
  const ok = { issuerKey: ISSUER };

  it("accepts the server's year, minAge, issuer, day and scope", () => {
    expect(checkChallengeSignals(signals(), ok)).toBeNull();
  });

  it("tolerates the previous year (New Year UTC boundary)", () => {
    expect(checkChallengeSignals(signals({ year: YEAR - 1 }), ok)).toBeNull();
  });

  it("rejects minAge below the requirement", () => {
    expect(checkChallengeSignals(signals({ minAge: 0 }), ok)).toMatch(/minAge/);
    expect(checkChallengeSignals(signals({ minAge: 17 }), ok)).toMatch(/minAge/);
  });

  it("rejects a fabricated future year", () => {
    expect(checkChallengeSignals(signals({ year: YEAR + 8 }), ok)).toMatch(/currentYear/);
  });

  it("rejects a credential from any other issuer", () => {
    expect(checkChallengeSignals(signals({ issuer: ["5", "7"] }), ok)).toMatch(/issuer/);
  });

  it("rejects everything when no issuer is configured (fails closed)", () => {
    expect(checkChallengeSignals(signals(), { issuerKey: null })).toMatch(/No credential issuer/);
  });

  it("pins the day to the challenge's, or today/yesterday without one", () => {
    expect(checkChallengeSignals(signals({ day: TODAY - 1 }), ok)).toBeNull();
    expect(checkChallengeSignals(signals({ day: TODAY - 2 }), ok)).toMatch(/currentDay/);
    expect(checkChallengeSignals(signals({ day: TODAY + 1 }), ok)).toMatch(/currentDay/);
    expect(checkChallengeSignals(signals({ day: TODAY - 1 }), { ...ok, currentDay: TODAY })).toMatch(/currentDay/);
  });

  it("rejects another server's nullifier scope", () => {
    expect(checkChallengeSignals(signals({ scope: "1" }), ok)).toMatch(/nullifierScope/);
  });

  it("rejects the wrong number of public signals, including the pre-credential layout", () => {
    expect(checkChallengeSignals(["1"], ok)).not.toBeNull();
    expect(checkChallengeSignals(["1", String(YEAR), "18", "42"], ok)).toMatch(/issuer-signed/);
    expect(checkChallengeSignals([...signals(), "x"], ok)).not.toBeNull();
  });
});

describe("verifyKYCProof — real proofs", () => {
  let issuer: Awaited<ReturnType<typeof makeIssuer>>;
  let alice: Identity;
  let cred: Credential;
  let good: Awaited<ReturnType<typeof prove>>;

  beforeAll(async () => {
    issuer = await makeIssuer();
    alice = await makeIdentity();
    cred = await credentialFor(issuer.privateKey, alice);
    good = await prove("kyc_credential", proofInput(alice, cred));
  }, 120_000);

  const expect_ = () => ({ issuerKey: issuer.publicKey, currentDay: TODAY });

  it("accepts a valid proof and returns the person's nullifier for today", async () => {
    const res = await verifyKYCProof(good.proof, good.publicSignals, expect_());
    expect(res.valid).toBe(true);
    expect(res.commitment).toBe(alice.commitment);
    expect(res.txNonce).toBe("424242");
    expect(res.nullifier).toBe(await computeNullifier(alice.idHash, TODAY));
  });

  it("gives one person the same nullifier across agents (different salts), and a new one tomorrow", async () => {
    const aliceAgent2 = await makeIdentity(alice.idHash, "5555", alice.birthYear);
    const other = await prove("kyc_credential", proofInput(aliceAgent2, cred));
    const res = await verifyKYCProof(other.proof, other.publicSignals, expect_());
    expect(res.valid).toBe(true);
    expect(res.commitment).not.toBe(alice.commitment);
    expect(res.nullifier).toBe(await computeNullifier(alice.idHash, TODAY));
    expect(await computeNullifier(alice.idHash, TODAY + 1)).not.toBe(res.nullifier);
  }, 120_000);

  it("rejects a valid proof whose txNonce or nullifier was swapped", async () => {
    const swapped = [...good.publicSignals];
    swapped[4] = "999999";
    expect((await verifyKYCProof(good.proof, swapped, expect_())).valid).toBe(false);
    const nulled = [...good.publicSignals];
    nulled[0] = "12345";
    expect((await verifyKYCProof(good.proof, nulled, expect_())).valid).toBe(false);
  });

  it("rejects a tampered proof", async () => {
    const bad = JSON.parse(JSON.stringify(good.proof));
    bad.pi_a[0] = (BigInt(bad.pi_a[0]) + BigInt(1)).toString();
    expect((await verifyKYCProof(bad, good.publicSignals, expect_())).valid).toBe(false);
  });

  it("rejects a valid proof of a self-signed credential", async () => {
    const forger = await makeIssuer();
    const fake = await credentialFor(forger.privateKey, alice);
    const p = await prove("kyc_credential", proofInput(alice, fake));
    const res = await verifyKYCProof(p.proof, p.publicSignals, expect_());
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/issuer/);
  }, 120_000);

  it("rejects valid proofs of weaker statements (minAge=0, fabricated year)", async () => {
    const minor = await makeIdentity("2222", "3333", YEAR);
    const minorCred = await credentialFor(issuer.privateKey, minor);
    const p1 = await prove("kyc_credential", proofInput(minor, minorCred, { minAge: 0 }));
    expect((await verifyKYCProof(p1.proof, p1.publicSignals, expect_())).error).toMatch(/minAge/);
    const p2 = await prove("kyc_credential", proofInput(minor, minorCred, { currentYear: YEAR + 18 }));
    expect((await verifyKYCProof(p2.proof, p2.publicSignals, expect_())).error).toMatch(/currentYear/);
  }, 120_000);

  describe("the witness can't be built when", () => {
    it("the birth year differs from the one the issuer signed", async () => {
      await expect(prove("kyc_credential", proofInput(alice, cred, { birthYear: alice.birthYear - 20 }))).rejects.toThrow();
    }, 120_000);

    it("the credential claims the real issuer's key but was signed by someone else", async () => {
      const forger = await makeIssuer();
      const fake = await credentialFor(forger.privateKey, alice);
      await expect(prove("kyc_credential", proofInput(alice, fake, { issuerPubKey: issuer.publicKey }))).rejects.toThrow();
    }, 120_000);

    it("the credential has expired", async () => {
      const old = await credentialFor(issuer.privateKey, alice, TODAY);
      await expect(prove("kyc_credential", proofInput(alice, old, { currentDay: TODAY + 1 }))).rejects.toThrow();
    }, 120_000);

    it("the holder is underage", async () => {
      const minor = await makeIdentity("2222", "3333", YEAR - 17);
      const minorCred = await credentialFor(issuer.privateKey, minor);
      await expect(prove("kyc_credential", proofInput(minor, minorCred))).rejects.toThrow();
    }, 120_000);
  });
});
