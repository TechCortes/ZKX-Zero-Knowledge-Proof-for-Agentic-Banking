/**
 * ZKX Wallet — Open Wallet Standard v2 Extension
 *
 * Aligns with the OWS v2 wallet descriptor format:
 *   - ows_version: 2
 *   - metadata["zkx:kyc"] — KYC status and commitment anchor
 *   - features["zkx:kyc"] — fully wired capability methods
 *
 * Feature namespace convention: namespace:capability (OWS §15)
 * Metadata extensions must be namespaced to prevent collisions.
 *
 * See: https://github.com/TechCortes/OpenWalletStandard
 */

import type { Wallet, WalletAccount } from "@wallet-standard/core";

// --- ZKX custom feature identifier (OWS namespaced per §15) ---
export const ZKX_KYC_FEATURE = "zkx:kyc" as const;

export type ZKXKYCFeature = {
  version: "1.0.0";
  /** Returns the agent's current daily spend in USD */
  getDailySpend: () => Promise<number>;
  /**
   * Request a payment. Policy engine intercepts and may require ZK proof.
   * Maps to POST /api/v1/payment internally.
   */
  requestPayment: (params: {
    amount: number;
    recipient: string;
    memo?: string;
    chainId?: string;
  }) => Promise<{ status: "approved" | "requires_kyc" | "rejected"; txId?: string; challenge?: unknown }>;
};

/** OWS v2 metadata shape for the zkx:kyc extension */
export interface ZKXKYCMetadata {
  version: "1.0.0";
  /** Poseidon(idHash, salt) — the ZK identity anchor. No PII stored. */
  commitment: string;
  /** ISO-8601 timestamp when the agent registered its KYC commitment */
  registeredAt: string;
  /** CAIP-2 chain identifiers this agent is permitted to transact on */
  chains: string[];
}

/** OWS v2 wallet descriptor shape with zkx:kyc metadata */
export interface ZKXWalletDescriptor extends Omit<Wallet, "features"> {
  ows_version: 2;
  metadata: {
    [ZKX_KYC_FEATURE]: ZKXKYCMetadata;
    [key: string]: unknown; // preserve unknown OWS extension fields
  };
  features: {
    [ZKX_KYC_FEATURE]: ZKXKYCFeature;
    [key: string]: unknown;
  };
}

export interface ZKXWalletAccount extends Omit<WalletAccount, "features"> {
  features: {
    [ZKX_KYC_FEATURE]: ZKXKYCFeature;
  };
}

/**
 * Creates a fully wired ZKX-compliant OWS v2 wallet descriptor.
 *
 * The wallet is a client-side capability object — it calls the ZKX API
 * endpoints so agents can interact with the policy engine without knowing
 * the underlying HTTP routes.
 *
 * @param agentId    - The registered agent identifier
 * @param commitment - Poseidon(idHash, salt) registered during onboarding
 * @param apiKey     - ows_key_<64 hex> bearer token issued at registration
 * @param chains     - CAIP-2 chain identifiers (e.g. ["eip155:1", "solana:mainnet"])
 * @param baseUrl    - API base URL (default: "" for relative in browser)
 */
export function createZKXWallet(
  agentId: string,
  commitment: string,
  apiKey: string,
  chains: string[] = [],
  baseUrl = ""
): ZKXWalletDescriptor {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const feature: ZKXKYCFeature = {
    version: "1.0.0",

    async getDailySpend(): Promise<number> {
      const res = await fetch(`${baseUrl}/api/v1/agents/${agentId}`, { headers });
      if (!res.ok) throw new Error(`getDailySpend failed: ${res.status}`);
      const data = await res.json();
      return data.compliance?.dailySpend ?? 0;
    },

    async requestPayment({ amount, recipient, memo, chainId }) {
      const res = await fetch(`${baseUrl}/api/v1/payment`, {
        method: "POST",
        headers,
        body: JSON.stringify({ amount, recipient, memo, chainId }),
      });

      const data = await res.json();

      if (res.status === 402) {
        // ZK proof required
        return { status: "requires_kyc", challenge: data.challenge };
      }
      if (!res.ok) {
        return { status: "rejected" };
      }
      return { status: "approved", txId: data.txId };
    },
  };

  const metadata: ZKXKYCMetadata = {
    version: "1.0.0",
    commitment,
    registeredAt: new Date().toISOString(),
    chains,
  };

  return {
    ows_version: 2,
    version: "1.0.0",
    name: "ZKX Agent Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjN2MzYWVkIi8+PHRleHQgeD0iOCIgeT0iMjIiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj5aWDwvdGV4dD48L3N2Zz4=",
    chains: (chains.length > 0 ? chains : ["solana:mainnet", "eip155:1"]) as `${string}:${string}`[],
    features: {
      [ZKX_KYC_FEATURE]: feature,
    },
    metadata: {
      [ZKX_KYC_FEATURE]: metadata,
    },
    accounts: [],
  };
}
