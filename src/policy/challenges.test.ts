/**
 * Proof challenges — single-use nonces bound to one agent and one payment.
 */

import { describe, it, expect } from "vitest";
import { issueChallenge, consumeChallenge } from "./challenges";

const PAY = { amount: 1500, recipient: "0xabc" };

describe("proof challenges", () => {
  it("a nonce approves the payment it was issued for, exactly once", async () => {
    const nonce = await issueChallenge("agent-a", PAY);
    expect(nonce).toMatch(/^\d+$/);
    const first = await consumeChallenge("agent-a", nonce, PAY);
    expect(first.ok).toBe(true);
    const replay = await consumeChallenge("agent-a", nonce, PAY);
    expect(replay).toEqual({ ok: false, error: expect.stringMatching(/already used/) });
  });

  it("rejects a different amount or recipient, and burns the nonce anyway", async () => {
    const n1 = await issueChallenge("agent-a", PAY);
    expect((await consumeChallenge("agent-a", n1, { ...PAY, amount: 99_999 })).ok).toBe(false);
    expect((await consumeChallenge("agent-a", n1, PAY)).ok).toBe(false);

    const n2 = await issueChallenge("agent-a", PAY);
    expect((await consumeChallenge("agent-a", n2, { ...PAY, recipient: "0xevil" })).ok).toBe(false);
  });

  it("binds chainId when one was challenged", async () => {
    const n = await issueChallenge("agent-a", { ...PAY, chainId: "eip155:1" });
    expect((await consumeChallenge("agent-a", n, PAY)).ok).toBe(false);
    const m = await issueChallenge("agent-a", { ...PAY, chainId: "eip155:1" });
    expect((await consumeChallenge("agent-a", m, { ...PAY, chainId: "eip155:1" })).ok).toBe(true);
  });

  it("one agent can't use another agent's nonce", async () => {
    const nonce = await issueChallenge("agent-a", PAY);
    expect((await consumeChallenge("agent-b", nonce, PAY)).ok).toBe(false);
    // and the rightful owner still can
    expect((await consumeChallenge("agent-a", nonce, PAY)).ok).toBe(true);
  });

  it("rejects missing or malformed nonces without touching the store", async () => {
    expect((await consumeChallenge("agent-a", undefined, PAY)).ok).toBe(false);
    expect((await consumeChallenge("agent-a", "not-a-number", PAY)).ok).toBe(false);
    expect((await consumeChallenge("agent-a", "123", PAY)).ok).toBe(false);
  });

  it("issues a fresh nonce every time", async () => {
    const a = await issueChallenge("agent-a", PAY);
    const b = await issueChallenge("agent-a", PAY);
    expect(a).not.toBe(b);
  });
});
