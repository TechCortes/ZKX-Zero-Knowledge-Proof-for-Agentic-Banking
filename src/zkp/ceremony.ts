/**
 * Groth16 phase-2 ceremony transcript (plan item D6). See docs/ceremony.md.
 *
 * A Groth16 proving key is only sound if at least one contributor to its
 * phase-2 setup destroyed their randomness. One contributor (the old
 * setup_zk.js) means the operator could forge proofs. The ceremony chains
 * several independent contributions and ends with a public random beacon, so
 * nobody — including the last contributor — controls the final key.
 *
 * The transcript (ceremony/<circuit>.json, committed) records what went in
 * and who contributed. Anyone can check it against the committed zkey with
 * `npm run ceremony -- verify <circuit>`; CI does this on every push.
 */

export const CEREMONY_FORMAT = "zquent-ceremony/v1";

export const CEREMONY_CIRCUITS = ["kyc_credential", "kyc_reveal"] as const;
export type CeremonyCircuit = (typeof CEREMONY_CIRCUITS)[number];

/** The Powers of Tau (phase 1) both circuits use. PSE Perpetual Powers of Tau, 2^14. */
export const PTAU = {
  file: "pot14_final.ptau",
  url: "https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_14.ptau",
  sha256: "3ca1149e9349b22b0ee0649399cfb787677129b7b1189d1899fc0d615d9583db",
} as const;

export const COMPILER = "circom 2.2.2 --O2";

export interface CeremonyContribution {
  index: number;
  name: string;
  /** snarkjs contribution hash, 128 hex chars. Each contributor publishes theirs independently. */
  hash: string;
  at: string;
}

export interface CeremonyBeacon {
  /** Where the value came from, e.g. "drand quicknet round 123456". Announce it before the round happens. */
  source: string;
  value: string;
  iterationsExp: number;
  hash: string;
}

export interface CeremonyTranscript {
  format: typeof CEREMONY_FORMAT;
  circuit: CeremonyCircuit;
  /** True for a run where one operator played every contributor. Gives no security. */
  demo: boolean;
  compiler: string;
  r1csSha256: string;
  ptau: { file: string; url: string; sha256: string };
  contributions: CeremonyContribution[];
  beacon: CeremonyBeacon | null;
  final: { zkeySha256: string; vkeySha256: string; wasmSha256: string } | null;
}

export function newTranscript(circuit: CeremonyCircuit, r1csSha256: string, demo: boolean): CeremonyTranscript {
  return {
    format: CEREMONY_FORMAT,
    circuit,
    demo,
    compiler: COMPILER,
    r1csSha256,
    ptau: { ...PTAU },
    contributions: [],
    beacon: null,
    final: null,
  };
}

export function hashToHex(hash: Uint8Array): string {
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** One contribution as reported by snarkjs's zkey verifier. */
export interface ZkeyContribution {
  index: number;
  name: string;
  hash: string;
  beacon?: { value: string; iterationsExp: number };
}

/**
 * snarkjs only reports the contribution chain through its logger. This turns
 * those lines back into data, ordered oldest first.
 */
export function parseVerifyLog(lines: string[]): ZkeyContribution[] {
  const out: ZkeyContribution[] = [];
  const text = lines.join("\n");
  const re = /contribution #(\d+) ?(.*?):\n((?:\s*[0-9a-f]{8}(?: [0-9a-f]{8}){3}\n?){4})(?:Beacon generator: ([0-9a-f]+)\nBeacon iterations Exp: (\d+))?/g;
  for (const m of text.matchAll(re)) {
    const c: ZkeyContribution = { index: Number(m[1]), name: m[2].trim(), hash: m[3].replace(/\s+/g, "") };
    if (m[4]) c.beacon = { value: m[4], iterationsExp: Number(m[5]) };
    out.push(c);
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Problems with a transcript, compared against what the zkey itself says. Empty means it matches. */
export function transcriptMismatches(t: CeremonyTranscript, chain: ZkeyContribution[]): string[] {
  const problems: string[] = [];
  const expected = t.contributions.length + (t.beacon ? 1 : 0);
  if (chain.length !== expected) {
    problems.push(`zkey has ${chain.length} contributions, transcript lists ${expected}.`);
  }
  t.contributions.forEach((c, i) => {
    const z = chain[i];
    if (!z) return;
    if (z.beacon) problems.push(`contribution #${i + 1} is a beacon in the zkey but not in the transcript.`);
    if (z.hash !== c.hash) problems.push(`contribution #${i + 1} (${c.name}) hash does not match the zkey.`);
    if (z.name !== c.name) problems.push(`contribution #${i + 1} is named "${z.name}" in the zkey, "${c.name}" in the transcript.`);
  });
  if (t.beacon) {
    const z = chain[t.contributions.length];
    if (!z?.beacon) problems.push("transcript lists a beacon but the zkey's last contribution is not one.");
    else {
      if (z.hash !== t.beacon.hash) problems.push("beacon contribution hash does not match the zkey.");
      if (z.beacon.value !== t.beacon.value) problems.push("beacon value does not match the zkey.");
      if (z.beacon.iterationsExp !== t.beacon.iterationsExp) problems.push("beacon iterations do not match the zkey.");
    }
  }
  if (!t.demo && t.contributions.length < 3) {
    problems.push(`a non-demo ceremony needs at least 3 contributors (has ${t.contributions.length}).`);
  }
  if (!t.beacon) problems.push("ceremony has no closing beacon.");
  return problems;
}
