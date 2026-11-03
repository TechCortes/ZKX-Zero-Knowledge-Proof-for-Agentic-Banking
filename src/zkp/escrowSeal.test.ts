import { describe, it, expect, beforeAll } from "vitest";
import {
  ESCROW_KEYS_FORMAT,
  generateEscrowMemberKey,
  parseEscrowKeySet,
  sealEscrow,
  unsealEscrowShare,
  openEscrow,
  type EscrowKeySet,
  type EscrowMemberKey,
  type EscrowEnvelope,
} from "./escrowSeal";

let members: EscrowMemberKey[];
let keys: EscrowKeySet;
const plaintext = Buffer.from(JSON.stringify({ format: "vero-reveal/v1", commitment: "42", ciphertext: ["1", "2", "3"] }));
const hash = "ab".repeat(32);

beforeAll(() => {
  members = [1, 2, 3, 4, 5].map(generateEscrowMemberKey);
  keys = parseEscrowKeySet({
    format: ESCROW_KEYS_FORMAT,
    threshold: 3,
    members: members.map(({ index, publicKey }) => ({ index, publicKey })),
  });
});

const parts = (env: EscrowEnvelope, idx: number[]) => idx.map((i) => unsealEscrowShare(members[i - 1], env));

describe("vero-escrow/v2 — seal and open", () => {
  it("any k members can open it; the plaintext never appears in the envelope", () => {
    const env = sealEscrow(keys, "tx-1", plaintext, hash);
    expect(JSON.stringify(env)).not.toContain('"commitment"');
    for (const subset of [[1, 2, 3], [3, 4, 5], [1, 3, 5], [5, 2, 4]]) {
      expect(openEscrow(env, parts(env, subset)).equals(plaintext)).toBe(true);
    }
  });

  it("k-1 members can't", () => {
    const env = sealEscrow(keys, "tx-1", plaintext, hash);
    expect(() => openEscrow(env, parts(env, [1, 2]))).toThrow(/Need 3/);
    // The same member twice doesn't count twice.
    expect(() => openEscrow(env, [...parts(env, [1, 2]), ...parts(env, [2])])).toThrow(/Need 3/);
  });

  it("a member can't unseal with another member's key", () => {
    const env = sealEscrow(keys, "tx-1", plaintext, hash);
    const wrong = { ...members[1], index: 1 }; // member 2's secret key, claiming slot 1
    expect(() => unsealEscrowShare(wrong, env)).toThrow(/did not decrypt/);
  });

  it("rejects an envelope whose header was altered", () => {
    const env = sealEscrow(keys, "tx-1", plaintext, hash);
    const altered = { ...env, ciphertextHash: "cd".repeat(32) };
    expect(() => unsealEscrowShare(members[0], altered)).toThrow(/did not decrypt/);
    // Shares unsealed from the real envelope don't open a re-labelled one either.
    const good = parts(env, [1, 2, 3]);
    expect(() => openEscrow({ ...env, txId: "tx-2" }, good)).toThrow(/different envelope/);
  });

  it("rejects a tampered body or a forged share part", () => {
    const env = sealEscrow(keys, "tx-1", plaintext, hash);
    const body = Buffer.from(env.body.data, "base64");
    body[0] ^= 1;
    expect(() => openEscrow({ ...env, body: { ...env.body, data: body.toString("base64") } }, parts(env, [1, 2, 3]))).toThrow(/did not decrypt/);

    const forged = parts(env, [1, 2, 3]);
    forged[2] = { ...forged[2], share: "00".repeat(66) };
    expect(() => openEscrow(env, forged)).toThrow(/did not decrypt|valid key/);
  });

  it("shares from one envelope don't open another", () => {
    const a = sealEscrow(keys, "tx-a", plaintext, hash);
    const b = sealEscrow(keys, "tx-a", plaintext, hash); // same txId, fresh key
    expect(() => openEscrow(b, parts(a, [1, 2, 3]))).toThrow(/did not decrypt|valid key/);
  });
});

describe("escrow key set validation", () => {
  const pub = () => members.map(({ index, publicKey }) => ({ index, publicKey }));

  it("rejects bad thresholds, duplicate indices and short keys", () => {
    expect(() => parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold: 6, members: pub() })).toThrow(/threshold/);
    expect(() => parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold: 0, members: pub() })).toThrow(/threshold/);
    const dup = pub();
    dup[1] = { ...dup[1], index: 1 };
    expect(() => parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold: 2, members: dup })).toThrow(/indices/);
    const short = pub();
    short[0] = { ...short[0], publicKey: "AAAA" };
    expect(() => parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold: 2, members: short })).toThrow(/X-Wing/);
    expect(() => parseEscrowKeySet({ format: "other", threshold: 2, members: pub() })).toThrow(/format/);
  });

  it("drops secret keys if a member file is pasted in by mistake", () => {
    const ks = parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold: 2, members });
    expect(JSON.stringify(ks)).not.toContain(members[0].secretKey);
  });
});
