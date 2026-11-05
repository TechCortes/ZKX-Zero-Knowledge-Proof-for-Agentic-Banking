/**
 * ZQUENT — distributed key generation CLI (ROADMAP D6). See docs/dkg.md.
 *
 * Replaces `npm run reveal -- keygen` (trusted dealer). Each member runs its own
 * steps on its own machine; only the public files travel between members.
 *
 *   npm run dkg -- session  --registry registry.json --out session.json                       (anyone)
 *   npm run dkg -- deal     --registry registry.json --session session.json --member 1 \
 *                           --sign-key m1/signing.key.json --out-dir m1                       (each member)
 *   npm run dkg -- finalize --registry registry.json --session session.json --member 1 \
 *                           --sign-key m1/signing.key.json --escrow-key member-1.key.json \
 *                           --secret m1/dkg-secret-1.json --out-dir m1 deal-1.json deal-2.json deal-3.json
 *   npm run dkg -- verify   --registry registry.json --session session.json --out consortium.json \
 *                           deal-*.json result-*.json                                          (anyone)
 *   npm run dkg -- demo
 */

import fs from "fs";
import path from "path";
import { REGISTRY_FORMAT, generateSigningKey, makeMemberEntry, newRegistry, parseRegistry, signerFromFile, type ConsortiumRegistry, type SigningKeyFile } from "../src/disclosure/keyRegistry";
import { readProtocolEnv } from "../src/lib/env";
import { ESCROW_KEYS_FORMAT, generateEscrowMemberKey, type EscrowMemberKey } from "../src/zkp/escrowSeal";
import { combinePartials, encryptForReveal, partialDecrypt, randomRevealNonce } from "../src/zkp/reveal";
import {
  DKG_FORMAT,
  DKG_SECRET_FORMAT,
  dkgDeal,
  dkgFinalize,
  dkgSessionId,
  newDkgSession,
  verifyDkgTranscript,
  type DkgDeal,
  type DkgResult,
  type DkgSecret,
  type DkgSession,
} from "../src/zkp/dkg";

const USAGE = `Usage: npm run dkg -- <command> [options]

Makes the consortium's threshold-reveal key with no trusted dealer. Every member
takes part; no one ever holds the whole secret key.

Commands:
  session   --registry <file> --out <file>
            Start a ceremony for every member in the registry (k = registry threshold).
            Send the session file to every member.

  deal      --registry <file> --session <file> --member <i> --sign-key <file> --out-dir <dir>
            Member i: make your random contribution. Writes deal-<i>.json (public: send it to
            every member) and dkg-secret-<i>.json (secret: keep it until finalize).

  finalize  --registry <file> --session <file> --member <i> --sign-key <file>
            --escrow-key <member-i.key.json> --secret <dkg-secret-i.json> --out-dir <dir> <all deal files>
            Member i: check every share sealed to you against its dealer's commitments, then
            write share-<i>.json (secret), consortium.json and result-<i>.json (public: send it).
            Refuses, naming the dealer, if any share is wrong.

  verify    --registry <file> --session <file> [--out <consortium.json>] <all deal and result files>
            Anyone: check the whole ceremony and write the consortium key to publish.

  demo      Run a 2-of-3 ceremony in memory and decrypt with the result.`;

type Flags = Record<string, string> & { _: string[] };

function parseFlags(argv: string[]): Flags {
  const flags = { _: [] } as unknown as Flags;
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) { flags._.push(argv[i]); continue; }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) fail(`Missing value for ${argv[i]}.`);
    flags[argv[i].slice(2)] = v;
    i++;
  }
  return flags;
}

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function need(flags: Flags, name: string): string {
  return flags[name] || fail(`--${name} is required.\n\n${USAGE}`);
}

function readJson<T>(file: string, what: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch (e) {
    return fail(`Could not read ${what} from ${file}: ${(e as Error).message}`);
  }
}

function writeJson(file: string, data: unknown, secret = false) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: secret ? 0o600 : 0o644 });
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

const readSession = (flags: Flags) => {
  const s = readJson<DkgSession>(need(flags, "session"), "session");
  if (s.format !== DKG_FORMAT) fail(`Session must have format "${DKG_FORMAT}".`);
  return s;
};
const readSigner = (file: string) => {
  try { return signerFromFile(readJson<SigningKeyFile>(file, "signing key")); } catch (e) { return fail((e as Error).message); }
};
const memberIndex = (flags: Flags) => {
  const i = Number(need(flags, "member"));
  if (!Number.isInteger(i) || i < 1) fail("--member must be a positive integer.");
  return i;
};

// --- Commands ---

function session(flags: Flags) {
  const reg = readRegistry(flags);
  const s = newDkgSession(reg);
  writeJson(need(flags, "out"), s);
  console.log(`Session for ${s.parties} members, threshold ${s.threshold}.\nsessionId ${dkgSessionId(s)}\nSend ${flags.out} to every member.`);
}

async function deal(flags: Flags) {
  const reg = readRegistry(flags);
  const i = memberIndex(flags);
  const out = need(flags, "out-dir");
  const { deal: d, secret } = await dkgDeal(reg, readSession(flags), i, readSigner(need(flags, "sign-key"))).catch((e) => fail(e.message));
  writeJson(path.join(out, `deal-${i}.json`), d);
  writeJson(path.join(out, `dkg-secret-${i}.json`), secret, true);
  console.log(`Member ${i}: wrote ${out}/deal-${i}.json (send to every member) and ${out}/dkg-secret-${i}.json (keep secret).`);
}

async function finalize(flags: Flags) {
  const reg = readRegistry(flags);
  const i = memberIndex(flags);
  const out = need(flags, "out-dir");
  const secret = readJson<DkgSecret>(need(flags, "secret"), "DKG secret");
  if (secret.format !== DKG_SECRET_FORMAT) fail("--secret is not a DKG secret file.");
  if (secret.index !== i) fail(`--secret is member ${secret.index}'s file, not member ${i}'s.`);
  const key = readJson<EscrowMemberKey>(need(flags, "escrow-key"), "X-Wing member key");
  if (key.format !== ESCROW_KEYS_FORMAT) fail("--escrow-key is not an X-Wing member key file.");
  if (!flags._.length) fail("Pass every member's deal file.");
  const deals = flags._.map((f) => readJson<DkgDeal>(f, "deal"));
  const done = await dkgFinalize(reg, readSession(flags), deals, secret, key, readSigner(need(flags, "sign-key"))).catch((e) => fail(e.message));
  writeJson(path.join(out, `share-${i}.json`), done.keyShare, true);
  writeJson(path.join(out, "consortium.json"), done.consortium);
  writeJson(path.join(out, `result-${i}.json`), done.result);
  console.log([
    `Member ${i}: every share checked out.`,
    `  ${out}/share-${i}.json   your reveal key share (secret; use it with npm run disclosure -- deliver)`,
    `  ${out}/consortium.json  the public consortium key`,
    `  ${out}/result-${i}.json  your signed result (send to every member)`,
    `You can now delete ${flags.secret}.`,
  ].join("\n"));
}

async function verify(flags: Flags) {
  const reg = readRegistry(flags);
  const files = flags._.map((f) => readJson<Record<string, unknown>>(f, "transcript file"));
  const deals = files.filter((f) => Array.isArray(f.commitments)) as unknown as DkgDeal[];
  const results = files.filter((f) => typeof f.verificationKeysHash === "string") as unknown as DkgResult[];
  const consortium = await verifyDkgTranscript(reg, { session: readSession(flags), deals, results }).catch((e) => fail(e.message));
  if (flags.out) writeJson(flags.out, consortium);
  console.log([
    `OK: ${deals.length} deals and ${results.length} signed results, all agreeing.`,
    `Consortium public key: ${JSON.stringify(consortium.publicKey)}`,
    `Next: set ZQUENT_REVEAL_PUBLIC_KEY to ${JSON.stringify(JSON.stringify(consortium.publicKey))}, and add each member's`,
    `reveal key to the registry (npm run registry -- member ... --consortium ${flags.out ?? "consortium.json"}).`,
  ].join("\n"));
}

async function demo() {
  const CID = "demo-consortium";
  const signers = [1, 2, 3].map(() => signerFromFile(generateSigningKey()));
  const kems = [1, 2, 3].map(generateEscrowMemberKey);
  const reg = newRegistry(CID, 2, 2, [1, 2, 3].map((i) =>
    makeMemberEntry(CID, { index: i, name: `Demo member ${i}`, kem: kems[i - 1].publicKey, signing: signers[i - 1].publicKey }, signers[i - 1])));

  const s = newDkgSession(reg);
  console.log(`1. Session for 3 members, threshold 2 (${dkgSessionId(s).slice(0, 16)}…)`);
  const dealt = await Promise.all([1, 2, 3].map((i) => dkgDeal(reg, s, i, signers[i - 1])));
  console.log("2. Each member deals: public commitments, plus one sealed share for each other member");
  const deals = dealt.map((d) => d.deal);
  const done = await Promise.all([1, 2, 3].map((i) => dkgFinalize(reg, s, deals, dealt[i - 1].secret, kems[i - 1], signers[i - 1])));
  console.log("3. Each member checks the shares it received against the commitments and derives its key share");
  const consortium = await verifyDkgTranscript(reg, { session: s, deals, results: done.map((d) => d.result) });
  console.log(`4. Transcript verifies; consortium key ${consortium.publicKey[0].slice(0, 16)}…`);

  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const identity = { idHash: "123456789", birthYear: 1990, salt: "987654321" };
  const commitment = poseidon.F.toString(poseidon([BigInt(identity.idHash), BigInt(identity.salt)]));
  const ct = await encryptForReveal(consortium.publicKey, identity, commitment, await randomRevealNonce());
  const out = await combinePartials(consortium, ct, [await partialDecrypt(done[0].keyShare, ct), await partialDecrypt(done[2].keyShare, ct)]);
  console.log(`5. An identity encrypted to that key opens with members 1 + 3: ${out.idHash === identity.idHash && out.commitmentMatches}`);
  await combinePartials(consortium, ct, [await partialDecrypt(done[1].keyShare, ct)]).catch((e) => console.log(`   One member alone is refused: ${e.message}`));
}

const COMMANDS: Record<string, (f: Flags) => unknown> = { session, deal, finalize, verify, demo };

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !COMMANDS[cmd]) {
    console.log(USAGE);
    process.exit(cmd && cmd !== "help" ? 1 : 0);
  }
  await COMMANDS[cmd](parseFlags(rest));
  process.exit(0);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
