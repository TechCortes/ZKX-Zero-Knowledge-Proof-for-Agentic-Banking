/**
 * ZQUENT — audit chain CLI.
 *
 *   npm run audit -- keygen
 *       Make a ZQUENT_AUDIT_SIGNING_KEY seed and print its public key.
 *
 *   npm run audit -- checkpoint
 *       Operator: sign checkpoints now (the daily cron does the same).
 *       Needs ZQUENT_AUDIT_SIGNING_KEY (or legacy VERO_AUDIT_SIGNING_KEY) and the store credentials.
 *
 *   npm run audit -- verify --url https://<deployment> [--key pub.json] [--record record.json]
 *       Anyone: download the published checkpoints and check every signature
 *       (Ed25519 AND ML-DSA-65) and every link. With --record (one entry from
 *       GET /api/v1/audit), also check that this record is covered, unchanged.
 *       Pin the signing key with --key; otherwise the key the server reports is used.
 */

import fs from "fs";
import { generateAuditSigningSeed, signerFromSeed, getAuditSigner, type HybridPublicKey } from "../src/lib/auditSigning";
import {
  createAuditCheckpoint,
  verifyCheckpoints,
  verifyLeaves,
  verifyRecordInclusion,
  type AuditCheckpoint,
} from "../src/policy/auditCheckpoint";
import type { AuditRecord } from "../src/policy/auditLog";

type Flags = Record<string, string>;

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--") || argv[i + 1] === undefined) fail(`Bad argument: ${argv[i]}`);
    flags[argv[i].slice(2)] = argv[i + 1];
  }
  return flags;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) fail(`${url} returned ${res.status}.`);
  return (await res.json()) as T;
}

async function keygen() {
  const seed = generateAuditSigningSeed();
  const { publicKey } = signerFromSeed(seed);
  console.log("Server config (SECRET — store it like a private key):");
  console.log(`  ZQUENT_AUDIT_SIGNING_KEY="${seed}"\n`);
  console.log("Public key (publish it; verifiers pin it with --key):");
  console.log(JSON.stringify(publicKey, null, 2));
}

async function checkpoint() {
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    fail("No store credentials in the environment (KV_REST_API_URL / KV_REST_API_TOKEN).");
  }
  const signer = getAuditSigner();
  if (!signer) fail("ZQUENT_AUDIT_SIGNING_KEY (or legacy VERO_AUDIT_SIGNING_KEY) is not set.");
  let count = 0;
  for (let cp = await createAuditCheckpoint(signer); cp; cp = await createAuditCheckpoint(signer)) {
    console.log(`Checkpoint ${cp.index}: seq ${cp.fromSeq}–${cp.toSeq}${cp.voided.length ? ` (${cp.voided.length} voided)` : ""}`);
    count++;
  }
  if (count === 0) console.log("Nothing new to checkpoint.");
}

async function verify(flags: Flags) {
  const base = (flags.url ?? fail("--url is required.")).replace(/\/$/, "");
  const listed = await getJson<{ publicKey: HybridPublicKey | null; checkpoints: AuditCheckpoint[] }>(
    `${base}/api/v1/audit/checkpoints`
  );
  const key: HybridPublicKey | null = flags.key ? JSON.parse(fs.readFileSync(flags.key, "utf-8")) : listed.publicKey;
  if (!key) fail("The server reports no signing key, and none was given with --key.");
  if (!flags.key) console.log(`(Using the server-reported key ${key.keyId}. Pin it with --key for a real check.)`);
  if (listed.checkpoints.length === 0) fail("No checkpoints published yet.");

  const ordered = [...listed.checkpoints].sort((a, b) => a.index - b.index);
  const chain = verifyCheckpoints(ordered, key);
  if (!chain.ok) fail(chain.error);
  console.log(`✓ ${ordered.length} checkpoint(s), #${ordered[0].index}–#${ordered.at(-1)!.index}: signatures and links verify.`);

  if (flags.record) {
    const record = JSON.parse(fs.readFileSync(flags.record, "utf-8")) as AuditRecord;
    if (record.seq === undefined) fail("That record predates the audit chain (no seq).");
    const cp = ordered.find((c) => record.seq! >= c.fromSeq && record.seq! <= c.toSeq);
    if (!cp) fail(`No published checkpoint covers seq ${record.seq} yet.`);
    const detail = await getJson<{ checkpoint: AuditCheckpoint; leaves: string[] }>(
      `${base}/api/v1/audit/checkpoints?index=${cp.index}`
    );
    const leaves = verifyLeaves(cp, detail.leaves);
    if (!leaves.ok) fail(leaves.error);
    const inc = verifyRecordInclusion(record, cp, detail.leaves);
    if (!inc.ok) fail(inc.error);
    console.log(`✓ Record seq ${record.seq} is covered, unchanged, by checkpoint #${cp.index}.`);
  }
}

const COMMANDS: Record<string, (f: Flags) => Promise<void>> = { keygen, checkpoint, verify };

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !COMMANDS[cmd]) {
    console.log("Usage: npm run audit -- <keygen | checkpoint | verify --url <deployment> [--key pub.json] [--record record.json]>");
    process.exit(cmd ? 1 : 0);
  }
  await COMMANDS[cmd](parseFlags(rest));
  process.exit(0);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
