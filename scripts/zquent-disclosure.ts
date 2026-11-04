/**
 * ZQUENT — disclosure request CLI (ROADMAP D4). See docs/disclosure-requests.md.
 *
 *   npm run disclosure -- request --registry registry.json --regulator-id demo-fiu --sign-key ./fiu/signing.key.json \
 *                                 --tx-id <txId> --legal-doc order.pdf [--expires-in-days 7] --out signed.json
 *   npm run disclosure -- submit  --url https://host signed.json --out bundle.json
 *   npm run disclosure -- check   --registry registry.json [--legal-doc order.pdf] bundle.json
 *   npm run disclosure -- approve --registry registry.json --approver-id approver-1 --sign-key ./a1/signing.key.json \
 *                                 [--legal-doc order.pdf] [--url https://host] bundle.json
 *   npm run disclosure -- status  --url https://host <requestHash>
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
import { generateEscrowMemberKey } from "../src/zkp/escrowSeal";
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

  demo     Submit and approve a request end to end in memory.`;

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

async function demo() {
  const CID = "demo-consortium";
  const memberSigners = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  let reg = newRegistry(CID, 2, 2, [1, 2, 3].map((i) =>
    makeMemberEntry(CID, { index: i, name: `Demo member ${i}`, kem: generateEscrowMemberKey(i).publicKey, signing: memberSigners[i - 1].publicKey }, memberSigners[i - 1]),
  ));
  const endorsed = <T extends Parameters<typeof endorse>[2]>(kind: Parameters<typeof endorse>[1], e: T) =>
    [1, 2].reduce((acc, i) => endorse(reg, kind, acc, i, memberSigners[i - 1]), e);
  const validFrom = new Date(Date.now() - 60_000).toISOString();
  const approverSigners = [1, 2].map(() => signerFromFile(generateSigningKey()));
  const fiu = signerFromFile(generateSigningKey());
  reg = {
    ...reg,
    approvers: approverSigners.map((s, i) => endorsed("approver", makeApproverEntry(CID, { approverId: `approver-${i + 1}`, name: `Demo officer ${i + 1}`, role: "compliance", signing: s.publicKey, validFrom }, s))),
    regulators: [endorsed("regulator", makeRegulatorEntry(CID, { regulatorId: "demo-fiu", name: "Demo FIU", jurisdiction: "XX", signing: fiu.publicKey, kem: generateKemKey().publicKey, validFrom }, fiu))],
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vero-disclosure-demo-"));
  fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify(reg));
  process.env.ZQUENT_REGISTRY_FILE = path.join(dir, "registry.json");
  process.env.ZQUENT_REGISTRY_MEMBERS_ID = membersId(reg);

  // Imported here so the in-memory store and the env above are in place first.
  const { storeRevealEscrow } = await import("../src/policy/escrow");
  const { NextRequest } = await import("next/server");
  const { POST: submitRoute } = await import("../src/app/api/v1/disclosure/requests/route");
  const { POST: approveRoute } = await import("../src/app/api/v1/disclosure/requests/[requestHash]/approvals/route");
  const post = (url: string, body: unknown) => new NextRequest(url, { method: "POST", body: JSON.stringify(body) });

  const txId = `demo-tx-${Date.now()}`;
  await storeRevealEscrow({ txId, agentId: "demo-agent", ciphertext: { format: "vero-reveal/v1", commitment: "1", publicKey: ["1", "2"], ephemeral: ["3", "4"], ciphertext: ["5", "6", "7"] } });
  console.log(`1. Payment ${txId} has an escrowed identity.`);

  const signed = signRequest(buildRequest({
    consortiumId: CID, regulatorId: "demo-fiu", txId,
    legalBasisHash: hashLegalDocument(Buffer.from("Demo court order")),
    expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
  }), fiu);
  const created = await (await submitRoute(post("http://demo/api/v1/disclosure/requests", signed))).json();
  console.log(`2. demo-fiu submitted a signed request → ${created.status}, requestHash ${created.requestHash.slice(0, 16)}…`);

  const bundle: Bundle = { ...signed, ciphertextHash: created.ciphertextHash, requestHash: created.requestHash };
  for (const [i, s] of approverSigners.entries()) {
    if (computeRequestHash(bundle.request, bundle.ciphertextHash) !== bundle.requestHash) fail("requestHash mismatch");
    const res = await approveRoute(
      post(`http://demo/x/${bundle.requestHash}/approvals`, { approverId: `approver-${i + 1}`, signature: signApproval(bundle.requestHash, s) }),
      { params: Promise.resolve({ requestHash: bundle.requestHash }) },
    );
    const j = await res.json();
    console.log(`${3 + i}. approver-${i + 1} recomputed requestHash and signed → ${j.status} (${j.approvals.length}/${j.approvalThreshold})`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("Done. Unsealing and sealed delivery to the regulator are D5.");
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
    case "demo": return demo();
    default:
      console.log(USAGE);
      if (cmd && cmd !== "help" && cmd !== "--help") process.exit(1);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
