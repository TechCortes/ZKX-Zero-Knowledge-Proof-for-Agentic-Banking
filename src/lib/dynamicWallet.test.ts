import { describe, it, expect, vi, beforeEach } from "vitest";

const sdk = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  createWalletAccount: vi.fn(),
  getWalletClient: vi.fn(),
}));

vi.mock("@dynamic-labs-wallet/node-evm", () => ({
  DynamicEvmWalletClient: class {
    authenticateApiToken = sdk.authenticateApiToken;
    createWalletAccount = sdk.createWalletAccount;
    getWalletClient = sdk.getWalletClient;
  },
}));
vi.mock("@dynamic-labs-wallet/node", () => ({
  ThresholdSignatureScheme: { TWO_OF_THREE: "TWO_OF_THREE" },
}));

import { reserveSettlementBudget } from "./dynamicWallet";

process.env.DYNAMIC_ENVIRONMENT_ID = "env-test";
process.env.DYNAMIC_API_TOKEN = "token-test";
process.env.DYNAMIC_WALLET_PASSWORD = "password-test";

/**
 * Fresh module instances: an empty in-memory store and no cached Dynamic
 * login, so wallet tests don't see each other's state.
 */
async function freshModules() {
  vi.resetModules();
  return { wallet: await import("./dynamicWallet"), kv: (await import("./kv")).kv };
}

let dayCounter = 0;
/** A distinct UTC day per test, so budget counters never collide. */
function freshDay(): Date {
  return new Date(Date.UTC(2100, 0, 1) + ++dayCounter * 86_400_000);
}

describe("Dynamic settlement wallet", () => {
  beforeEach(() => {
    sdk.authenticateApiToken.mockReset().mockResolvedValue(undefined);
    sdk.createWalletAccount.mockReset();
    sdk.getWalletClient.mockReset();
  });

  it("allows one settlement per agent per day", async () => {
    const day = freshDay();
    expect(await reserveSettlementBudget("budget-agent", day)).toBe(true);
    expect(await reserveSettlementBudget("budget-agent", day)).toBe(false);
  });

  it("caps settlements across all agents per day", async () => {
    const day = freshDay();
    const results = [];
    for (let i = 0; i < 51; i++) {
      results.push(await reserveSettlementBudget(`global-agent-${i}`, day));
    }
    expect(results.filter(Boolean)).toHaveLength(50);
    expect(results[50]).toBe(false);
  });

  it("does not create a wallet when only looking up its address", async () => {
    const { wallet } = await freshModules();
    expect(await wallet.getExistingSettlementWalletAddress()).toBeUndefined();
    expect(sdk.createWalletAccount).not.toHaveBeenCalled();
  });

  it("keeps the first wallet when two cold requests race to create one", async () => {
    const { wallet } = await freshModules();
    // Each create resolves only after both callers have checked the cache.
    let release!: () => void;
    const bothChecked = new Promise<void>((r) => (release = r));
    sdk.createWalletAccount
      .mockImplementationOnce(async () => {
        await bothChecked;
        return { walletMetadata: { accountAddress: "0xfirst" } };
      })
      .mockImplementationOnce(async () => {
        release();
        await new Promise((r) => setTimeout(r, 10));
        return { walletMetadata: { accountAddress: "0xsecond" } };
      });

    const [a, b] = await Promise.all([
      wallet.getSettlementWalletAddress(),
      wallet.getSettlementWalletAddress(),
    ]);

    expect(sdk.createWalletAccount).toHaveBeenCalledTimes(2);
    expect(a).toBe("0xfirst");
    expect(b).toBe("0xfirst");
    expect(await wallet.getExistingSettlementWalletAddress()).toBe("0xfirst");
  });

  it("retries login after a failed authentication instead of caching the failure", async () => {
    const { wallet, kv } = await freshModules();
    await kv().set("dynamic:settlement-wallet", { accountAddress: "0xabc" });
    sdk.authenticateApiToken.mockRejectedValueOnce(new Error("network blip"));
    sdk.getWalletClient.mockResolvedValue({ sendTransaction: vi.fn().mockResolvedValue("0xhash") });

    await expect(wallet.settleTestnetPayment()).rejects.toThrow("network blip");
    const result = await wallet.settleTestnetPayment();

    expect(result.txHash).toBe("0xhash");
    expect(sdk.authenticateApiToken).toHaveBeenCalledTimes(2);
  });
});
