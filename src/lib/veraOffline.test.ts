import { describe, it, expect } from "vitest";
import { offlineVeraReply } from "./veraOffline";

describe("offlineVeraReply", () => {
  it("labels every reply as offline", () => {
    for (const q of ["hi", "how does the proof work", "what is FATF R.16", ""]) {
      expect(offlineVeraReply(q)).toMatch(/offline mode/);
    }
  });

  it("routes common topics to the right answer", () => {
    expect(offlineVeraReply("How does the ZK proof work?")).toMatch(/Groth16/);
    expect(offlineVeraReply("What is the spending threshold?")).toMatch(/\$1,000/);
    expect(offlineVeraReply("How do I fork this?")).toMatch(/npm install/);
    expect(offlineVeraReply("Tell me about FATF and audit trails")).toMatch(/audit log/);
    expect(offlineVeraReply("does it work with OWS wallets?")).toMatch(/vero:kyc/);
  });

  it("falls back to an overview for unmatched questions", () => {
    expect(offlineVeraReply("What is Vero Protocol in one sentence?")).toMatch(/open-source zero-knowledge compliance/);
  });

  it("never says the old product name", () => {
    for (const q of ["fork", "fatf", "proof", "threshold", "ows", "privacy", "hello"]) {
      expect(offlineVeraReply(q)).not.toMatch(/zkx/i);
    }
  });
});
