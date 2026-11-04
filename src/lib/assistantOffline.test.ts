import { describe, it, expect } from "vitest";
import { offlineAssistantReply } from "./assistantOffline";

describe("offlineAssistantReply", () => {
  it("labels every reply as offline", () => {
    for (const q of ["hi", "how does the proof work", "what is FATF R.16", ""]) {
      expect(offlineAssistantReply(q)).toMatch(/offline mode/);
    }
  });

  it("routes common topics to the right answer", () => {
    expect(offlineAssistantReply("How does the ZK proof work?")).toMatch(/Groth16/);
    expect(offlineAssistantReply("What is the spending threshold?")).toMatch(/\$1,000/);
    expect(offlineAssistantReply("How do I fork this?")).toMatch(/npm install/);
    expect(offlineAssistantReply("Tell me about FATF and audit trails")).toMatch(/audit log/);
    expect(offlineAssistantReply("does it work with OWS wallets?")).toMatch(/zquent:kyc/);
  });

  it("answers post-quantum questions with what is and isn't post-quantum", () => {
    const reply = offlineAssistantReply("Is this post-quantum?");
    expect(reply).toMatch(/ML-KEM-768/);
    expect(reply).toMatch(/ML-DSA-65/);
    expect(reply).toMatch(/not post-quantum/);
  });

  it("falls back to an overview for unmatched questions", () => {
    expect(offlineAssistantReply("What is ZQUENT in one sentence?")).toMatch(/zero-knowledge, post-quantum trust protocol/);
  });

  it("never says an old product name", () => {
    for (const q of ["fork", "fatf", "proof", "threshold", "ows", "privacy", "quantum", "hello"]) {
      const reply = offlineAssistantReply(q);
      expect(reply).not.toMatch(/zkx/i);
      expect(reply).not.toMatch(/\bVero\b|\bVera\b/);
    }
  });
});
