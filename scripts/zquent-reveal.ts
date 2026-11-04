/**
 * ZQUENT — reference threshold-reveal CLI (ROADMAP.md phase 2, step 3).
 *
 * NOT PRODUCTION KEY MANAGEMENT. Shares are plain JSON files and `keygen` uses a
 * trusted dealer. It exists so forkers can run the whole disclosure round-trip
 * before wiring real HSM / consortium infrastructure. See docs/threshold-reveal.md.
 *
 *   npm run reveal -- keygen  --threshold 2 --parties 3 --out ./consortium
 *   npm run reveal -- kem-keygen --index 1 --out ./member-1          (each member, on their own machine)
 *   npm run reveal -- escrow-keys --threshold 2 member-*.pub.json   (operator: prints ZQUENT_ESCROW_KEYS)
 *   npm run reveal -- escrow  --tx <txId> --out env.json     (operator: reads the escrow store)
 *   npm run reveal -- unseal  --member-key ./member-1/member-1.key.json --envelope env.json --out part-1.json
 *   npm run reveal -- open    --envelope env.json --out ct.json part-1.json part-3.json
 *   npm run reveal -- extract --audit audit.json --tx <txId> --out ct.json   (older audit exports)
 *   npm run reveal -- partial --share ./consortium/share-1.json --ciphertext ct.json --out p1.json
 *   npm run reveal -- combine --consortium ./consortium/consortium.json --ciphertext ct.json p1.json p3.json
 *   npm run reveal -- demo    (everything above, in memory, with a sample identity)
 */

import fs from "fs";
import path from "path";
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
import { getRevealEscrow, hashRevealCiphertext, sealUnsealedEscrows, serializeRevealCiphertext } from "../src/policy/escrow";
import {
  ESCROW_FORMAT,
  ESCROW_KEYS_FORMAT,
  generateEscrowMemberKey,
  parseEscrowKeySet,
  sealEscrow,
  unsealEscrowShare,
  openEscrow,
  type EscrowEnvelope,
  type EscrowMemberKey,
  type EscrowSharePart,
} from "../src/zkp/escrowSeal";
import { getEscrowKeySet } from "../src/zkp/revealConfig";

const USAGE = `Usage: npm run reveal -- <command> [options]

Commands:
  keygen   --threshold <k> --parties <n> --out <dir>
           Deal a k-of-n consortium key (trusted dealer, reference only). For a real
           consortium use \`npm run dkg\` instead: no one ever holds the whole key.
           Writes <dir>/consortium.json (public) and <dir>/share-<i>.json (secret, one per party).

  kem-keygen  --index <i> --out <dir>
           Run by EACH consortium member on their own machine: make their post-quantum
           (X-Wing: ML-KEM-768 + X25519) escrow key. Writes member-<i>.key.json (secret)
           and member-<i>.pub.json (public, send to the operator).

  escrow-keys --threshold <k> <member-*.pub.json...>
           Operator: assemble the members' public keys into the ZQUENT_ESCROW_KEYS value.

  escrow   --tx <txId> --out <file>
           Operator only: read one transaction's record from the reveal escrow. Writes the
           sealed envelope (vero-escrow/v2), or the bare ciphertext for unsealed records.
           Needs the store credentials (KV_REST_API_URL / KV_REST_API_TOKEN) in the environment.

  seal-pending
           Operator only: seal every unsealed escrow record with ZQUENT_ESCROW_KEYS (legacy VERO_ESCROW_KEYS is also read). Safe to re-run.

  unseal   --member-key <file> --envelope <file> --out <file>
           Run by ONE member: recover their share of the envelope key.

  open     --envelope <file> --out <file> <share part files...>
           Combine k share parts and write the inner ciphertext (checked against its hash).
           Then run partial / combine on it as usual.

  extract  --audit <file> --tx <txId> --out <file>
           Pull the ciphertext out of a saved escrow record, or out of an audit export made
           before ciphertexts moved to the escrow (current audit exports carry only a hash).

  partial  --share <file> --ciphertext <file> --out <file>
           Run by ONE consortium member: apply their share to one ciphertext.

  combine  --consortium <file> --ciphertext <file> <partial files...>
           Verify each partial and decrypt once at least k are valid.

  demo     Run the whole round-trip in memory with a sample identity:
           keygen → encrypt → seal → unseal ×k → open → partial ×k → combine.`;

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

function readJson<T>(file: string, what: string, format: string = REVEAL_FORMAT): T {
  let data: { format?: string };
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    fail(`Could not read ${what} from ${file}: ${err instanceof Error ? err.message : err}`);
  }
  if (data.format !== undefined && data.format !== format) {
    fail(`${file} is format "${data.format}", expected "${format}".`);
  }
  return data as T;
}

function needStore() {
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    fail("No store credentials in the environment (KV_REST_API_URL / KV_REST_API_TOKEN).");
  }
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
  console.log(`\nServer config:\n  ZQUENT_REVEAL_PUBLIC_KEY="${consortium.publicKey.join(",")}"`);
}

function writeCiphertext(out: string, tx: string, ct: RevealCiphertext, expectedHash?: string) {
  if (expectedHash && hashRevealCiphertext(ct) !== expectedHash) {
    fail(`Ciphertext for ${tx} does not match its recorded hash. It was altered after escrow.`);
  }
  writeJson(out, ct);
  console.log(`Wrote ciphertext for ${tx} (commitment ${ct.commitment.slice(0, 12)}…)`);
}

async function kemKeygen(flags: Flags) {
  const index = Number(need(flags, "index"));
  const out = need(flags, "out");
  const key = (() => {
    try {
      return generateEscrowMemberKey(index);
    } catch (e) {
      return fail((e as Error).message);
    }
  })();
  writeJson(path.join(out, `member-${index}.key.json`), key, true);
  writeJson(path.join(out, `member-${index}.pub.json`), { format: key.format, index, publicKey: key.publicKey });
  console.log(`Member ${index}: escrow key written to ${out}/`);
  console.log(`  member-${index}.key.json  SECRET — keep it (an HSM in production); never send it anywhere`);
  console.log(`  member-${index}.pub.json  public — send to the operator`);
}

async function escrowKeys(flags: Flags) {
  const threshold = Number(need(flags, "threshold"));
  if (flags._.length === 0) fail("Pass the members' public key files.");
  const members = flags._.map((f) => readJson<{ index: number; publicKey: string }>(f, "member public key", ESCROW_KEYS_FORMAT));
  try {
    const ks = parseEscrowKeySet({ format: ESCROW_KEYS_FORMAT, threshold, members });
    console.log(`Server config (${threshold}-of-${members.length}):\n  ZQUENT_ESCROW_KEYS='${JSON.stringify(ks)}'`);
  } catch (e) {
    fail((e as Error).message);
  }
}

async function escrow(flags: Flags) {
  const tx = need(flags, "tx");
  needStore();
  const record = await getRevealEscrow(tx);
  if (!record) fail(`No escrow record for ${tx} (reveal was off for that payment, or the txId is wrong).`);
  if (record.envelope) {
    writeJson(need(flags, "out"), record.envelope);
    console.log(`Wrote sealed envelope for ${tx} (${record.envelope.threshold}-of-${record.envelope.parties}). Each member runs: unseal`);
    return;
  }
  writeCiphertext(need(flags, "out"), tx, record.ciphertext, record.ciphertextHash);
}

async function sealPending() {
  needStore();
  const keys = getEscrowKeySet();
  if (!keys) fail("ZQUENT_ESCROW_KEYS (or legacy VERO_ESCROW_KEYS) is not set.");
  const { sealed, alreadySealed } = await sealUnsealedEscrows(keys);
  console.log(`Sealed ${sealed} record(s); ${alreadySealed} were already sealed.`);
}

async function unseal(flags: Flags) {
  const member = readJson<EscrowMemberKey>(need(flags, "member-key"), "member key", ESCROW_KEYS_FORMAT);
  const env = readJson<EscrowEnvelope>(need(flags, "envelope"), "envelope", ESCROW_FORMAT);
  let part: EscrowSharePart;
  try {
    part = unsealEscrowShare(member, env);
  } catch (e) {
    fail((e as Error).message);
  }
  writeJson(need(flags, "out"), part, true);
  console.log(`Member ${member.index}: share part written. Send it only to whoever runs \`open\`.`);
}

async function openCmd(flags: Flags) {
  const env = readJson<EscrowEnvelope>(need(flags, "envelope"), "envelope", ESCROW_FORMAT);
  if (flags._.length === 0) fail("Pass the share part files.");
  const parts = flags._.map((f) => readJson<EscrowSharePart>(f, "share part", ESCROW_FORMAT));
  let ct: RevealCiphertext;
  try {
    ct = JSON.parse(openEscrow(env, parts).toString("utf-8"));
  } catch (e) {
    fail((e as Error).message);
  }
  writeCiphertext(need(flags, "out"), env.txId, ct, env.ciphertextHash);
}

async function extract(flags: Flags) {
  const tx = need(flags, "tx");
  const data = readJson<{ entries?: unknown[] }>(need(flags, "audit"), "audit log");
  const entries = (Array.isArray(data.entries) ? data.entries : [data]) as {
    txId?: string;
    revealCiphertext?: RevealCiphertext; // audit exports from before the escrow split
    ciphertext?: RevealCiphertext;       // an escrow record
    ciphertextHash?: string;
    revealEscrow?: { ciphertextHash: string };
  }[];
  const entry = entries.find((e) => e.txId === tx);
  if (!entry) fail(`No record with txId ${tx}.`);
  const ct = entry.ciphertext ?? entry.revealCiphertext;
  if (!ct) {
    fail(entry.revealEscrow
      ? `Record ${tx} only carries the ciphertext's hash. Ask the operator to run: npm run reveal -- escrow --tx ${tx}`
      : `Record ${tx} has no reveal ciphertext (reveal was off for that payment).`);
  }
  writeCiphertext(need(flags, "out"), tx, ct, entry.ciphertextHash);
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
  console.log("3. Each member makes their own post-quantum escrow key; the server seals the ciphertext");
  const members = [1, 2, 3].map(generateEscrowMemberKey);
  const escrowKeySet = parseEscrowKeySet({
    format: ESCROW_KEYS_FORMAT,
    threshold: 2,
    members: members.map(({ index, publicKey }) => ({ index, publicKey })),
  });
  const envelope = sealEscrow(escrowKeySet, "zquent_demo", serializeRevealCiphertext(ct), hashRevealCiphertext(ct));
  console.log(`   envelope: ${JSON.stringify(envelope).length} bytes, ${envelope.parties} sealed shares`);
  console.log("4. Members 1 and 3 unseal their shares; the envelope opens");
  const opened: RevealCiphertext = JSON.parse(
    openEscrow(envelope, [unsealEscrowShare(members[0], envelope), unsealEscrowShare(members[2], envelope)]).toString("utf-8")
  );
  console.log(`   inner ciphertext matches: ${hashRevealCiphertext(opened) === envelope.ciphertextHash}`);
  console.log("5. Parties 1 and 3 each make a partial decryption");
  const partials = await Promise.all([partialDecrypt(shares[0], opened), partialDecrypt(shares[2], opened)]);
  console.log("6. Combine");
  const out = await combinePartials(consortium, opened, partials);
  console.log(JSON.stringify(out, null, 2));
  console.log("\n7. One party alone:");
  await combinePartials(consortium, opened, [partials[0]]).catch((e) => console.log(`   refused — ${e.message}`));
  try {
    openEscrow(envelope, [unsealEscrowShare(members[0], envelope)]);
  } catch (e) {
    console.log(`   refused — ${(e as Error).message}`);
  }
}

const COMMANDS: Record<string, (f: Flags) => Promise<void>> = {
  keygen,
  "kem-keygen": kemKeygen,
  "escrow-keys": escrowKeys,
  escrow,
  "seal-pending": sealPending,
  unseal,
  open: openCmd,
  extract,
  partial,
  combine,
  demo,
};

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
