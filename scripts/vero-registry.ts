/**
 * Vero Protocol — consortium key registry CLI (ROADMAP D3). See docs/key-registry.md.
 *
 * Reference tooling: keys are plain JSON files. In production each party keeps
 * its signing key in an HSM and only the signatures travel.
 *
 *   npm run registry -- keygen  --out ./me [--with-kem]                    (every party, own machine)
 *   npm run registry -- member  --consortium-id demo --index 1 --name "Bank A" \
 *                               --kem member-1.pub.json --sign-key ./me/signing.key.json --out m1.json
 *   npm run registry -- init    --consortium-id demo --threshold 2 --approval-threshold 2 --out registry.json m1.json m2.json m3.json
 *   npm run registry -- regulator --registry registry.json --id demo-fiu --name "Demo FIU" --jurisdiction XX \
 *                               --sign-key ./fiu/signing.key.json --kem-key ./fiu/kem.pub.json --out fiu.json
 *   npm run registry -- endorse --registry registry.json --index 1 --sign-key ./me/signing.key.json fiu.json
 *   npm run registry -- add     --registry registry.json fiu.json
 *   npm run registry -- verify  --registry registry.json
 *   npm run registry -- demo
 */

import fs from "fs";
import path from "path";
import {
  KEM_KEY_FORMAT,
  REGISTRY_FORMAT,
  SIGNING_KEY_FORMAT,
  activeApprovers,
  activeRegulator,
  disclosureReadiness,
  endorse,
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
  type ApproverEntry,
  type ConsortiumRegistry,
  type EndorsableKind,
  type MemberEntry,
  type RegulatorEntry,
  type Revocation,
  type SigningKeyFile,
  type VerifyOptions,
} from "../src/disclosure/keyRegistry";
import { ESCROW_KEYS_FORMAT, generateEscrowMemberKey, parseEscrowKeySet } from "../src/zkp/escrowSeal";
import { REVEAL_FORMAT, type ConsortiumKey } from "../src/zkp/reveal";

const USAGE = `Usage: npm run registry -- <command> [options]

Commands:
  keygen     --out <dir> [--with-kem]
             Make a hybrid Ed25519 + ML-DSA-65 signing key (every member, approver and regulator).
             --with-kem also makes an X-Wing key (regulators: disclosures are sealed to it).
             Members already have an X-Wing key from: npm run reveal -- kem-keygen

  member     --consortium-id <id> --index <i> --name <name> --kem <member-i.pub.json>
             --sign-key <file> [--consortium <consortium.json>] --out <file>
             A member's self-signed entry. --consortium adds their reveal verification key.

  init       --consortium-id <id> --threshold <k> --approval-threshold <m> --out <file> <member entries...>
             Start a registry from the member entries. Pin the printed membersId in deployment config.

  approver   --registry <file> --id <id> --name <name> --role <text> --sign-key <file>
             [--valid-from <iso>] [--valid-until <iso>] --out <file>
  regulator  --registry <file> --id <id> --name <name> --jurisdiction <code> --sign-key <file>
             --kem-key <kem.pub.json> [--valid-from <iso>] [--valid-until <iso>] --out <file>
             Run by the approver / regulator: a self-signed proposal, to be endorsed by k members.

  revoke     --registry <file> --kind approver|regulator --id <id> --reason <text> [--at <iso>] --out <file>
             Propose withdrawing an approver or regulator; needs k endorsements too.

  endorse    --registry <file> --index <i> --sign-key <file> <proposal file>
             Run by ONE member: add their endorsement to a proposal (the file is updated in place).

  add        --registry <file> <proposal files...>
             Append endorsed proposals to the registry. Refuses anything that doesn't verify.

  verify     --registry <file> [--consortium <consortium.json>] [--members-id <hex>]
             Check every signature. Also checks against VERO_ESCROW_KEYS when it is set.

  demo       Build a 2-of-3 registry with an approver pair and a regulator, in memory.`;

type Flags = Record<string, string | true> & { _: string[] };

const BOOLEAN_FLAGS = new Set(["with-kem"]);

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] } as unknown as Flags;
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) {
      flags._.push(argv[i]);
      continue;
    }
    const name = argv[i].slice(2);
    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for --${name}.`);
    flags[name] = value;
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
  if (typeof v !== "string" || !v) fail(`--${name} is required.\n\n${USAGE}`);
  return v;
}

function opt(flags: Flags, name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

function readJson<T>(file: string, what: string, format?: string): T {
  let data: { format?: string };
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    fail(`Could not read ${what} from ${file}: ${err instanceof Error ? err.message : err}`);
  }
  if (format && data.format !== format) fail(`${file} is format "${data.format}", expected "${format}".`);
  return data as T;
}

function writeJson(file: string, data: unknown, secret = false) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: secret ? 0o600 : 0o644 });
}

function attempt<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    return fail((e as Error).message);
  }
}

function isoFlag(flags: Flags, name: string, fallback?: string): string | undefined {
  const v = opt(flags, name) ?? fallback;
  if (v === undefined) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) fail(`--${name} is not a date: ${v}`);
  return d.toISOString();
}

const readRegistry = (flags: Flags) => readJson<ConsortiumRegistry>(need(flags, "registry"), "registry", REGISTRY_FORMAT);
const readSigner = (file: string) => attempt(() => signerFromFile(readJson<SigningKeyFile>(file, "signing key", SIGNING_KEY_FORMAT)));

function kindOf(entry: Record<string, unknown>): EndorsableKind {
  if (typeof entry.regulatorId === "string") return "regulator";
  if (typeof entry.approverId === "string") return "approver";
  if (entry.kind === "approver" || entry.kind === "regulator") return "revocation";
  return fail("That file isn't an approver, regulator or revocation proposal.");
}

function verifyOptions(flags: Flags): VerifyOptions {
  const o: VerifyOptions = {};
  const raw = process.env.VERO_ESCROW_KEYS?.trim();
  if (raw) o.escrowKeys = attempt(() => parseEscrowKeySet(JSON.parse(raw)));
  const consortium = opt(flags, "consortium");
  if (consortium) o.revealVerificationKeys = readJson<ConsortiumKey>(consortium, "consortium key", REVEAL_FORMAT).verificationKeys;
  const pinned = opt(flags, "members-id") ?? process.env.VERO_REGISTRY_MEMBERS_ID?.trim();
  if (pinned) o.pinnedMembersId = pinned;
  return o;
}

// --- Commands ---

function keygen(flags: Flags) {
  const out = need(flags, "out");
  const key = generateSigningKey();
  writeJson(path.join(out, "signing.key.json"), key, true);
  writeJson(path.join(out, "signing.pub.json"), { format: SIGNING_KEY_FORMAT, publicKey: key.publicKey });
  console.log(`Signing key ${key.publicKey.keyId} written to ${out}/`);
  console.log(`  signing.key.json  SECRET — keep it (an HSM in production)`);
  console.log(`  signing.pub.json  public`);
  if (flags["with-kem"]) {
    const kem = generateKemKey();
    writeJson(path.join(out, "kem.key.json"), kem, true);
    writeJson(path.join(out, "kem.pub.json"), { format: KEM_KEY_FORMAT, publicKey: kem.publicKey });
    console.log(`  kem.key.json      SECRET — opens disclosures sealed to you`);
    console.log(`  kem.pub.json      public — goes in your registry entry`);
  }
}

function member(flags: Flags) {
  const consortiumId = need(flags, "consortium-id");
  const index = Number(need(flags, "index"));
  const kem = readJson<{ index: number; publicKey: string }>(need(flags, "kem"), "member X-Wing public key", ESCROW_KEYS_FORMAT);
  if (kem.index !== index) fail(`${flags.kem} is member ${kem.index}'s key, not member ${index}'s.`);
  const signer = readSigner(need(flags, "sign-key"));
  let revealKey: MemberEntry["revealKey"];
  const consortium = opt(flags, "consortium");
  if (consortium) {
    const ck = readJson<ConsortiumKey>(consortium, "consortium key", REVEAL_FORMAT);
    revealKey = ck.verificationKeys.find((v) => v.index === index)?.publicKey;
    if (!revealKey) fail(`consortium.json has no verification key for member ${index}.`);
  }
  const entry = attempt(() =>
    makeMemberEntry(consortiumId, { index, name: need(flags, "name"), kem: kem.publicKey, signing: signer.publicKey, ...(revealKey ? { revealKey } : {}) }, signer),
  );
  writeJson(need(flags, "out"), entry);
  console.log(`Member ${index} entry written to ${flags.out}. Send it to whoever runs init.`);
}

function init(flags: Flags) {
  const members = flags._.map((f) => readJson<MemberEntry>(f, "member entry"));
  if (members.length === 0) fail("Pass the member entry files.");
  const reg = newRegistry(need(flags, "consortium-id"), Number(need(flags, "threshold")), Number(need(flags, "approval-threshold")), members);
  report(reg, verifyOptions(flags));
  writeJson(need(flags, "out"), reg);
  console.log(`\nWrote ${flags.out}. Pin the member set in deployment config:\n  VERO_REGISTRY_MEMBERS_ID=${membersId(reg)}`);
}

function validity(flags: Flags) {
  const validFrom = isoFlag(flags, "valid-from", new Date().toISOString())!;
  const validUntil = isoFlag(flags, "valid-until");
  return { validFrom, ...(validUntil ? { validUntil } : {}) };
}

function approver(flags: Flags) {
  const reg = readRegistry(flags);
  const signer = readSigner(need(flags, "sign-key"));
  const entry = attempt(() =>
    makeApproverEntry(reg.consortiumId, { approverId: need(flags, "id"), name: need(flags, "name"), role: need(flags, "role"), signing: signer.publicKey, ...validity(flags) }, signer),
  );
  writeJson(need(flags, "out"), entry);
  console.log(`Approver proposal written to ${flags.out}. It needs ${reg.threshold} member endorsements (endorse), then add.`);
}

function regulator(flags: Flags) {
  const reg = readRegistry(flags);
  const signer = readSigner(need(flags, "sign-key"));
  const kem = readJson<{ publicKey: string }>(need(flags, "kem-key"), "X-Wing public key", KEM_KEY_FORMAT);
  const entry = attempt(() =>
    makeRegulatorEntry(
      reg.consortiumId,
      { regulatorId: need(flags, "id"), name: need(flags, "name"), jurisdiction: need(flags, "jurisdiction"), signing: signer.publicKey, kem: kem.publicKey, ...validity(flags) },
      signer,
    ),
  );
  writeJson(need(flags, "out"), entry);
  console.log(`Regulator proposal written to ${flags.out}. It needs ${reg.threshold} member endorsements (endorse), then add.`);
}

function revoke(flags: Flags) {
  const reg = readRegistry(flags);
  const kind = need(flags, "kind");
  const id = need(flags, "id");
  const target =
    kind === "approver" ? reg.approvers.find((a) => a.approverId === id) : kind === "regulator" ? reg.regulators.find((r) => r.regulatorId === id) : fail("--kind must be approver or regulator.");
  if (!target) fail(`No ${kind} ${id} in the registry.`);
  const rev = makeRevocation({ kind: kind as Revocation["kind"], id, keyId: target.signing.keyId, revokedAt: isoFlag(flags, "at", new Date().toISOString())!, reason: need(flags, "reason") });
  writeJson(need(flags, "out"), rev);
  console.log(`Revocation proposal written to ${flags.out}. It needs ${reg.threshold} member endorsements (endorse), then add.`);
}

function endorseCmd(flags: Flags) {
  const reg = readRegistry(flags);
  const index = Number(need(flags, "index"));
  const signer = readSigner(need(flags, "sign-key"));
  if (flags._.length !== 1) fail("Pass exactly one proposal file.");
  const file = flags._[0];
  const entry = readJson<ApproverEntry | RegulatorEntry | Revocation>(file, "proposal");
  const kind = kindOf(entry as unknown as Record<string, unknown>);
  const updated = attempt(() => endorse(reg, kind, entry, index, signer));
  writeJson(file, updated);
  console.log(`Member ${index} endorsed ${file} (${updated.endorsements.length}/${reg.threshold}).`);
}

function add(flags: Flags) {
  const file = need(flags, "registry");
  const reg = readRegistry(flags);
  if (flags._.length === 0) fail("Pass the endorsed proposal files.");
  for (const f of flags._) {
    const entry = readJson<ApproverEntry | RegulatorEntry | Revocation>(f, "proposal");
    const kind = kindOf(entry as unknown as Record<string, unknown>);
    if (kind === "approver") reg.approvers.push(entry as ApproverEntry);
    else if (kind === "regulator") reg.regulators.push(entry as RegulatorEntry);
    else reg.revocations.push(entry as Revocation);
  }
  report(reg, verifyOptions(flags));
  writeJson(file, reg);
  console.log(`\nUpdated ${file}.`);
}

function verifyCmd(flags: Flags) {
  report(readRegistry(flags), verifyOptions(flags));
}

/** Print a summary; exits non-zero if the registry doesn't verify. */
function report(reg: ConsortiumRegistry, opts: VerifyOptions) {
  const errors = verifyRegistry(reg, opts);
  if (errors.length) fail(`Registry does not verify:\n  - ${errors.join("\n  - ")}`);
  const now = new Date();
  console.log(`Registry ${reg.consortiumId} verifies.`);
  console.log(`  members      ${reg.members.length} (endorsement threshold ${reg.threshold})`);
  console.log(`  approvers    ${activeApprovers(reg, now).length} active of ${reg.approvers.length} (approval threshold ${reg.approvalThreshold})`);
  console.log(`  regulators   ${reg.regulators.filter((r) => activeRegulator(reg, r.regulatorId, now)).length} active of ${reg.regulators.length}`);
  console.log(`  revocations  ${reg.revocations.length}`);
  console.log(`  membersId    ${membersId(reg)}`);
  console.log(`  registryId   ${registryId(reg)}`);
  if (opts.escrowKeys) console.log(`  escrow keys  match VERO_ESCROW_KEYS`);
  const notReady = disclosureReadiness(reg, now);
  if (notReady.length) console.log(`  not ready for disclosure: ${notReady.join(" ")}`);
}

function demo() {
  const cid = "demo-consortium";
  console.log("Demo: 3 members (2-of-3), 2 approvers, 1 regulator. All keys are throwaway.\n");
  const memberKeys = [1, 2, 3].map((i) => ({ kem: generateEscrowMemberKey(i), sign: signerFromFile(generateSigningKey()) }));
  const members = memberKeys.map(({ kem, sign }) => makeMemberEntry(cid, { index: kem.index, name: `Demo member ${kem.index}`, kem: kem.publicKey, signing: sign.publicKey }, sign));
  const reg = newRegistry(cid, 2, 2, members);
  console.log(`1. Each member made a self-signed entry; init → membersId ${membersId(reg).slice(0, 16)}…`);

  for (const i of [1, 2]) {
    const s = signerFromFile(generateSigningKey());
    let a = makeApproverEntry(cid, { approverId: `demo-approver-${i}`, name: `Demo approver ${i}`, role: "compliance officer", signing: s.publicKey, validFrom: new Date().toISOString() }, s);
    for (const m of [1, 2]) a = endorse(reg, "approver", a, m, memberKeys[m - 1].sign);
    reg.approvers.push(a);
  }
  console.log("2. Two approvers proposed themselves; members 1 and 2 endorsed each.");

  const rs = signerFromFile(generateSigningKey());
  let r = makeRegulatorEntry(cid, { regulatorId: "demo-fiu", name: "Demo FIU", jurisdiction: "XX", signing: rs.publicKey, kem: generateKemKey().publicKey, validFrom: new Date().toISOString() }, rs);
  r = endorse(reg, "regulator", r, 1, memberKeys[0].sign);
  const withOne = { ...reg, regulators: [r] };
  console.log(`3. Regulator proposed; after 1 endorsement verify says: ${verifyRegistry(withOne).join(" ")}`);
  r = endorse(reg, "regulator", r, 3, memberKeys[2].sign);
  reg.regulators.push(r);
  console.log("   After member 3 endorses too, it's accepted.\n");

  report(parseRegistry(reg), {});
  console.log(`\n4. Tampering check — swap the regulator's delivery key:`);
  const tampered = JSON.parse(JSON.stringify(reg)) as ConsortiumRegistry;
  tampered.regulators[0].kem = generateKemKey().publicKey;
  console.log(`   ${verifyRegistry(tampered).length} problems found; the registry is rejected.`);
}

const commands: Record<string, (f: Flags) => void> = {
  keygen,
  member,
  init,
  approver,
  regulator,
  revoke,
  endorse: endorseCmd,
  add,
  verify: verifyCmd,
  demo,
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.log(USAGE);
  process.exit(cmd ? 1 : 0);
}
commands[cmd](parseFlags(rest));
