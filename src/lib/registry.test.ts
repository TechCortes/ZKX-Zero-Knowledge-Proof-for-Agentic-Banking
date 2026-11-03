import { describe, it, expect } from "vitest";
import { registerAgent, getAgent, getAgentByApiKey, hashApiKey } from "./registry";
import { kv } from "./kv";
import { newTxId } from "./ids";

let n = 0;
const freshId = () => `reg-test-${Date.now()}-${++n}`;

describe("Agent registry — API keys", () => {
  it("returns the raw key once and stores only its hash", async () => {
    const id = freshId();
    const { agent, apiKey } = await registerAgent(id, "123");
    expect(apiKey).toMatch(/^ows_key_[0-9a-f]{64}$/);
    expect(agent.apiKeyHash).toBe(hashApiKey(apiKey));

    const stored = await kv().get<Record<string, unknown>>(`agent:${id}`);
    expect(JSON.stringify(stored)).not.toContain(apiKey);
    expect(await kv().get(`apikey:${apiKey}`)).toBeNull();
  });

  it("authenticates by raw key and rejects unknown keys", async () => {
    const { apiKey } = await registerAgent(freshId(), "123");
    expect((await getAgentByApiKey(apiKey))?.apiKeyHash).toBe(hashApiKey(apiKey));
    expect(await getAgentByApiKey("ows_key_" + "0".repeat(64))).toBeUndefined();
  });

  it("migrates a pre-hashing record on first use", async () => {
    const id = freshId();
    const rawKey = "ows_key_" + "ab".repeat(32);
    await kv().set(`agent:${id}`, {
      id, commitment: "1", apiKey: rawKey, createdAt: new Date().toISOString(),
      chains: [], policies: [], expiresAt: null,
    });
    await kv().set(`apikey:${rawKey}`, id);

    const agent = await getAgentByApiKey(rawKey);
    expect(agent?.id).toBe(id);
    expect(agent).not.toHaveProperty("apiKey");

    expect(await kv().get(`apikey:${rawKey}`)).toBeNull();
    expect(JSON.stringify(await kv().get(`agent:${id}`))).not.toContain(rawKey);
    // Still works after migration, now through the hashed index.
    expect((await getAgentByApiKey(rawKey))?.id).toBe(id);
  });

  it("never returns a legacy raw key from getAgent", async () => {
    const id = freshId();
    await kv().set(`agent:${id}`, {
      id, commitment: "1", apiKey: "ows_key_secret", createdAt: "", chains: [], policies: [], expiresAt: null,
    });
    expect(await getAgent(id)).not.toHaveProperty("apiKey");
  });
});

describe("Transaction IDs", () => {
  it("are unique even when generated in the same millisecond", () => {
    const ids = new Set(Array.from({ length: 1000 }, newTxId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(/^zkx_[0-9a-f-]{36}$/);
  });
});
