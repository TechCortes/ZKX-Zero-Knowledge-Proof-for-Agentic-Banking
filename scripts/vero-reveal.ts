/**
 * Vero Protocol — reference threshold-reveal CLI (ROADMAP.md phase 2, step 3).
 *
 * NOT PRODUCTION KEY MANAGEMENT. Shares are plain JSON files and `keygen` uses a
 * trusted dealer. It exists so forkers can run the whole disclosure round-trip
 * before wiring real HSM / consortium infrastructure. See docs/threshold-reveal.md.
 *
 *   npm run reveal -- keygen  --threshold 2 --parties 3 --out ./consortium
 *   npm run reveal -- extract --audit audit.json --tx <txId> --out ct.json
 *   npm run reveal -- partial --share ./consortium/share-1.json --ciphertext ct.json --out p1.json
 *   npm run reveal -- combine --consortium ./consortium/consortium.json --ciphertext ct.json p1.json p3.json
 *   npm run reveal -- demo    (everything above, in memory, with a sample identity)
 */

import fs from "fs";
import path from "path";
import { webcrypto } from "crypto";
import {
  REVEAL_FORMAT,
  dealKeyShares,
  encryptForReveal,
  partialDecrypt,
  combinePartials,
  randomRevealNonce,
  type ConsortiumKey,
  type KeyShare,
  type PartialDecryption,
  type RevealCiphertext,
} from "../src/zkp/reveal";

// Node 18 has no global WebCrypto by default; reveal.ts uses crypto.getRandomValues.
if (!globalThis.crypto) (globalThis as { crypto: unknown }).crypto = webcrypto;

const USAGE = `Usage: npm run reveal -- <command> [options]

Commands:
  keygen   --threshold <k> --parties <n> --out <dir>
           Deal a k-of-n consortium key (trusted dealer, reference only).
           Writes <dir>/consortium.json (public) and <dir>/share-<i>.json (secret, one per party).

  extract  --audit <file> --tx <txId> --out <file>
           Pull the reveal ciphertext for one transaction out of a GET /api/v1/audit response
           (or a single audit record).

  partial  --share <file> --ciphertext <file> --out <file>
           Run by ONE consortium member: apply their share to one ciphertext.

  combine  --consortium <file> --ciphertext <file> <partial files...>
           Verify each partial and decrypt once at least k are valid.

  demo     Run keygen → encrypt → partial ×k → combine in memory with a sample identity.`;

type Flags = Record<string, string> & { _: string[] };

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] } as unknown as Flags;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`Missing value for ${argv[i]}.`);
      flags[argv[i].slice(2)] = value;
      i++;
    } else {
      flags._.push(argv[i]);
    }
  }
  return flags;
}

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function need(flags: Flags, name: string): string {
  if (!flags[name]) fail(`--${name} is required.\n\n${USAGE}`);
  return flags[name];
}

function readJson<T>(file: string, what: string): T {
  let data: { format?: string };
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    fail(`Could not read ${what} from ${file}: ${err instanceof Error ? err.message : err}`);
  }
  if (data.format !== undefined && data.format !== REVEAL_FORMAT) {
    fail(`${file} is format "${data.format}", expected "${REVEAL_FORMAT}".`);
  }
  return data as T;
}

function writeJson(file: string, data: unknown, secret = false) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: secret ? 0o600 : 0o644 });
}

async function keygen(flags: Flags) {
  const k = Number(need(flags, "threshold"));
  const n = Number(need(flags, "parties"));
  const out = need(flags, "out");
  const { consortium, shares } = await dealKeyShares(k, n);
  writeJson(path.join(out, "consortium.json"), consortium);
  for (const s of shares) writeJson(path.join(out, `share-${s.index}.json`), s, true);
  console.log(`Dealt a ${k}-of-${n} consortium key into ${out}/`);
  console.log(`  consortium.json   public — give to the server and every party`);
  console.log(`  share-1..${n}.json  SECRET — hand each to exactly one party, then delete the dealer's copies`);
  console.log(`\nServer config:\n  VERO_REVEAL_PUBLIC_KEY="${consortium.publicKey.join(",")}"`);
}

async function extract(flags: Flags) {
  const tx = need(flags, "tx");
  const data = readJson<{ entries?: unknown[] }>(need(flags, "audit"), "audit log");
  const entries = (Array.isArray(data.entries) ? data.entries : [data]) as {
    txId?: string;
    revealCiphertext?: RevealCiphertext;
  }[];
  const entry = entries.find((e) => e.txId === tx);
  if (!entry) fail(`No audit record with txId ${tx}.`);
  if (!entry.revealCiphertext) fail(`Audit record ${tx} has no reveal ciphertext (reveal was off for that payment).`);
  writeJson(need(flags, "out"), entry.revealCiphertext);
  console.log(`Wrote ciphertext for ${tx} (commitment ${entry.revealCiphertext.commitment.slice(0, 12)}…)`);
}

async function partial(flags: Flags) {
  const share = readJson<KeyShare>(need(flags, "share"), "key share");
  const ct = readJson<RevealCiphertext>(need(flags, "ciphertext"), "ciphertext");
  const pd = await partialDecrypt(share, ct).catch((e) => fail(e.message));
  writeJson(need(flags, "out"), pd);
  console.log(`Party ${share.index}: partial decryption written. It reveals nothing on its own.`);
}

async function combine(flags: Flags) {
  const consortium = readJson<ConsortiumKey>(need(flags, "consortium"), "consortium key");
  const ct = readJson<RevealCiphertext>(need(flags, "ciphertext"), "ciphertext");
  if (flags._.length === 0) fail("Pass the partial decryption files to combine.");
  const partials = flags._.map((f) => readJson<PartialDecryption>(f, "partial decryption"));
  const out = await combinePartials(consortium, ct, partials).catch((e) => fail(e.message));
  if (!out.commitmentMatches) {
    fail("Decryption does not match the ciphertext's commitment. The ciphertext was altered after the proof was verified.");
  }
  console.log(JSON.stringify(out, null, 2));
}

async function demo() {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const identity = { idHash: "123456789", birthYear: 1990, salt: "987654321" };
  const commitment = poseidon.F.toString(poseidon([BigInt(identity.idHash), BigInt(identity.salt)]));

  console.log("1. Deal a 2-of-3 consortium key");
  const { consortium, shares } = await dealKeyShares(2, 3);
  console.log("2. Encrypt the identity (the kyc_reveal circuit does this inside the proof)");
  const ct = await encryptForReveal(consortium.publicKey, identity, commitment, await randomRevealNonce());
  console.log("3. Parties 1 and 3 each make a partial decryption");
  const partials = await Promise.all([partialDecrypt(shares[0], ct), partialDecrypt(shares[2], ct)]);
  console.log("4. Combine");
  const out = await combinePartials(consortium, ct, partials);
  console.log(JSON.stringify(out, null, 2));
  console.log("\n5. One party alone:");
  await combinePartials(consortium, ct, [partials[0]]).catch((e) => console.log(`   refused — ${e.message}`));
}

const COMMANDS: Record<string, (f: Flags) => Promise<void>> = { keygen, extract, partial, combine, demo };

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !COMMANDS[cmd]) {
    console.log(USAGE);
    process.exit(cmd ? 1 : 0);
  }
  await COMMANDS[cmd](parseFlags(rest));
  process.exit(0);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
