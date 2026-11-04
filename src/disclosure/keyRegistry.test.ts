import { describe, it, expect, beforeAll } from "vitest";
import {
  REGISTRY_FORMAT,
  activeApprovers,
  activeRegulator,
  disclosureReadiness,
  endorse,
  entryDigest,
  generateKemKey,
  generateSigningKey,
  makeApproverEntry,
  makeMemberEntry,
  makeRegulatorEntry,
  makeRevocation,
  membersId,
  newRegistry,
  parseRegistry,
  registryId,
  signerFromFile,
  verifyRegistry,
  type ConsortiumRegistry,
  type RegulatorEntry,
} from "./keyRegistry";
import { ESCROW_KEYS_FORMAT, generateEscrowMemberKey, parseEscrowKeySet } from "@/zkp/escrowSeal";
import { signerFromSeed, type HybridSigner } from "@/lib/auditSigning";

const CID = "demo-consortium";
const T0 = "2026-01-01T00:00:00.000Z";

let memberSigners: HybridSigner[];
let escrowKeys: ReturnType<typeof parseEscrowKeySet>;
let base: ConsortiumRegistry;
let regulator: RegulatorEntry;
let regSigner: HybridSigner;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function endorsedBy<T extends Parameters<typeof endorse>[2]>(reg: ConsortiumRegistry, kind: Parameters<typeof endorse>[1], entry: T, idx: number[]): T {
  return idx.reduce((e, i) => endorse(reg, kind, e, i, memberSigners[i - 1]), entry);
}

beforeAll(() => {
  const kemKeys = [1, 2, 3].map(generateEscrowMemberKey);
  memberSigners = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  escrowKeys = parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold: 2, members: kemKeys.map(({ index, publicKey }) => ({ index, publicKey })) });
  const members = kemKeys.map((k, i) =>
    makeMemberEntry(CID, { index: k.index, name: `Demo member ${k.index}`, kem: k.publicKey, signing: memberSigners[i].publicKey }, memberSigners[i]),
  );
  base = newRegistry(CID, 2, 2, members);

  const approvers = [1, 2].map((i) => {
    const s = signerFromFile(generateSigningKey());
    return endorsedBy(base, "approver", makeApproverEntry(CID, { approverId: `approver-${i}`, name: `Officer ${i}`, role: "compliance", signing: s.publicKey, validFrom: T0 }, s), [1, 2]);
  });
  regSigner = signerFromFile(generateSigningKey());
  regulator = endorsedBy(
    base,
    "regulator",
    makeRegulatorEntry(CID, { regulatorId: "demo-fiu", name: "Demo FIU", jurisdiction: "XX", signing: regSigner.publicKey, kem: generateKemKey().publicKey, validFrom: T0 }, regSigner),
    [1, 3],
  );
  base = { ...base, approvers, regulators: [regulator] };
});

describe("vero-registry/v1", () => {
  it("a correctly built registry verifies and is ready for disclosure", () => {
    expect(verifyRegistry(base, { escrowKeys })).toEqual([]);
    const reg = parseRegistry(base);
    expect(reg.format).toBe(REGISTRY_FORMAT);
    expect(disclosureReadiness(reg)).toEqual([]);
    expect(activeRegulator(reg, "demo-fiu")?.name).toBe("Demo FIU");
    expect(activeApprovers(reg)).toHaveLength(2);
  });

  it("a regulator with fewer than k member endorsements is rejected", () => {
    const reg = clone(base);
    reg.regulators[0].endorsements = reg.regulators[0].endorsements.slice(0, 1);
    expect(verifyRegistry(reg).join()).toMatch(/1 valid member endorsements; needs 2/);
  });

  it("the same member can't count twice", () => {
    const reg = clone(base);
    const e = reg.regulators[0].endorsements[0];
    reg.regulators[0].endorsements = [e, e];
    expect(verifyRegistry(reg).join()).toMatch(/endorsed twice/);
  });

  it("changing any field of an endorsed entry breaks its signatures", () => {
    const reg = clone(base);
    reg.regulators[0].kem = generateKemKey().publicKey; // swap the delivery key
    const errs = verifyRegistry(reg).join();
    expect(errs).toMatch(/self-signature doesn't verify/);
    expect(errs).toMatch(/endorsement by member \d doesn't verify/);
  });

  it("endorsements don't transfer to another consortium", () => {
    const reg = clone(base);
    reg.consortiumId = "other-consortium";
    expect(verifyRegistry(reg).length).toBeGreaterThan(0);
  });

  it("signatures are bound to the entry kind", () => {
    const r = regulator;
    expect(Buffer.from(entryDigest(CID, "regulator", r)).equals(Buffer.from(entryDigest(CID, "approver", r)))).toBe(false);
  });

  it("only a member's registered key can endorse as that member", () => {
    const outsider = signerFromFile(generateSigningKey());
    expect(() => endorse(base, "regulator", regulator, 1, outsider)).toThrow(/registered key/);
  });

  it("nobody can register someone else's signing key (proof of possession)", () => {
    const victim = regSigner.publicKey;
    const attacker = signerFromFile(generateSigningKey());
    expect(() =>
      makeRegulatorEntry(CID, { regulatorId: "fake", name: "Fake", jurisdiction: "XX", signing: victim, kem: generateKemKey().publicKey, validFrom: T0 }, attacker),
    ).toThrow(/signer's own key/);
  });

  it("a k-endorsed revocation deactivates a regulator from revokedAt on", () => {
    const rev = endorsedBy(base, "revocation", makeRevocation({ kind: "regulator", id: "demo-fiu", keyId: regulator.signing.keyId, revokedAt: "2026-06-01T00:00:00.000Z", reason: "key compromise" }), [2, 3]);
    const reg = parseRegistry({ ...base, revocations: [rev] });
    expect(activeRegulator(reg, "demo-fiu", new Date("2026-05-31T00:00:00Z"))).not.toBeNull();
    expect(activeRegulator(reg, "demo-fiu", new Date("2026-06-02T00:00:00Z"))).toBeNull();
    expect(disclosureReadiness(reg, new Date("2026-06-02T00:00:00Z"))).toContain("No active regulator.");
  });

  it("a revocation with one endorsement is rejected", () => {
    const rev = endorsedBy(base, "revocation", makeRevocation({ kind: "regulator", id: "demo-fiu", keyId: regulator.signing.keyId, revokedAt: T0, reason: "x" }), [2]);
    expect(verifyRegistry({ ...base, revocations: [rev] }).join()).toMatch(/needs 2/);
  });

  it("validity windows are respected", () => {
    expect(activeRegulator(base, "demo-fiu", new Date("2025-12-31T00:00:00Z"))).toBeNull();
  });

  it("not enough approvers means not ready", () => {
    expect(disclosureReadiness({ ...base, approvers: base.approvers.slice(0, 1) })[0]).toMatch(/1 active approvers/);
  });

  it("cross-checks the members' X-Wing keys against ZQUENT_ESCROW_KEYS", () => {
    const other = parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold: 2, members: [1, 2, 3].map(generateEscrowMemberKey).map(({ index, publicKey }) => ({ index, publicKey })) });
    expect(verifyRegistry(base, { escrowKeys: other }).join()).toMatch(/don't match ZQUENT_ESCROW_KEYS/);
  });

  it("membersId is stable when regulators are added; registryId is not", () => {
    const bare = { ...base, regulators: [] };
    expect(membersId(bare)).toBe(membersId(base));
    expect(registryId(bare)).not.toBe(registryId(base));
    expect(verifyRegistry(base, { pinnedMembersId: membersId(base) })).toEqual([]);
    expect(verifyRegistry(base, { pinnedMembersId: "00".repeat(32) }).join()).toMatch(/pinned membersId/);
  });

  it("registry signing keys are separate from the audit key for the same seed", () => {
    const seed = Buffer.alloc(32, 7).toString("base64");
    expect(signerFromFile({ format: "vero-signing-key/v1", seed, publicKey: undefined as never }).publicKey.keyId).not.toBe(signerFromSeed(seed).publicKey.keyId);
  });

  it("a non-member signing key reused by a regulator is caught", () => {
    const reg = clone(base);
    reg.regulators[0].signing = reg.approvers[0].signing;
    expect(verifyRegistry(reg).join()).toMatch(/reuses the signing key/);
  });
});
