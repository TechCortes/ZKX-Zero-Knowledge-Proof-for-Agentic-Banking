/**
 * ZKX Wallet — Open Wallet Standard Extension
 *
 * Wraps @wallet-standard/core and adds the ZKX compliance feature:
 * agents can declare a `zkx:kyc` capability that enables policy-gated payments.
 *
 * See: https://github.com/open-wallet-standard/core
 */

import type { Wallet, WalletAccount } from "@wallet-standard/core";

// --- ZKX custom feature identifier (namespaced per OWS spec) ---
export const ZKX_KYC_FEATURE = "zkx:kyc" as const;

export type ZKXKYCFeature = {
  version: "1.0.0";
  /** Returns the agent's current daily spend in USD */
  getDailySpend: () => Promise<number>;
  /** Request a payment — policy engine intercepts and may require ZK proof */
  requestPayment: (params: {
    amount: number;
    recipient: string;
    memo?: string;
  }) => Promise<{ status: "approved" | "requires_kyc" | "rejected"; txId?: string }>;
};

export interface ZKXWalletAccount extends WalletAccount {
  features: {
    [ZKX_KYC_FEATURE]: ZKXKYCFeature;
  };
}

/**
 * Creates a ZKX-compliant wallet descriptor for registration with the
 * wallet-standard registry. The actual payment logic is handled server-side
 * by the policy engine; this object describes capabilities to dApps/agents.
 */
export function createZKXWallet(agentId: string): Wallet {
  return {
    version: "1.0.0",
    name: "ZKX Agent Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjN2MzYWVkIi8+PHRleHQgeD0iOCIgeT0iMjIiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj5aWDwvdGV4dD48L3N2Zz4=",
    chains: ["solana:mainnet", "eip155:1"],
    features: {
      [ZKX_KYC_FEATURE]: {
        version: "1.0.0",
      },
    } as Record<string, unknown>,
    accounts: [],
  };
}
