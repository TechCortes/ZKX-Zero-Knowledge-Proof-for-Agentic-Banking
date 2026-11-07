import { describe, it, expect, afterEach } from "vitest";
import {
  CREDENTIAL_FORMAT,
  computeNullifier,
  credentialRequestError,
  epochDay,
  generateIssuerPrivateKey,
  issueCredential,
  issuerPublicKey,
  verifyCredential,
} from "./credential";
import { getDemoIssuerPrivateKey, getIssuerPublicKey } from "./issuerConfig";

describe("credentials", () => {
  it("issues a credential that verifies, and only for its own issuer", async () => {
    const sk = generateIssuerPrivateKey();
    const cred = await issueCredential(sk, { idHash: "123", birthYear: 1990 });
    expect(cred.format).toBe(CREDENTIAL_FORMAT);
    expect(cred.issuer.demo).toBe(true);
    expect(cred.issuer.publicKey).toEqual(await issuerPublicKey(sk));
    expect(cred.subject.expiryDay).toBeGreaterThan(epochDay());
    expect(await verifyCredential(cred)).toBe(true);
    expect(await verifyCredential(cred, cred.issuer.publicKey)).toBe(true);
    const other = await issuerPublicKey(generateIssuerPrivateKey());
    expect(await verifyCredential(cred, other)).toBe(false);
  });

  it("rejects a credential whose subject was edited after signing", async () => {
    const cred = await issueCredential(generateIssuerPrivateKey(), { idHash: "123", birthYear: 1990 });
    expect(await verifyCredential({ ...cred, subject: { ...cred.subject, birthYear: 1980 } })).toBe(false);
    expect(await verifyCredential({ ...cred, subject: { ...cred.subject, expiryDay: cred.subject.expiryDay + 1 } })).toBe(false);
  });

  it("validates requests", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(credentialRequestError({ idHash: "1", birthYear: 1990 }, now)).toBeNull();
    expect(credentialRequestError({ idHash: "0x12", birthYear: 1990 }, now)).toMatch(/idHash/);
    expect(credentialRequestError({ idHash: "1", birthYear: 2027 }, now)).toMatch(/birthYear/);
    expect(credentialRequestError({ idHash: "1", birthYear: 1800 }, now)).toMatch(/birthYear/);
    expect(credentialRequestError({ idHash: "1", birthYear: 1990, expiryDay: epochDay(now) - 1 }, now)).toMatch(/expiryDay/);
  });

  it("nullifier: same person and day → same value; any change → different", async () => {
    const a = await computeNullifier("123", 20000);
    expect(await computeNullifier("123", 20000)).toBe(a);
    expect(await computeNullifier("124", 20000)).not.toBe(a);
    expect(await computeNullifier("123", 20001)).not.toBe(a);
    expect(await computeNullifier("123", 20000, "1")).not.toBe(a);
  });
});

describe("issuer config", () => {
  const saved = { pub: process.env.ZQUENT_ISSUER_PUBLIC_KEY, priv: process.env.ZQUENT_ISSUER_PRIVATE_KEY };
  afterEach(() => {
    for (const [k, v] of [["ZQUENT_ISSUER_PUBLIC_KEY", saved.pub], ["ZQUENT_ISSUER_PRIVATE_KEY", saved.priv]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("is off when unset; derives the public key from a private key", async () => {
    delete process.env.ZQUENT_ISSUER_PUBLIC_KEY;
    delete process.env.ZQUENT_ISSUER_PRIVATE_KEY;
    expect(await getIssuerPublicKey()).toBeNull();
    expect(await getDemoIssuerPrivateKey()).toBeNull();
    const sk = generateIssuerPrivateKey();
    process.env.ZQUENT_ISSUER_PRIVATE_KEY = sk;
    expect(await getIssuerPublicKey()).toEqual(await issuerPublicKey(sk));
    expect(await getDemoIssuerPrivateKey()).toBe(sk);
  });

  it("pins a public key on its own (real issuer, demo issuer off)", async () => {
    delete process.env.ZQUENT_ISSUER_PRIVATE_KEY;
    const pk = await issuerPublicKey(generateIssuerPrivateKey());
    process.env.ZQUENT_ISSUER_PUBLIC_KEY = pk.join(",");
    expect(await getIssuerPublicKey()).toEqual(pk);
    expect(await getDemoIssuerPrivateKey()).toBeNull();
  });

  it("throws (fails closed) on garbage or a mismatched pair", async () => {
    process.env.ZQUENT_ISSUER_PUBLIC_KEY = "1,2";
    await expect(getIssuerPublicKey()).rejects.toThrow(/not a valid/);
    process.env.ZQUENT_ISSUER_PUBLIC_KEY = (await issuerPublicKey(generateIssuerPrivateKey())).join(",");
    process.env.ZQUENT_ISSUER_PRIVATE_KEY = generateIssuerPrivateKey();
    await expect(getIssuerPublicKey()).rejects.toThrow(/does not match/);
    delete process.env.ZQUENT_ISSUER_PUBLIC_KEY;
    process.env.ZQUENT_ISSUER_PRIVATE_KEY = "nothex";
    await expect(getIssuerPublicKey()).rejects.toThrow(/32 bytes/);
  });
});
