/**
 * ZQUENT — disclosure CLI (ROADMAP D4 + D5). See docs/disclosure-requests.md and
 * docs/disclosure-delivery.md.
 *
 *   npm run disclosure -- request --registry registry.json --regulator-id demo-fiu --sign-key ./fiu/signing.key.json \
 *                                 --tx-id <txId> --legal-doc order.pdf [--expires-in-days 7] --out signed.json
 *   npm run disclosure -- submit  --url https://host signed.json --out bundle.json
 *   npm run disclosure -- check   --registry registry.json [--legal-doc order.pdf] bundle.json
 *   npm run disclosure -- approve --registry registry.json --approver-id approver-1 --sign-key ./a1/signing.key.json \
 *                                 [--legal-doc order.pdf] [--url https://host] bundle.json
 *   npm run disclosure -- status  --url https://host <requestHash>
 *   npm run disclosure -- release --url https://host --registry registry.json --member 1 --sign-key m1/signing.key.json \
 *                                 --escrow-key member-1.key.json <requestHash>
 *   npm run disclosure -- deliver --url https://host --registry registry.json --member 1 --sign-key m1/signing.key.json \
 *                                 --escrow-key member-1.key.json --reveal-share share-1.json <requestHash>
 *   npm run disclosure -- receive --url https://host --registry registry.json --sign-key fiu/signing.key.json \
 *                                 --kem-key fiu/kem.key.json bundle.json [--out identity.json]
 *   npm run disclosure -- demo
 */

import fs from "fs";
import os from "os";
import path from "path";
import {
  REGISTRY_FORMAT,
  SIGNING_KEY_FORMAT,
  endorse,
  generateKemKey,
  generateSigningKey,
  makeApproverEntry,
  makeMemberEntry,
  makeRegulatorEntry,
  membersId,
  newRegistry,
  parseRegistry,
  signerFromFile,
  type ConsortiumRegistry,
  type SigningKeyFile,
} from "../src/disclosure/keyRegistry";
import {
  buildRequest,
  checkSignedRequest,
  computeRequestHash,
  hashLegalDocument,
  signApproval,
  signRequest,
  type SignedDisclosureRequest,
} from "../src/disclosure/requests";
import { ESCROW_KEYS_FORMAT, generateEscrowMemberKey, type EscrowMemberKey } from "../src/zkp/escrowSeal";
import { REVEAL_FORMAT, dealKeyShares, encryptForReveal, randomRevealNonce, type KeyShare } from "../src/zkp/reveal";
import {
  makeAccessToken,
  openDisclosure,
  openForMember,
  prepareDelivery,
  releaseShare,
  verifyPackage,
  type Delivery,
  type DisclosurePackage,
  type ShareRelease,
} from "../src/disclosure/delivery";
import { readProtocolEnv } from "../src/lib/env";

const USAGE = `Usage: npm run disclosure -- <command> [options]

Commands:
  request  --registry <file> --regulator-id <id> --sign-key <file> --tx-id <txId>
           --legal-doc <file> [--expires-in-days <n, default 7, max 30>] --out <file>
           Regulator: write and sign a request. The legal document stays on your machine;
           only its SHA3-256 goes in the request. Submit within 5 minutes.

  submit   --url <base url> <signed request> --out <bundle file>
           Regulator: send it. The bundle (request + ciphertextHash + requestHash) is what
           you hand to the approvers, together with the legal document.

  check    --registry <file> [--legal-doc <file>] <bundle>
           Approver: verify the regulator's signature, recompute requestHash, and (with
           --legal-doc) check the document matches legalBasisHash.

  approve  --registry <file> --approver-id <id> --sign-key <file> [--legal-doc <file>]
           [--url <base url>] <bundle>
           Approver: run check, then sign. With --url the approval is posted; without, printed.

  status   --url <base url> <requestHash>

  Once a request is approved (D5):

  release  --url <base> --registry <file> --member <i> --sign-key <file> --escrow-key <member-i.key.json> <requestHash>
           Member: download the package, re-check the request and approvals yourself, then
           unseal your escrow share and seal it to the other members. Round 1.

  deliver  --url <base> --registry <file> --member <i> --sign-key <file> --escrow-key <member-i.key.json>
           --reveal-share <share-i.json> <requestHash>
           Member: once enough members have released, open the envelope, check it, and send
           your partial decryption sealed to the regulator, with a signed receipt. Round 2.

  receive  --url <base> --registry <file> --sign-key <file> --kem-key <kem.key.json> <bundle> [--out <file>]
           Regulator: fetch the sealed deliveries and decrypt the identity on your machine.
           Checks every receipt, every partial proof and the commitment first.

  demo     The whole flow in memory: escrow → request → 2 approvals → release → deliver → receive.`;

type Flags = Record<string, string> & { _: string[] };

function parseFlags(argv: string[]): Flags {
  const flags = { _: [] } as unknown as Flags;
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) {
      flags._.push(argv[i]);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for ${argv[i]}.`);
    flags[argv[i].slice(2)] = value;
    i++;
  }
  return flags;
}

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function need(flags: Flags, name: string): string {
  const v = flags[name];
  if (!v) fail(`--${name} is required.\n\n${USAGE}`);
  return v;
}

function positional(flags: Flags, what: string): string {
  const v = flags._[0];
  if (!v) fail(`Give the ${what} file.\n\n${USAGE}`);
  return v;
}

function readJson<T>(file: string, what: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch (err) {
    return fail(`Could not read ${what} from ${file}: ${err instanceof Error ? err.message : err}`);
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function readRegistry(flags: Flags): ConsortiumRegistry {
  const raw = readJson<{ format?: string }>(need(flags, "registry"), "registry");
  if (raw.format !== REGISTRY_FORMAT) fail(`Registry is format "${raw.format}", expected "${REGISTRY_FORMAT}".`);
  const pin = readProtocolEnv("REGISTRY_MEMBERS_ID");
  try {
    return parseRegistry(raw, pin ? { pinnedMembersId: pin } : {});
  } catch (e) {
    return fail((e as Error).message);
  }
}

function readSigner(file: string) {
  const key = readJson<SigningKeyFile>(file, "signing key");
  if (key.format !== SIGNING_KEY_FORMAT) fail(`${file} is not a ${SIGNING_KEY_FORMAT} file.`);
  return signerFromFile(key);
}

const api = (base: string, p: string) => `${base.replace(/\/+$/, "")}/api/v1/disclosure/requests${p}`;

async function call(url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, body === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) fail(`${res.status}: ${json.error ?? res.statusText}`);
  return json;
}

async function authGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: token } });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) fail(`${res.status}: ${json.error ?? res.statusText}`);
  return json as T;
}

interface Bundle extends SignedDisclosureRequest {
  ciphertextHash: string;
  requestHash: string;
}

// --- Commands ---

function request(flags: Flags) {
  const reg = readRegistry(flags);
  const days = Number(flags["expires-in-days"] ?? 7);
  if (!Number.isFinite(days) || days <= 0 || days > 30) fail("--expires-in-days must be more than 0 and at most 30.");
  const issuedAt = new Date();
  const req = buildRequest({
    consortiumId: reg.consortiumId,
    regulatorId: need(flags, "regulator-id"),
    txId: need(flags, "tx-id"),
    legalBasisHash: hashLegalDocument(fs.readFileSync(need(flags, "legal-doc"))),
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + days * 86400_000).toISOString(),
  });
  const signed = signRequest(req, readSigner(need(flags, "sign-key")));
  const check = checkSignedRequest(reg, signed, issuedAt);
  if (!check.ok) fail(check.error);
  writeJson(need(flags, "out"), signed);
  console.log(`Signed request for ${req.txId} written to ${flags.out}. Submit it within 5 minutes.`);
}

async function submit(flags: Flags) {
  const signed = readJson<SignedDisclosureRequest>(positional(flags, "signed request"), "signed request");
  const res = await call(api(need(flags, "url"), ""), signed);
  const bundle: Bundle = { ...signed, ciphertextHash: String(res.ciphertextHash), requestHash: String(res.requestHash) };
  if (computeRequestHash(signed.request, bundle.ciphertextHash) !== bundle.requestHash) {
    fail("The server's requestHash doesn't match the request and ciphertextHash it returned.");
  }
  writeJson(need(flags, "out"), bundle);
  console.log(`Submitted. requestHash ${bundle.requestHash}\nSend ${flags.out} and the legal document to the approvers.`);
}

/** Everything an approver checks before signing. Exits on any failure. */
function checkBundle(reg: ConsortiumRegistry, bundle: Bundle, legalDoc?: string) {
  // Signed less than 5 minutes before submission, so check it against its own issuedAt.
  const check = checkSignedRequest(reg, bundle, new Date(bundle.request?.issuedAt));
  if (!check.ok) fail(check.error);
  if (Date.parse(bundle.request.expiresAt) <= Date.now()) fail("The request has expired.");
  if (computeRequestHash(bundle.request, bundle.ciphertextHash) !== bundle.requestHash) {
    fail("requestHash doesn't match the request and ciphertextHash. Don't approve this.");
  }
  if (legalDoc && hashLegalDocument(fs.readFileSync(legalDoc)) !== bundle.request.legalBasisHash) {
    fail("The legal document doesn't match legalBasisHash. Don't approve this.");
  }
  const r = bundle.request;
  console.log([
    `Regulator      ${r.regulatorId}`,
    `Transaction    ${r.txId}`,
    `Legal basis    ${r.legalBasisHash}${legalDoc ? " (matches the document)" : " (document not checked: pass --legal-doc)"}`,
    `Issued         ${r.issuedAt}`,
    `Expires        ${r.expiresAt}`,
    `requestHash    ${bundle.requestHash}`,
  ].join("\n"));
}

function checkCmd(flags: Flags) {
  checkBundle(readRegistry(flags), readJson<Bundle>(positional(flags, "bundle"), "bundle"), flags["legal-doc"]);
  console.log("OK: signed by the registered regulator and requestHash recomputed.");
}

async function approveCmd(flags: Flags) {
  const reg = readRegistry(flags);
  const bundle = readJson<Bundle>(positional(flags, "bundle"), "bundle");
  checkBundle(reg, bundle, flags["legal-doc"]);
  const approverId = need(flags, "approver-id");
  const body = { approverId, signature: signApproval(bundle.requestHash, readSigner(need(flags, "sign-key"))) };
  if (!flags.url) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  const res = await call(api(flags.url, `/${bundle.requestHash}/approvals`), body);
  console.log(`Approved as ${approverId}. Status: ${res.status} (${(res.approvals as unknown[]).length}/${res.approvalThreshold}).`);
}

async function status(flags: Flags) {
  const h = flags._[0] ?? fail("Give the requestHash.");
  console.log(JSON.stringify(await call(api(need(flags, "url"), `/${h}`)), null, 2));
}

// --- D5: members and regulator ---

function memberContext(flags: Flags) {
  const reg = readRegistry(flags);
  const index = Number(need(flags, "member"));
  const signer = readSigner(need(flags, "sign-key"));
  const escrowKey = readJson<EscrowMemberKey>(need(flags, "escrow-key"), "escrow member key");
  if (escrowKey.format !== ESCROW_KEYS_FORMAT || escrowKey.index !== index) fail(`--escrow-key is not member ${index}'s X-Wing key file.`);
  const h = flags._[0] ?? fail("Give the requestHash.");
  return { reg, index, signer, escrowKey, h, base: need(flags, "url") };
}

async function fetchCheckedPackage(c: ReturnType<typeof memberContext>): Promise<DisclosurePackage> {
  const token = makeAccessToken(c.signer, { party: "member", id: String(c.index), requestHash: c.h, action: "package" });
  const pkg = await authGet<DisclosurePackage>(api(c.base, `/${c.h}/package`), token);
  const problems = verifyPackage(c.reg, pkg);
  if (problems.length) fail(`Don't release anything:\n  - ${problems.join("\n  - ")}`);
  const r = pkg.signed.request;
  console.log(`Checked: ${r.regulatorId} asked for ${r.txId}; ${pkg.approvals.length} approvals verify; escrow matches.`);
  return pkg;
}

async function releaseCmd(flags: Flags) {
  const c = memberContext(flags);
  const pkg = await fetchCheckedPackage(c);
  const rel = (() => {
    try { return releaseShare(c.reg, pkg, c.escrowKey, c.signer); } catch (e) { return fail((e as Error).message); }
  })();
  await call(api(c.base, `/${c.h}/shares`), rel);
  console.log(`Released member ${c.index}'s share, sealed to members ${rel.boxes.map((b) => b.to).join(", ")}.`);
}

async function deliverCmd(flags: Flags) {
  const c = memberContext(flags);
  const share = readJson<KeyShare>(need(flags, "reveal-share"), "reveal key share");
  if (share.format !== REVEAL_FORMAT || share.index !== c.index) fail(`--reveal-share is not member ${c.index}'s share file.`);
  const pkg = await fetchCheckedPackage(c);
  const token = makeAccessToken(c.signer, { party: "member", id: String(c.index), requestHash: c.h, action: "shares" });
  const { releases } = await authGet<{ releases: ShareRelease[] }>(api(c.base, `/${c.h}/shares`), token);
  let delivery: Delivery;
  try {
    const ct = openForMember(c.reg, pkg, c.escrowKey, releases);
    delivery = await prepareDelivery(c.reg, pkg, ct, share, c.signer);
  } catch (e) {
    return fail((e as Error).message);
  }
  const res = await call(api(c.base, `/${c.h}/deliveries`), delivery);
  console.log(`Delivered member ${c.index}'s partial, sealed to ${pkg.signed.request.regulatorId}. Status: ${res.status}.`);
}

async function receiveCmd(flags: Flags) {
  const reg = readRegistry(flags);
  const bundle = readJson<Bundle>(positional(flags, "bundle"), "bundle");
  const signer = readSigner(need(flags, "sign-key"));
  const kem = readJson<{ secretKey?: string }>(need(flags, "kem-key"), "X-Wing key");
  if (!kem.secretKey) fail("--kem-key must be your secret X-Wing key file.");
  const token = makeAccessToken(signer, { party: "regulator", id: bundle.request.regulatorId, requestHash: bundle.requestHash, action: "deliveries" });
  const { deliveries } = await authGet<{ deliveries: Delivery[] }>(api(need(flags, "url"), `/${bundle.requestHash}/deliveries`), token);
  const out = await openDisclosure(reg, { request: bundle.request, ciphertextHash: bundle.ciphertextHash }, deliveries, kem.secretKey).catch((e) => fail(e.message));
  if (flags.out) {
    fs.writeFileSync(flags.out, JSON.stringify(out, null, 2) + "\n", { mode: 0o600 });
    console.log(`Identity for ${out.txId} written to ${flags.out} (members ${out.members.join(", ")}).`);
  } else {
    console.log(JSON.stringify(out, null, 2));
  }
}

async function demo() {
  const CID = "demo-consortium";
  console.log("Setup: a 2-of-3 consortium, two approvers and a regulator, each with their own keys.");
  const { consortium, shares } = await dealKeyShares(2, 3);
  const escrowKeys = [1, 2, 3].map(generateEscrowMemberKey);
  const memberSigners = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  let reg = newRegistry(CID, 2, 2, [1, 2, 3].map((i) =>
    makeMemberEntry(CID, {
      index: i, name: `Demo member ${i}`, kem: escrowKeys[i - 1].publicKey, signing: memberSigners[i - 1].publicKey,
      revealKey: consortium.verificationKeys[i - 1].publicKey,
    }, memberSigners[i - 1]),
  ));
  const endorsed = <T extends Parameters<typeof endorse>[2]>(kind: Parameters<typeof endorse>[1], e: T) =>
    [1, 2].reduce((acc, i) => endorse(reg, kind, acc, i, memberSigners[i - 1]), e);
  const validFrom = new Date(Date.now() - 60_000).toISOString();
  const approverSigners = [1, 2].map(() => signerFromFile(generateSigningKey()));
  const fiu = signerFromFile(generateSigningKey());
  const fiuKem = generateKemKey();
  reg = {
    ...reg,
    approvers: approverSigners.map((s, i) => endorsed("approver", makeApproverEntry(CID, { approverId: `approver-${i + 1}`, name: `Demo officer ${i + 1}`, role: "compliance", signing: s.publicKey, validFrom }, s))),
    regulators: [endorsed("regulator", makeRegulatorEntry(CID, { regulatorId: "demo-fiu", name: "Demo FIU", jurisdiction: "XX", signing: fiu.publicKey, kem: fiuKem.publicKey, validFrom }, fiu))],
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zquent-disclosure-demo-"));
  fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify(reg));
  process.env.ZQUENT_REGISTRY_FILE = path.join(dir, "registry.json");
  process.env.ZQUENT_REGISTRY_MEMBERS_ID = membersId(reg);
  process.env.ZQUENT_ESCROW_KEYS = JSON.stringify({ format: ESCROW_KEYS_FORMAT, threshold: 2, members: escrowKeys.map(({ index, publicKey }) => ({ index, publicKey })) });

  // Imported here so the in-memory store and the env above are in place first.
  const { storeRevealEscrow } = await import("../src/policy/escrow");
  const { NextRequest } = await import("next/server");
  const { buildPoseidon } = await import("circomlibjs");
  const routes = {
    submit: (await import("../src/app/api/v1/disclosure/requests/route")).POST,
    approve: (await import("../src/app/api/v1/disclosure/requests/[requestHash]/approvals/route")).POST,
    pkg: (await import("../src/app/api/v1/disclosure/requests/[requestHash]/package/route")).GET,
    shares: await import("../src/app/api/v1/disclosure/requests/[requestHash]/shares/route"),
    deliveries: await import("../src/app/api/v1/disclosure/requests/[requestHash]/deliveries/route"),
  };
  const U = "http://demo/api/v1/disclosure/requests";
  const post = (url: string, body: unknown) => new NextRequest(url, { method: "POST", body: JSON.stringify(body) });
  const get = (url: string, auth: string) => new NextRequest(url, { headers: { authorization: auth } });
  const json = async (r: Response) => {
    const j = await r.json();
    if (!r.ok) fail(`${r.status}: ${j.error}`);
    return j;
  };

  const identity = { idHash: "123456789", birthYear: 1990, salt: "987654321" };
  const poseidon = await buildPoseidon();
  const commitment = poseidon.F.toString(poseidon([BigInt(identity.idHash), BigInt(identity.salt)]));
  const txId = `zquent_demo_${Date.now()}`;
  const ct = await encryptForReveal(consortium.publicKey, identity, commitment, await randomRevealNonce());
  await storeRevealEscrow({ txId, agentId: "demo-agent", ciphertext: ct });
  console.log(`1. Payment ${txId}: the identity is encrypted to the consortium and sealed in a post-quantum envelope.`);

  const signed = signRequest(buildRequest({
    consortiumId: CID, regulatorId: "demo-fiu", txId,
    legalBasisHash: hashLegalDocument(Buffer.from("Demo court order")),
    expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
  }), fiu);
  const created = await json(await routes.submit(post(U, signed)));
  const h: string = created.requestHash;
  const ctx = { params: Promise.resolve({ requestHash: h }) };
  console.log(`2. demo-fiu submits a signed request → ${created.status}`);

  for (const [i, s] of approverSigners.entries()) {
    const j = await json(await routes.approve(post(`${U}/${h}/approvals`, { approverId: `approver-${i + 1}`, signature: signApproval(h, s) }), ctx));
    console.log(`3. approver-${i + 1} signs → ${j.status} (${j.approvals.length}/${j.approvalThreshold})`);
  }

  const members = [1, 3];
  const pkgs: Record<number, DisclosurePackage> = {};
  for (const i of members) {
    const token = makeAccessToken(memberSigners[i - 1], { party: "member", id: String(i), requestHash: h, action: "package" });
    pkgs[i] = await json(await routes.pkg(get(`${U}/${h}/package`, token), ctx));
    const problems = verifyPackage(reg, pkgs[i]);
    if (problems.length) fail(problems.join(" "));
    await json(await routes.shares.POST(post(`${U}/${h}/shares`, releaseShare(reg, pkgs[i], escrowKeys[i - 1], memberSigners[i - 1])), ctx));
    console.log(`4. member ${i} re-checks the request and approvals, then releases its share to the other members`);
  }
  for (const i of members) {
    const token = makeAccessToken(memberSigners[i - 1], { party: "member", id: String(i), requestHash: h, action: "shares" });
    const { releases } = await json(await routes.shares.GET(get(`${U}/${h}/shares`, token), ctx));
    const opened = openForMember(reg, pkgs[i], escrowKeys[i - 1], releases);
    const j = await json(await routes.deliveries.POST(post(`${U}/${h}/deliveries`, await prepareDelivery(reg, pkgs[i], opened, shares[i - 1], memberSigners[i - 1])), ctx));
    console.log(`5. member ${i} opens the envelope, checks it, and delivers its partial sealed to demo-fiu → ${j.status}`);
  }

  const token = makeAccessToken(fiu, { party: "regulator", id: "demo-fiu", requestHash: h, action: "deliveries" });
  const { deliveries } = await json(await routes.deliveries.GET(get(`${U}/${h}/deliveries`, token), ctx));
  const out = await openDisclosure(reg, { request: signed.request, ciphertextHash: created.ciphertextHash }, deliveries, fiuKem.secretKey);
  console.log("6. demo-fiu decrypts on its own machine:");
  console.log(JSON.stringify(out, null, 2));
  console.log(`   matches the original identity: ${out.idHash === identity.idHash && out.birthYear === identity.birthYear}`);
  fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (cmd) {
    case "request": return request(flags);
    case "submit": return submit(flags);
    case "check": return checkCmd(flags);
    case "approve": return approveCmd(flags);
    case "status": return status(flags);
    case "release": return releaseCmd(flags);
    case "deliver": return deliverCmd(flags);
    case "receive": return receiveCmd(flags);
    case "demo": return demo();
    default:
      console.log(USAGE);
      if (cmd && cmd !== "help" && cmd !== "--help") process.exit(1);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
