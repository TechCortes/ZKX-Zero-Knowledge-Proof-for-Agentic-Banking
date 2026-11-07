import { describe, it, expect } from "vitest";
import { newTranscript, parseVerifyLog, transcriptMismatches, type CeremonyTranscript } from "./ceremony";

const H = (c: string) => Array.from({ length: 4 }, () => `\t\t${Array(4).fill(c.repeat(8)).join(" ")}`).join("\n");

// What snarkjs's zkey verifier logs, newest contribution first.
const LOG = [
  "Circuit Hash: ",
  "-------------------------",
  `contribution #3 Final Beacon:\n${H("c")}`,
  "Beacon generator: abcd",
  "Beacon iterations Exp: 10",
  "-------------------------",
  `contribution #2 Bob:\n${H("b")}`,
  "-------------------------",
  `contribution #1 Alice:\n${H("a")}`,
  "-------------------------",
  "ZKey Ok!",
];

function transcript(demo = true): CeremonyTranscript {
  const t = newTranscript("kyc_credential", "r1cs", demo);
  t.contributions = [
    { index: 1, name: "Alice", hash: "a".repeat(128), at: "" },
    { index: 2, name: "Bob", hash: "b".repeat(128), at: "" },
  ];
  t.beacon = { source: "drand", value: "abcd", iterationsExp: 10, hash: "c".repeat(128) };
  return t;
}

describe("ceremony transcript", () => {
  it("parses snarkjs's contribution log, oldest first", () => {
    expect(parseVerifyLog(LOG)).toEqual([
      { index: 1, name: "Alice", hash: "a".repeat(128) },
      { index: 2, name: "Bob", hash: "b".repeat(128) },
      { index: 3, name: "Final Beacon", hash: "c".repeat(128), beacon: { value: "abcd", iterationsExp: 10 } },
    ]);
  });

  it("matches a faithful transcript", () => {
    expect(transcriptMismatches(transcript(), parseVerifyLog(LOG))).toEqual([]);
  });

  it("flags edited names, hashes, beacons and missing contributions", () => {
    const chain = parseVerifyLog(LOG);
    const t1 = transcript();
    t1.contributions[1].name = "Mallory";
    expect(transcriptMismatches(t1, chain).join()).toMatch(/named "Bob"/);
    const t2 = transcript();
    t2.contributions[0].hash = "d".repeat(128);
    expect(transcriptMismatches(t2, chain).join()).toMatch(/hash does not match/);
    const t3 = transcript();
    t3.beacon!.value = "ffff";
    expect(transcriptMismatches(t3, chain).join()).toMatch(/beacon value/);
    const t4 = transcript();
    t4.contributions.pop();
    expect(transcriptMismatches(t4, chain).join()).toMatch(/2 transcript|lists 2/);
  });

  it("requires 3 contributors and a beacon outside demo mode", () => {
    expect(transcriptMismatches(transcript(false), parseVerifyLog(LOG)).join()).toMatch(/at least 3/);
    const t = transcript();
    t.beacon = null;
    expect(transcriptMismatches(t, parseVerifyLog(LOG).slice(0, 2)).join()).toMatch(/no closing beacon/);
  });
});
