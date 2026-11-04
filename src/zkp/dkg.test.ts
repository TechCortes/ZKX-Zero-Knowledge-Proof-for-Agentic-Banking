import { describe, it, expect, beforeAll } from "vitest";
import { buildPoseidon } from "circomlibjs";
import { generateSigningKey, makeMemberEntry, newRegistry, signerFromFile, type ConsortiumRegistry } from "@/disclosure/keyRegistry";
import { registryConsortiumKey } from "@/disclosure/delivery";
import { sealTo } from "@/disclosure/sealedBox";
import type { HybridSigner } from "@/lib/auditSigning";
import { generateEscrowMemberKey, type EscrowMemberKey } from "./escrowSeal";
import { combinePartials, encryptForReveal, partialDecrypt, randomRevealNonce } from "./reveal";
import {
  dkgDeal,
  dkgDealDigest,
  dkgFinalize,
  dkgSessionId,
  dkgShareContext,
  newDkgSession,
  verifyDkgTranscript,
  type DkgDeal,
  type DkgSecret,
  type DkgSession,
} from "./dkg";

const CID = "demo-consortium";
let reg: ConsortiumRegistry;
let signers: HybridSigner[];
let kems: EscrowMemberKey[];

beforeAll(() => {
  signers = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  kems = [1, 2, 3].map(generateEscrowMemberKey);
  reg = newRegistry(CID, 2, 2, [1, 2, 3].map((i) =>
    makeMemberEntry(CID, { index: i, name: `Member ${i}`, kem: kems[i - 1].publicKey, signing: signers[i - 1].publicKey }, signers[i - 1])));
});

async function dealAll(session: DkgSession) {
  const out = await Promise.all([1, 2, 3].map((i) => dkgDeal(reg, session, i, signers[i - 1])));
  return { deals: out.map((o) => o.deal), secrets: out.map((o) => o.secret) };
}

describe("vero-dkg/v1", () => {
  it("three members make a 2-of-3 key nobody ever held, and it decrypts", async () => {
    const session = newDkgSession(reg);
    const { deals, secrets } = await dealAll(session);
    const done = await Promise.all([1, 2, 3].map((i) => dkgFinalize(reg, session, deals, secrets[i - 1], kems[i - 1], signers[i - 1])));

    // Everyone agrees on the key; the transcript proves it.
    const pk = done[0].consortium.publicKey;
    for (const d of done) expect(d.consortium.publicKey).toEqual(pk);
    const verified = await verifyDkgTranscript(reg, { session, deals, results: done.map((d) => d.result) });
    expect(verified.publicKey).toEqual(pk);
    expect(verified.verificationKeys).toEqual(done[0].consortium.verificationKeys);

    // The registry, once members add their reveal keys, rebuilds the same key (what D5 uses).
    const withReveal: ConsortiumRegistry = {
      ...reg,
      members: reg.members.map((m) => ({ ...m, revealKey: verified.verificationKeys.find((v) => v.index === m.index)!.publicKey })),
    };
    expect((await registryConsortiumKey(withReveal)).publicKey).toEqual(pk);

    // Encrypt to the DKG key; any two shares decrypt, one doesn't.
    const poseidon = await buildPoseidon();
    const identity = { idHash: "123456789", birthYear: 1990, salt: "987654321" };
    const commitment = poseidon.F.toString(poseidon([BigInt(identity.idHash), BigInt(identity.salt)]));
    const ct = await encryptForReveal(pk, identity, commitment, await randomRevealNonce());
    const shares = done.map((d) => d.keyShare);
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
      const out = await combinePartials(verified, ct, [await partialDecrypt(shares[a], ct), await partialDecrypt(shares[b], ct)]);
      expect(out).toMatchObject({ idHash: identity.idHash, birthYear: identity.birthYear, commitmentMatches: true });
    }
    await expect(combinePartials(verified, ct, [await partialDecrypt(shares[0], ct)])).rejects.toThrow(/Need 2/);
  });

  it("a dealer whose share doesn't match its commitments is named, and finalize refuses", async () => {
    const session = newDkgSession(reg);
    const { deals, secrets } = await dealAll(session);
    const sid = dkgSessionId(session);
    const bad: DkgDeal = JSON.parse(JSON.stringify(deals[0]));
    const i = bad.boxes.findIndex((b) => b.to === 2);
    bad.boxes[i] = { to: 2, box: sealTo(kems[1].publicKey, Buffer.from("12345"), dkgShareContext(sid, 1, 2)) };
    bad.signature = signers[0].sign(dkgDealDigest(bad)); // validly signed, but a wrong share
    await expect(dkgFinalize(reg, session, [bad, deals[1], deals[2]], secrets[1], kems[1], signers[1])).rejects.toThrow(/Member 1's share to you doesn't match/);
  });

  it("refuses missing deals, foreign sessions, forged deals and tampered transcripts", async () => {
    const session = newDkgSession(reg);
    const { deals, secrets } = await dealAll(session);
    await expect(dkgFinalize(reg, session, deals.slice(0, 2), secrets[0], kems[0], signers[0])).rejects.toThrow(/Missing deals from member 3/);

    const other = newDkgSession(reg);
    await expect(dkgFinalize(reg, other, deals, secrets[0], kems[0], signers[0])).rejects.toThrow(/different session/);

    const forged: DkgDeal = { ...deals[2], commitments: [...deals[1].commitments] };
    await expect(dkgFinalize(reg, session, [deals[0], deals[1], forged], secrets[0], kems[0], signers[0])).rejects.toThrow(/not signed/);

    await expect(dkgDeal(reg, session, 1, signers[1])).rejects.toThrow(/isn't member 1/);
    const stranger = { ...session, members: session.members.map((m) => (m.index === 3 ? { ...m, signingKeyId: "0000" } : m)) };
    await expect(dkgDeal(reg, stranger, 1, signers[0])).rejects.toThrow(/member 3 doesn't match/);

    const done = await Promise.all([1, 2, 3].map((i) => dkgFinalize(reg, session, deals, secrets[i - 1] as DkgSecret, kems[i - 1], signers[i - 1])));
    const results = done.map((d) => d.result);
    await expect(verifyDkgTranscript(reg, { session, deals, results: results.slice(0, 2) })).rejects.toThrow(/No signed result from member 3/);
    const lying = { ...results[1], publicKey: done[0].consortium.verificationKeys[0].publicKey };
    lying.signature = signers[1].sign(new Uint8Array(32)); // re-signing doesn't help: digest mismatch
    await expect(verifyDkgTranscript(reg, { session, deals, results: [results[0], lying, results[2]] })).rejects.toThrow(/not signed/);
  });
});
