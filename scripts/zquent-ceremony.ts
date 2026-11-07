/**
 * ZQUENT — Groth16 phase-2 ceremony CLI (plan item D6). See docs/ceremony.md.
 *
 * Replaces the single "Demo Contributor" in setup_zk.js with a chain of
 * independent contributions closed by a public random beacon.
 *
 *   npm run ceremony -- init       <circuit>                                (coordinator)
 *   npm run ceremony -- contribute <circuit> --name "Alice"                 (coordinator's machine)
 *   npm run ceremony -- contribute <circuit> --name "Bob" --in a.zkey --out b.zkey   (anyone, anywhere)
 *   npm run ceremony -- accept     <circuit> b.zkey                         (coordinator)
 *   npm run ceremony -- beacon     <circuit> --source "drand quicknet round N" --value <hex>
 *   npm run ceremony -- finalize   <circuit>
 *   npm run ceremony -- verify     <circuit>                                (anyone; CI)
 *   npm run ceremony -- demo       <circuit>                                (one operator plays 3 contributors)
 *
 * <circuit> is kyc_credential or kyc_reveal. Compile it first (npm run compile-circuit[:reveal]).
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import {
  CEREMONY_CIRCUITS,
  PTAU,
  hashToHex,
  newTranscript,
  parseVerifyLog,
  transcriptMismatches,
  type CeremonyCircuit,
  type CeremonyTranscript,
} from "../src/zkp/ceremony";

const USAGE = `Usage: npm run ceremony -- <command> <circuit> [options]

Runs the Groth16 phase-2 trusted setup as a multi-party ceremony. The key is
sound as long as ONE contributor destroyed their randomness.

Commands:
  init       <circuit> [--demo]
             Start a ceremony from the compiled circuit and the PSE Powers of Tau.
             --demo marks the transcript as a single-operator demo (no security).

  contribute <circuit> --name <name> [--in <zkey>] [--out <zkey>] [--entropy <text>]
             Add your randomness. Without --in/--out this works on the coordinator's
             workspace and records the result. With them, it works on files you were
             sent: send --out back to the coordinator and publish the printed hash.

  accept     <circuit> <zkey>
             Coordinator: check a returned zkey extends the current chain, then record it.

  beacon     <circuit> --source <text> --value <hex> [--iterations <10..63>]
             Close the ceremony with a public random value nobody could predict when the
             last contribution was made (announce the drand round in advance).

  finalize   <circuit>
             Verify the whole chain and write public/zk/<circuit>_final.zkey, the
             verification key and the wasm.

  verify     <circuit>
             Anyone: check the committed zkey against the circuit, the Powers of Tau and
             ceremony/<circuit>.json. Exits non-zero on any mismatch.

  demo       <circuit>
             init + three labelled demo contributions + a drand beacon + finalize.
             Everything runs on one machine, so it proves the tooling, not the key.
`;

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "circuits", "build");
const PUBLIC_ZK = path.join(ROOT, "public", "zk");
const VKEY_FILE: Record<CeremonyCircuit, string> = {
  kyc_credential: "verification_key.json",
  kyc_reveal: "kyc_reveal_verification_key.json",
};

const paths = (c: CeremonyCircuit) => ({
  r1cs: path.join(BUILD, `${c}.r1cs`),
  wasm: path.join(BUILD, `${c}_js`, `${c}.wasm`),
  ptau: path.join(ROOT, "circuits", PTAU.file),
  workspace: path.join(BUILD, "ceremony", c),
  transcript: path.join(ROOT, "ceremony", `${c}.json`),
  finalZkey: path.join(PUBLIC_ZK, `${c}_final.zkey`),
  vkey: path.join(PUBLIC_ZK, VKEY_FILE[c]),
  publicWasm: path.join(PUBLIC_ZK, `${c}.wasm`),
});

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[a.slice(2)] = true;
      else flags[a.slice(2)] = argv[++i];
    } else positional.push(a);
  }
  return { positional, flags };
}

const sha256File = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function readTranscript(c: CeremonyCircuit): CeremonyTranscript {
  const p = paths(c).transcript;
  if (!fs.existsSync(p)) die(`No ceremony for ${c}. Run: npm run ceremony -- init ${c}`);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeTranscript(t: CeremonyTranscript) {
  const p = paths(t.circuit).transcript;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(t, null, 2) + "\n");
}

/** Latest zkey in the workspace and the path for the next one. */
function workspaceZkeys(c: CeremonyCircuit) {
  const dir = paths(c).workspace;
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}\.zkey$/.test(f)).sort() : [];
  if (files.length === 0) die(`Empty ceremony workspace for ${c}. Run: npm run ceremony -- init ${c}`);
  const n = files.length;
  return {
    latest: path.join(dir, files[n - 1]),
    next: path.join(dir, `${String(n).padStart(4, "0")}.zkey`),
  };
}

function requireInputs(c: CeremonyCircuit) {
  const p = paths(c);
  if (!fs.existsSync(p.r1cs)) die(`${p.r1cs} missing. Compile first: npm run compile-circuit${c === "kyc_reveal" ? ":reveal" : ""}`);
  if (!fs.existsSync(p.ptau)) die(`${p.ptau} missing. Download it:\n  wget ${PTAU.url} -O circuits/${PTAU.file}`);
  if (sha256File(p.ptau) !== PTAU.sha256) die(`${p.ptau} is not the expected PSE ppot_0080_14 file (sha256 mismatch).`);
}

/** Run snarkjs's full check of a zkey against r1cs + ptau, and read back its contribution chain. */
async function verifyZkey(c: CeremonyCircuit, zkey: string) {
  const p = paths(c);
  const lines: string[] = [];
  const errors: string[] = [];
  const logger = {
    info: (m: string) => lines.push(String(m)),
    warn: (m: string) => lines.push(String(m)),
    error: (m: string) => errors.push(String(m)),
    debug: () => {},
  };
  const ok = await snarkjs.zKey.verifyFromR1cs(p.r1cs, p.ptau, zkey, logger);
  return { ok: Boolean(ok), errors, chain: parseVerifyLog(lines) };
}

function userEntropy(flag: string | true | undefined): string {
  // System randomness always goes in; anything the contributor adds is extra.
  const extra = typeof flag === "string" ? flag : "";
  return crypto.randomBytes(64).toString("hex") + extra;
}

async function cmdInit(c: CeremonyCircuit, flags: Record<string, string | true>) {
  requireInputs(c);
  const p = paths(c);
  if (fs.existsSync(p.workspace)) fs.rmSync(p.workspace, { recursive: true });
  fs.mkdirSync(p.workspace, { recursive: true });
  await snarkjs.zKey.newZKey(p.r1cs, p.ptau, path.join(p.workspace, "0000.zkey"));
  writeTranscript(newTranscript(c, sha256File(p.r1cs), flags.demo === true));
  console.log(`✓ Ceremony started for ${c}. Next: npm run ceremony -- contribute ${c} --name "<your name>"`);
}

async function cmdContribute(c: CeremonyCircuit, flags: Record<string, string | true>) {
  const name = flags.name;
  if (typeof name !== "string" || !name.trim()) die("--name is required.");
  if (/[\n:]/.test(name)) die("--name can't contain newlines or colons.");
  const external = typeof flags.in === "string" || typeof flags.out === "string";
  if (external && (typeof flags.in !== "string" || typeof flags.out !== "string")) die("Pass both --in and --out.");

  const { latest, next } = external ? { latest: "", next: "" } : workspaceZkeys(c);
  const input = external ? path.resolve(flags.in as string) : latest;
  const output = external ? path.resolve(flags.out as string) : next;
  if (!fs.existsSync(input)) die(`${input} not found.`);

  const entropy = userEntropy(flags.entropy);
  const hash = hashToHex(await snarkjs.zKey.contribute(input, output, name.trim(), entropy));
  console.log(`✓ Contribution written → ${path.relative(process.cwd(), output)}`);
  console.log(`  Your contribution hash (publish it somewhere others can see):\n  ${hash}`);
  console.log("  Your randomness was used once and is gone when this process exits. Don't keep a copy.");

  if (!external) await accept(c, output, true);
}

/** Record the newest contribution in a zkey, after checking it extends the transcript. */
async function accept(c: CeremonyCircuit, zkey: string, inWorkspace = false) {
  requireInputs(c);
  const t = readTranscript(c);
  if (t.beacon) die("This ceremony is already closed by a beacon.");
  const res = await verifyZkey(c, zkey);
  if (!res.ok) die(`zkey failed verification: ${res.errors.join("; ") || "see snarkjs output"}`);

  const prior = res.chain.slice(0, -1);
  const newest = res.chain[res.chain.length - 1];
  if (!newest || newest.beacon) die("zkey has no new contribution.");
  const chainOk =
    prior.length === t.contributions.length &&
    prior.every((z, i) => z.hash === t.contributions[i].hash && z.name === t.contributions[i].name);
  if (!chainOk) die("zkey does not extend this ceremony's current chain. Was it built from the latest zkey?");

  if (!inWorkspace) fs.copyFileSync(zkey, workspaceZkeys(c).next);
  t.contributions.push({ index: newest.index, name: newest.name, hash: newest.hash, at: new Date().toISOString() });
  writeTranscript(t);
  console.log(`✓ Recorded contribution #${newest.index} (${newest.name}).`);
}

async function cmdBeacon(c: CeremonyCircuit, flags: Record<string, string | true>) {
  const source = flags.source;
  const value = typeof flags.value === "string" ? flags.value.toLowerCase().replace(/^0x/, "") : "";
  const iterationsExp = flags.iterations === undefined ? 10 : Number(flags.iterations);
  if (typeof source !== "string" || !source.trim()) die("--source is required (say where the value comes from).");
  if (!/^[0-9a-f]{2,510}$/.test(value) || value.length % 2) die("--value must be hex.");
  if (!Number.isInteger(iterationsExp) || iterationsExp < 10 || iterationsExp > 63) die("--iterations must be 10..63.");

  const t = readTranscript(c);
  if (t.beacon) die("This ceremony already has a beacon.");
  if (!t.demo && t.contributions.length < 3) die(`Need at least 3 contributions before the beacon (have ${t.contributions.length}).`);
  const { latest, next } = workspaceZkeys(c);
  const hash = await snarkjs.zKey.beacon(latest, next, "Final Beacon", value, iterationsExp);
  if (!hash) die("snarkjs rejected the beacon.");
  t.beacon = { source: source.trim(), value, iterationsExp, hash: hashToHex(hash) };
  writeTranscript(t);
  console.log(`✓ Beacon applied (${t.beacon.source}). Next: npm run ceremony -- finalize ${c}`);
}

async function cmdFinalize(c: CeremonyCircuit) {
  requireInputs(c);
  const p = paths(c);
  const t = readTranscript(c);
  if (!t.beacon) die("Apply the beacon first.");
  const { latest } = workspaceZkeys(c);
  const res = await verifyZkey(c, latest);
  if (!res.ok) die(`Final zkey failed verification: ${res.errors.join("; ")}`);
  const problems = transcriptMismatches(t, res.chain);
  if (problems.length) die(`Transcript doesn't match the zkey:\n  - ${problems.join("\n  - ")}`);

  fs.mkdirSync(PUBLIC_ZK, { recursive: true });
  fs.copyFileSync(latest, p.finalZkey);
  fs.writeFileSync(p.vkey, JSON.stringify(await snarkjs.zKey.exportVerificationKey(p.finalZkey), null, 2));
  fs.copyFileSync(p.wasm, p.publicWasm);
  t.final = { zkeySha256: sha256File(p.finalZkey), vkeySha256: sha256File(p.vkey), wasmSha256: sha256File(p.publicWasm) };
  writeTranscript(t);
  console.log(`✓ ${c} finalized → public/zk/. Commit public/zk and ceremony/${c}.json.`);
}

async function cmdVerify(c: CeremonyCircuit) {
  requireInputs(c);
  const p = paths(c);
  const t = readTranscript(c);
  const problems: string[] = [];
  if (!t.final) die("Ceremony isn't finalized.");
  if (t.ptau.sha256 !== PTAU.sha256) problems.push("transcript names a different Powers of Tau.");
  if (sha256File(p.r1cs) !== t.r1csSha256) {
    problems.push(`compiled r1cs doesn't match the transcript. Compile with ${t.compiler}.`);
  }
  if (sha256File(p.finalZkey) !== t.final.zkeySha256) problems.push("public zkey doesn't match the transcript.");
  if (sha256File(p.vkey) !== t.final.vkeySha256) problems.push("public verification key doesn't match the transcript.");
  if (sha256File(p.publicWasm) !== t.final.wasmSha256) problems.push("public wasm doesn't match the transcript.");

  const res = await verifyZkey(c, p.finalZkey);
  if (!res.ok) problems.push(`snarkjs zkey verify failed: ${res.errors.join("; ") || "invalid"}`);
  else problems.push(...transcriptMismatches(t, res.chain));

  const vkey = await snarkjs.zKey.exportVerificationKey(p.finalZkey);
  if (JSON.stringify(vkey) !== JSON.stringify(JSON.parse(fs.readFileSync(p.vkey, "utf-8")))) {
    problems.push("verification key isn't the one this zkey exports.");
  }

  if (problems.length) die(`${c}: ceremony check failed:\n  - ${problems.join("\n  - ")}`);
  console.log(`✓ ${c}: zkey verified against circuit + Powers of Tau; ${t.contributions.length} contributions + beacon match ceremony/${c}.json.`);
  for (const k of t.contributions) console.log(`    #${k.index} ${k.name}  ${k.hash.slice(0, 16)}…`);
  console.log(`    beacon: ${t.beacon!.source}`);
  if (t.demo) console.log("  ⚠ DEMO ceremony: one operator made every contribution. It does not remove trust in that operator.");
}

/** drand's public randomness beacon (League of Entropy), default network. */
async function drandLatest(): Promise<{ round: number; randomness: string }> {
  const res = await fetch("https://api.drand.sh/public/latest");
  if (!res.ok) throw new Error(`drand returned ${res.status}`);
  return res.json();
}

async function cmdDemo(c: CeremonyCircuit) {
  await cmdInit(c, { demo: true });
  for (const n of ["Demo contributor A", "Demo contributor B", "Demo contributor C"]) {
    await cmdContribute(c, { name: n });
  }
  let source: string;
  let value: string;
  try {
    const d = await drandLatest();
    source = `drand mainnet round ${d.round} (demo: round taken at run time, not announced in advance)`;
    value = d.randomness;
  } catch (e) {
    die(`Couldn't reach drand for the beacon (${(e as Error).message}). Use beacon --source/--value by hand.`);
  }
  await cmdBeacon(c, { source, value });
  await cmdFinalize(c);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  if (!command || command === "help" || flags.help) {
    console.log(USAGE);
    return;
  }
  const circuit = positional[0] as CeremonyCircuit;
  if (!CEREMONY_CIRCUITS.includes(circuit)) die(`Name a circuit: ${CEREMONY_CIRCUITS.join(" or ")}.\n\n${USAGE}`);

  switch (command) {
    case "init": return cmdInit(circuit, flags);
    case "contribute": return cmdContribute(circuit, flags);
    case "accept":
      if (!positional[1]) die("accept needs a zkey file.");
      return accept(circuit, path.resolve(positional[1]));
    case "beacon": return cmdBeacon(circuit, flags);
    case "finalize": return cmdFinalize(circuit);
    case "verify": return cmdVerify(circuit);
    case "demo": return cmdDemo(circuit);
    default: die(`Unknown command "${command}".\n\n${USAGE}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => die(e instanceof Error ? e.message : String(e))
);
