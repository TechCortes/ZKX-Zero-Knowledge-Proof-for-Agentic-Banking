import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
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
} from "./keyRegistry";
import {
  approvalDigest,
  buildRequest,
  checkSignedRequest,
  computeRequestHash,
  hashLegalDocument,
  signApproval,
  signRequest,
  tallyApprovals,
  type Approval,
  type DisclosureRequest,
} from "./requests";
import { DISCLOSURE_AGENT_ID } from "./store";
import { generateEscrowMemberKey } from "@/zkp/escrowSeal";
import type { HybridSigner } from "@/lib/auditSigning";
import { storeRevealEscrow } from "@/policy/escrow";
import { getAuditLog } from "@/policy/auditLog";
import type { RevealCiphertext } from "@/zkp/reveal";
import { POST as submit, GET as list } from "@/app/api/v1/disclosure/requests/route";
import { GET as detail } from "@/app/api/v1/disclosure/requests/[requestHash]/route";
import { POST as approve } from "@/app/api/v1/disclosure/requests/[requestHash]/approvals/route";

const CID = "demo-consortium";
const T0 = "2026-01-01T00:00:00.000Z";
const HOUR = 3600_000;

let reg: ConsortiumRegistry;
let regSigner: HybridSigner;
let approverSigners: HybridSigner[];
let outsider: HybridSigner;
let dir: string;

let n = 0;
const fresh = (p: string) => `${p}-${Date.now()}-${++n}`;
const ct = (commitment: string): RevealCiphertext => ({
  format: "vero-reveal/v1", commitment, publicKey: ["1", "2"], ephemeral: ["3", "4"], ciphertext: ["5", "6", "7"],
});
const legal = hashLegalDocument(Buffer.from("Court order 2026-123"));
const inHours = (h: number, from = Date.now()) => new Date(from + h * HOUR).toISOString();
const newRequest = (txId: string, over: Partial<DisclosureRequest> = {}): DisclosureRequest => ({
  ...buildRequest({ consortiumId: CID, regulatorId: "demo-fiu", txId, legalBasisHash: legal, expiresAt: inHours(24) }),
  ...over,
});

const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = (requestHash: string) => ({ params: Promise.resolve({ requestHash }) });
const BASE = "http://x/api/v1/disclosure/requests";

async function escrowed(): Promise<{ txId: string; ciphertextHash: string }> {
  const txId = fresh("tx");
  const ref = await storeRevealEscrow({ txId, agentId: "target-agent", ciphertext: ct(txId) });
  return { txId, ciphertextHash: ref.ciphertextHash };
}

beforeAll(() => {
  const memberSigners = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  const members = [1, 2, 3].map((i) =>
    makeMemberEntry(CID, { index: i, name: `Member ${i}`, kem: generateEscrowMemberKey(i).publicKey, signing: memberSigners[i - 1].publicKey }, memberSigners[i - 1]),
  );
  reg = newRegistry(CID, 2, 2, members);
  const endorsed = <T extends Parameters<typeof endorse>[2]>(kind: Parameters<typeof endorse>[1], e: T) =>
    [1, 2].reduce((acc, i) => endorse(reg, kind, acc, i, memberSigners[i - 1]), e);

  approverSigners = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  const approvers = approverSigners.map((s, i) =>
    endorsed("approver", makeApproverEntry(CID, { approverId: `approver-${i + 1}`, name: `Officer ${i + 1}`, role: "compliance", signing: s.publicKey, validFrom: T0 }, s)),
  );
  regSigner = signerFromFile(generateSigningKey());
  const regulator = endorsed("regulator", makeRegulatorEntry(CID, {
    regulatorId: "demo-fiu", name: "Demo FIU", jurisdiction: "XX", signing: regSigner.publicKey, kem: generateKemKey().publicKey, validFrom: T0,
  }, regSigner));
  reg = { ...reg, approvers, regulators: [regulator] };
  outsider = signerFromFile(generateSigningKey());

  dir = fs.mkdtempSync(path.join(os.tmpdir(), "vero-disclosure-"));
  fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify(reg));
});

function enable() {
  process.env.VERO_REGISTRY_FILE = path.join(dir, "registry.json");
  process.env.VERO_REGISTRY_MEMBERS_ID = membersId(reg);
}

afterEach(() => {
  delete process.env.VERO_REGISTRY_FILE;
  delete process.env.VERO_REGISTRY_MEMBERS_ID;
  delete process.env.VERO_DISCLOSURE_DAILY_LIMIT;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("vero-disclosure-request/v1 (pure)", () => {
  it("accepts a fresh request signed by the registered regulator", () => {
    expect(checkSignedRequest(reg, signRequest(newRequest("tx1"), regSigner))).toEqual({ ok: true });
  });

  it("rejects a bad signature, an unknown regulator and a foreign consortium", () => {
    expect(checkSignedRequest(reg, signRequest(newRequest("tx1"), outsider))).toMatchObject({ ok: false, status: 401 });
    expect(checkSignedRequest(reg, signRequest(newRequest("tx1", { regulatorId: "nobody" }), regSigner))).toMatchObject({ ok: false, status: 403 });
    expect(checkSignedRequest(reg, signRequest(newRequest("tx1", { consortiumId: "other" }), regSigner))).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects tampering after signing", () => {
    const signed = signRequest(newRequest("tx1"), regSigner);
    signed.request.txId = "tx2";
    expect(checkSignedRequest(reg, signed)).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects stale, expired, too-long and malformed requests", () => {
    const now = Date.now();
    const stale = newRequest("tx1", { issuedAt: inHours(-1, now) });
    expect(checkSignedRequest(reg, signRequest(stale, regSigner))).toMatchObject({ status: 422 });
    const long = newRequest("tx1", { expiresAt: inHours(31 * 24, now) });
    expect(checkSignedRequest(reg, signRequest(long, regSigner))).toMatchObject({ status: 422 });
    const past = newRequest("tx1", { expiresAt: inHours(-0.01, now) });
    expect(checkSignedRequest(reg, signRequest(past, regSigner))).toMatchObject({ status: 422 });
    const extra = { ...newRequest("tx1"), note: "hi" } as DisclosureRequest;
    expect(checkSignedRequest(reg, signRequest(extra, regSigner))).toMatchObject({ status: 422 });
    expect(checkSignedRequest(reg, { request: newRequest("tx1"), signature: "nope" })).toMatchObject({ status: 422 });
    expect(checkSignedRequest(reg, null)).toMatchObject({ status: 422 });
  });

  it("requestHash changes with every bound field, including the ciphertext", () => {
    const r = newRequest("tx1");
    const h = computeRequestHash(r, "a".repeat(64));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(computeRequestHash(r, "b".repeat(64))).not.toBe(h);
    for (const f of ["consortiumId", "regulatorId", "txId", "legalBasisHash", "expiresAt", "nonce"] as const) {
      expect(computeRequestHash({ ...r, [f]: r[f] + "0" }, "a".repeat(64))).not.toBe(h);
    }
    // Length prefixes: moving a character between fields changes the hash.
    expect(computeRequestHash({ ...r, consortiumId: "ab", regulatorId: "c" }, "a".repeat(64)))
      .not.toBe(computeRequestHash({ ...r, consortiumId: "a", regulatorId: "bc" }, "a".repeat(64)));
  });

  it("tally counts distinct valid approvers before expiry only", () => {
    const h = "c".repeat(64);
    const expiresAt = inHours(1);
    const at = new Date().toISOString();
    const a = (i: number, signer = approverSigners[i - 1], approvedAt = at): Approval =>
      ({ approverId: `approver-${i}`, signature: signApproval(h, signer), approvedAt });

    expect(tallyApprovals(reg, h, expiresAt, [a(1)]).approved).toBe(false);
    expect(tallyApprovals(reg, h, expiresAt, [a(1), a(1)]).approved).toBe(false);
    expect(tallyApprovals(reg, h, expiresAt, [a(1), a(2)])).toMatchObject({ approved: true, valid: ["approver-1", "approver-2"] });
    const forged = tallyApprovals(reg, h, expiresAt, [a(1), a(2, outsider)]);
    expect(forged.approved).toBe(false);
    expect(forged.invalid[0].approverId).toBe("approver-2");
    expect(tallyApprovals(reg, h, expiresAt, [a(1), a(2, approverSigners[1], inHours(2))]).approved).toBe(false);
    // An approval for one request can't be reused for another.
    expect(tallyApprovals(reg, "d".repeat(64), expiresAt, [a(1), a(2)]).approved).toBe(false);
    expect(() => approvalDigest("xyz")).toThrow();
  });
});

describe("disclosure request API", () => {
  it("is off (503) without a registry, and 500 when the registry is unpinned", async () => {
    expect((await list(new NextRequest(BASE))).status).toBe(503);
    process.env.VERO_REGISTRY_FILE = path.join(dir, "registry.json");
    expect((await list(new NextRequest(BASE))).status).toBe(500);
    process.env.VERO_REGISTRY_MEMBERS_ID = "0".repeat(64);
    expect((await list(new NextRequest(BASE))).status).toBe(500);
  });

  it("submit → approve → approve reaches approved, and the public view never shows the txId", async () => {
    enable();
    const { txId, ciphertextHash } = await escrowed();
    const signed = signRequest(newRequest(txId), regSigner);

    const res = await submit(post(BASE, signed));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ status: "pending", ciphertextHash, approvalThreshold: 2, approvals: [] });
    const h: string = created.requestHash;
    expect(h).toBe(computeRequestHash(signed.request, ciphertextHash)); // approvers can recompute it

    // Replay
    expect((await submit(post(BASE, signed))).status).toBe(409);

    // Bad approvals
    const url = `${BASE}/${h}/approvals`;
    expect((await approve(post(url, { approverId: "approver-1", signature: signApproval(h, outsider) }), params(h))).status).toBe(401);
    expect((await approve(post(url, { approverId: "ghost", signature: signApproval(h, outsider) }), params(h))).status).toBe(401);
    expect((await approve(post(url, { approverId: "approver-1" }), params(h))).status).toBe(422);
    expect((await approve(post(`${BASE}/${"e".repeat(64)}/approvals`, { approverId: "approver-1", signature: signApproval("e".repeat(64), approverSigners[0]) }), params("e".repeat(64)))).status).toBe(404);

    const first = await approve(post(url, { approverId: "approver-1", signature: signApproval(h, approverSigners[0]) }), params(h));
    expect(first.status).toBe(201);
    expect((await first.json()).status).toBe("pending");
    expect((await approve(post(url, { approverId: "approver-1", signature: signApproval(h, approverSigners[0]) }), params(h))).status).toBe(409);

    const second = await approve(post(url, { approverId: "approver-2", signature: signApproval(h, approverSigners[1]) }), params(h));
    expect(second.status).toBe(201);
    const done = await second.json();
    expect(done.status).toBe("approved");
    expect(done.approvals.map((a: { approverId: string }) => a.approverId).sort()).toEqual(["approver-1", "approver-2"]);

    const one = await (await detail(new NextRequest(`${BASE}/${h}`), params(h))).json();
    expect(one.status).toBe("approved");
    const all = await (await list(new NextRequest(BASE))).json();
    expect(all.requests.some((r: { requestHash: string }) => r.requestHash === h)).toBe(true);
    for (const view of [one, all]) {
      const s = JSON.stringify(view);
      expect(s).not.toContain(txId);
      expect(s).not.toContain(ciphertextHash);
      expect(s).not.toContain(legal);
    }

    // Audit chain: events under system:disclosure with only the hash; nothing in the target agent's view.
    const events = await getAuditLog(DISCLOSURE_AGENT_ID);
    const mine = events.filter((e) => e.disclosure?.requestHash === h).map((e) => e.decision);
    expect(mine.sort()).toEqual(["disclosure_approval", "disclosure_approval", "disclosure_approved", "disclosure_requested"]);
    expect(JSON.stringify(events)).not.toContain(txId);
    expect(JSON.stringify(await getAuditLog("target-agent"))).not.toContain(h);
  });

  it("404s when the transaction has no escrowed identity", async () => {
    enable();
    expect((await submit(post(BASE, signRequest(newRequest(fresh("missing")), regSigner)))).status).toBe(404);
  });

  it("rejects unsigned or badly signed submissions before touching the rate limit", async () => {
    enable();
    const { txId } = await escrowed();
    process.env.VERO_DISCLOSURE_DAILY_LIMIT = "1000";
    expect((await submit(post(BASE, signRequest(newRequest(txId), outsider)))).status).toBe(401);
    expect((await submit(post(BASE, { request: newRequest(txId) }))).status).toBe(422);
    expect((await submit(new NextRequest(BASE, { method: "POST", body: "not json" }))).status).toBe(422);
  });

  it("enforces the per-regulator daily limit", async () => {
    enable();
    process.env.VERO_DISCLOSURE_DAILY_LIMIT = "1";
    const { txId } = await escrowed();
    // Earlier tests already used this regulator's slot for today.
    expect((await submit(post(BASE, signRequest(newRequest(txId), regSigner)))).status).toBe(429);
  });

  it("rejects approvals on an expired request with 410", async () => {
    enable();
    const { txId } = await escrowed();
    // Short-lived request; submit, then pretend time has passed by checking a request that expires immediately.
    const r = newRequest(txId, { expiresAt: new Date(Date.now() + 1500).toISOString() });
    const res = await submit(post(BASE, signRequest(r, regSigner)));
    expect(res.status).toBe(201);
    const h = (await res.json()).requestHash;
    await new Promise((ok) => setTimeout(ok, 1600));
    const late = await approve(post(`${BASE}/${h}/approvals`, { approverId: "approver-1", signature: signApproval(h, approverSigners[0]) }), params(h));
    expect(late.status).toBe(410);
    expect((await (await detail(new NextRequest(`${BASE}/${h}`), params(h))).json()).status).toBe("expired");
  });
});
