import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { buildPoseidon } from "circomlibjs";
import {
  endorse,
  generateKemKey,
  generateSigningKey,
  makeApproverEntry,
  makeMemberEntry,
  makeRegulatorEntry,
  membersId,
  newRegistry,
  signerFromFile,
  type ConsortiumRegistry,
  type KemKeyFile,
} from "./keyRegistry";
import { buildRequest, hashLegalDocument, signApproval, signRequest, type SignedDisclosureRequest } from "./requests";
import {
  makeAccessToken,
  openDisclosure,
  openForMember,
  prepareDelivery,
  registryConsortiumKey,
  releaseShare,
  verifyPackage,
  type Delivery,
  type DisclosurePackage,
  type ShareRelease,
} from "./delivery";
import { openBox, sealTo } from "./sealedBox";
import { DISCLOSURE_AGENT_ID } from "./store";
import type { HybridSigner } from "@/lib/auditSigning";
import { storeRevealEscrow } from "@/policy/escrow";
import { getAuditLog } from "@/policy/auditLog";
import { ESCROW_KEYS_FORMAT, generateEscrowMemberKey, type EscrowMemberKey } from "@/zkp/escrowSeal";
import { dealKeyShares, encryptForReveal, randomRevealNonce, consortiumKeyFromVerificationKeys, type KeyShare } from "@/zkp/reveal";
import { POST as submit } from "@/app/api/v1/disclosure/requests/route";
import { GET as detail } from "@/app/api/v1/disclosure/requests/[requestHash]/route";
import { POST as approve } from "@/app/api/v1/disclosure/requests/[requestHash]/approvals/route";
import { GET as getPackage } from "@/app/api/v1/disclosure/requests/[requestHash]/package/route";
import { GET as getShares, POST as postShare } from "@/app/api/v1/disclosure/requests/[requestHash]/shares/route";
import { GET as getDeliveries, POST as postDelivery } from "@/app/api/v1/disclosure/requests/[requestHash]/deliveries/route";

const CID = "demo-consortium";
const T0 = "2026-01-01T00:00:00.000Z";
const BASE = "http://x/api/v1/disclosure/requests";
const identity = { idHash: "123456789", birthYear: 1990, salt: "987654321" };

let reg: ConsortiumRegistry;
let memberSigners: HybridSigner[];
let escrowKeys: EscrowMemberKey[];
let revealShares: KeyShare[];
let approverSigners: HybridSigner[];
let regSigner: HybridSigner;
let regKem: KemKeyFile;
let commitment: string;
let dir: string;

let n = 0;
const fresh = () => `zquent_d5_${Date.now()}_${++n}`;
const ctx = (requestHash: string) => ({ params: Promise.resolve({ requestHash }) });
const get = (url: string, auth?: string) => new NextRequest(url, auth ? { headers: { authorization: auth } } : undefined);
const post = (url: string, body: unknown) => new NextRequest(url, { method: "POST", body: JSON.stringify(body) });
const memberToken = (i: number, requestHash: string, action: "package" | "shares") =>
  makeAccessToken(memberSigners[i - 1], { party: "member", id: String(i), requestHash, action });

beforeAll(async () => {
  const { consortium, shares } = await dealKeyShares(2, 3);
  revealShares = shares;
  escrowKeys = [1, 2, 3].map(generateEscrowMemberKey);
  memberSigners = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  const members = [1, 2, 3].map((i) => makeMemberEntry(CID, {
    index: i, name: `Member ${i}`, kem: escrowKeys[i - 1].publicKey, signing: memberSigners[i - 1].publicKey,
    revealKey: consortium.verificationKeys[i - 1].publicKey,
  }, memberSigners[i - 1]));
  reg = newRegistry(CID, 2, 2, members);
  const endorsed = <T extends Parameters<typeof endorse>[2]>(kind: Parameters<typeof endorse>[1], e: T) =>
    [1, 2].reduce((acc, i) => endorse(reg, kind, acc, i, memberSigners[i - 1]), e);
  approverSigners = [1, 2].map(() => signerFromFile(generateSigningKey()));
  regSigner = signerFromFile(generateSigningKey());
  regKem = generateKemKey();
  reg = {
    ...reg,
    approvers: approverSigners.map((s, i) => endorsed("approver", makeApproverEntry(CID, { approverId: `approver-${i + 1}`, name: `Officer ${i + 1}`, role: "compliance", signing: s.publicKey, validFrom: T0 }, s))),
    regulators: [endorsed("regulator", makeRegulatorEntry(CID, { regulatorId: "demo-fiu", name: "Demo FIU", jurisdiction: "XX", signing: regSigner.publicKey, kem: regKem.publicKey, validFrom: T0 }, regSigner))],
  };

  const poseidon = await buildPoseidon();
  commitment = poseidon.F.toString(poseidon([BigInt(identity.idHash), BigInt(identity.salt)]));

  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zquent-d5-"));
  fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify(reg));
  process.env.ZQUENT_REGISTRY_FILE = path.join(dir, "registry.json");
  process.env.ZQUENT_REGISTRY_MEMBERS_ID = membersId(reg);
  process.env.ZQUENT_ESCROW_KEYS = JSON.stringify({ format: ESCROW_KEYS_FORMAT, threshold: 2, members: escrowKeys.map(({ index, publicKey }) => ({ index, publicKey })) });
  process.env.ZQUENT_DISCLOSURE_DAILY_LIMIT = "1000";
  void consortium;
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const k of ["ZQUENT_REGISTRY_FILE", "ZQUENT_REGISTRY_MEMBERS_ID", "ZQUENT_ESCROW_KEYS", "ZQUENT_DISCLOSURE_DAILY_LIMIT"]) delete process.env[k];
});

/** A sealed escrow record plus a submitted (not yet approved) request for it. */
async function submitted(): Promise<{ txId: string; signed: SignedDisclosureRequest; requestHash: string; ciphertextHash: string }> {
  const txId = fresh();
  const consortium = await registryConsortiumKey(reg);
  const ct = await encryptForReveal(consortium.publicKey, identity, commitment, await randomRevealNonce());
  const ref = await storeRevealEscrow({ txId, agentId: "target-agent", ciphertext: ct });
  expect(ref.sealed).toBe(true);
  const signed = signRequest(buildRequest({
    consortiumId: CID, regulatorId: "demo-fiu", txId,
    legalBasisHash: hashLegalDocument(Buffer.from("order")),
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  }), regSigner);
  const res = await submit(post(BASE, signed));
  expect(res.status).toBe(201);
  const body = await res.json();
  return { txId, signed, requestHash: body.requestHash, ciphertextHash: body.ciphertextHash };
}

async function approved() {
  const s = await submitted();
  for (const [i, signer] of approverSigners.entries()) {
    const r = await approve(post(`${BASE}/${s.requestHash}/approvals`, { approverId: `approver-${i + 1}`, signature: signApproval(s.requestHash, signer) }), ctx(s.requestHash));
    expect(r.status).toBe(201);
  }
  return s;
}

async function fetchPackage(i: number, h: string): Promise<DisclosurePackage> {
  const res = await getPackage(get(`${BASE}/${h}/package`, memberToken(i, h, "package")), ctx(h));
  expect(res.status).toBe(200);
  return res.json();
}

describe("sealed box", () => {
  it("opens only with the right key and context", () => {
    const k = generateKemKey();
    const box = sealTo(k.publicKey, Buffer.from("hello"), "ctx-a");
    expect(openBox(k.secretKey, box, "ctx-a").toString()).toBe("hello");
    expect(() => openBox(k.secretKey, box, "ctx-b")).toThrow(/did not open/);
    expect(() => openBox(generateKemKey().secretKey, box, "ctx-a")).toThrow(/did not open/);
  });
});

describe("consortium key from registry", () => {
  it("rebuilds the dealt public key and rejects inconsistent verification keys", async () => {
    const { consortium } = await dealKeyShares(2, 3);
    expect((await consortiumKeyFromVerificationKeys(2, 3, consortium.verificationKeys)).publicKey).toEqual(consortium.publicKey);
    const { consortium: other } = await dealKeyShares(2, 3);
    const mixed = [consortium.verificationKeys[0], consortium.verificationKeys[1], other.verificationKeys[2]];
    await expect(consortiumKeyFromVerificationKeys(2, 3, mixed)).rejects.toThrow(/inconsistent/);
  });
});

describe("disclosure delivery (D5) end to end", () => {
  it("members release and deliver; only the regulator reads the identity", async () => {
    const { txId, signed, requestHash: h, ciphertextHash } = await approved();

    // 1. Package: members only, and they re-check everything themselves.
    expect((await getPackage(get(`${BASE}/${h}/package`), ctx(h))).status).toBe(401);
    expect((await getPackage(get(`${BASE}/${h}/package`, memberToken(1, h, "shares")), ctx(h))).status).toBe(401);
    const regToken = makeAccessToken(regSigner, { party: "regulator", id: "demo-fiu", requestHash: h, action: "deliveries" });
    expect((await getPackage(get(`${BASE}/${h}/package`, regToken), ctx(h))).status).toBe(401);
    const pkg1 = await fetchPackage(1, h);
    const pkg3 = await fetchPackage(3, h);
    expect(verifyPackage(reg, pkg1)).toEqual([]);
    expect(pkg1.escrow.envelope).toBeDefined();
    expect(JSON.stringify(pkg1)).not.toContain(identity.idHash);

    // 2. Release: members 1 and 3 seal their escrow share parts to the others.
    for (const [i, pkg] of [[1, pkg1], [3, pkg3]] as const) {
      const rel = releaseShare(reg, pkg, escrowKeys[i - 1], memberSigners[i - 1]);
      expect((await postShare(post(`${BASE}/${h}/shares`, rel), ctx(h))).status).toBe(201);
      expect((await postShare(post(`${BASE}/${h}/shares`, rel), ctx(h))).status).toBe(409);
    }

    // 3. Deliver: each opens the envelope with own share + the other's, then delivers.
    const releases: ShareRelease[] = (await (await getShares(get(`${BASE}/${h}/shares`, memberToken(1, h, "shares")), ctx(h))).json()).releases;
    expect(releases.map((r) => r.from).sort()).toEqual([1, 3]);
    for (const [i, pkg] of [[1, pkg1], [3, pkg3]] as const) {
      const ct = openForMember(reg, pkg, escrowKeys[i - 1], releases);
      const d = await prepareDelivery(reg, pkg, ct, revealShares[i - 1], memberSigners[i - 1]);
      expect(JSON.stringify(d)).not.toContain(identity.idHash);
      const res = await postDelivery(post(`${BASE}/${h}/deliveries`, d), ctx(h));
      expect(res.status).toBe(201);
      expect((await res.json()).status).toBe(i === 1 ? "approved" : "delivered");
    }

    // 4. Open: regulator only.
    expect((await getDeliveries(get(`${BASE}/${h}/deliveries`, memberToken(1, h, "shares")), ctx(h))).status).toBe(401);
    const deliveries: Delivery[] = (await (await getDeliveries(get(`${BASE}/${h}/deliveries`, regToken), ctx(h))).json()).deliveries;
    expect(deliveries).toHaveLength(2);
    const out = await openDisclosure(reg, { request: signed.request, ciphertextHash }, deliveries, regKem.secretKey);
    expect(out).toMatchObject({ txId, idHash: identity.idHash, birthYear: identity.birthYear, salt: identity.salt, commitment, members: [1, 3] });

    // One delivery is not enough; someone else's KEM key can't open them.
    await expect(openDisclosure(reg, { request: signed.request, ciphertextHash }, deliveries.slice(0, 1), regKem.secretKey)).rejects.toThrow(/Need 2/);
    await expect(openDisclosure(reg, { request: signed.request, ciphertextHash }, deliveries, generateKemKey().secretKey)).rejects.toThrow(/did not open/);

    // Public view: delivered, member indices only; audit chain has hash-only receipts.
    const pub = await (await detail(get(`${BASE}/${h}`), ctx(h))).json();
    expect(pub.status).toBe("delivered");
    expect(pub.deliveries.map((d: { memberIndex: number }) => d.memberIndex).sort()).toEqual([1, 3]);
    expect(JSON.stringify(pub)).not.toContain(txId);
    const events = (await getAuditLog(DISCLOSURE_AGENT_ID)).filter((e) => e.disclosure?.requestHash === h).map((e) => e.decision);
    expect(events.filter((e) => e === "disclosure_share_released")).toHaveLength(2);
    expect(events.filter((e) => e === "disclosure_delivered")).toHaveLength(2);
    expect(JSON.stringify(await getAuditLog(DISCLOSURE_AGENT_ID))).not.toContain(identity.idHash);
  });

  it("nothing can be released or delivered before approval", async () => {
    const { requestHash: h } = await submitted();
    expect((await getPackage(get(`${BASE}/${h}/package`, memberToken(1, h, "package")), ctx(h))).status).toBe(409);
    expect((await postShare(post(`${BASE}/${h}/shares`, { requestHash: h }), ctx(h))).status).toBe(409);
  });

  it("members refuse bad inputs and the server refuses forged posts", async () => {
    const { requestHash: h } = await approved();
    const pkg = await fetchPackage(2, h);

    // Wrong signer / wrong share file.
    expect(() => releaseShare(reg, pkg, escrowKeys[1], memberSigners[0])).toThrow(/isn't member 2/);
    expect(() => releaseShare(reg, pkg, escrowKeys[0], memberSigners[1])).toThrow(/isn't member 1/);

    // A tampered package fails the member's own checks.
    const tampered = JSON.parse(JSON.stringify(pkg)) as DisclosurePackage;
    tampered.approvals = tampered.approvals.slice(0, 1);
    expect(verifyPackage(reg, tampered).join()).toMatch(/valid approvals/);
    tampered.ciphertextHash = "0".repeat(64);
    expect(verifyPackage(reg, tampered).join()).toMatch(/requestHash doesn't match/);

    // A release with a changed box, and a delivery with a forged receipt, are rejected.
    const rel = releaseShare(reg, pkg, escrowKeys[1], memberSigners[1]);
    const swapped = { ...rel, boxes: [rel.boxes[1], rel.boxes[0]].map((b, i) => ({ ...b, box: rel.boxes[1 - i].box })) };
    expect((await postShare(post(`${BASE}/${h}/shares`, swapped), ctx(h))).status).toBe(401);
    expect((await postShare(post(`${BASE}/${h}/shares`, rel), ctx(h))).status).toBe(201);

    // Not enough share parts yet: member 2 can't open alone.
    expect(() => openForMember(reg, pkg, escrowKeys[1], [])).toThrow(/2 needed/);

    const rel1 = releaseShare(reg, await fetchPackage(1, h), escrowKeys[0], memberSigners[0]);
    expect((await postShare(post(`${BASE}/${h}/shares`, rel1), ctx(h))).status).toBe(201);
    const ct = openForMember(reg, pkg, escrowKeys[1], [rel, rel1]);
    // Member 2 tries to deliver with member 1's reveal share: refused before anything is sent.
    await expect(prepareDelivery(reg, pkg, ct, revealShares[0], memberSigners[1])).rejects.toThrow(/isn't member 1/);
    const d = await prepareDelivery(reg, pkg, ct, revealShares[1], memberSigners[1]);
    const forgedReceipt = { ...d, signature: (await prepareDelivery(reg, pkg, ct, revealShares[1], memberSigners[1])).signature };
    expect((await postDelivery(post(`${BASE}/${h}/deliveries`, forgedReceipt), ctx(h))).status).toBe(401);
    expect((await postDelivery(post(`${BASE}/${h}/deliveries`, d), ctx(h))).status).toBe(201);
    expect((await postDelivery(post(`${BASE}/${h}/deliveries`, d), ctx(h))).status).toBe(409);
  });

  it("access tokens expire and can't be moved to another request", async () => {
    const { requestHash: h } = await approved();
    const old = makeAccessToken(memberSigners[0], { party: "member", id: "1", requestHash: h, action: "package" }, new Date(Date.now() - 10 * 60_000));
    expect((await getPackage(get(`${BASE}/${h}/package`, old), ctx(h))).status).toBe(401);
    const other = makeAccessToken(memberSigners[0], { party: "member", id: "1", requestHash: "f".repeat(64), action: "package" });
    expect((await getPackage(get(`${BASE}/${h}/package`, other), ctx(h))).status).toBe(401);
    const impostor = makeAccessToken(memberSigners[1], { party: "member", id: "1", requestHash: h, action: "package" });
    expect((await getPackage(get(`${BASE}/${h}/package`, impostor), ctx(h))).status).toBe(401);
  });
});
