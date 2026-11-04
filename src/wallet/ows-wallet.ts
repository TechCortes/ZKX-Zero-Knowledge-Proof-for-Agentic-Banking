/**
 * ZQUENT Wallet — Open Wallet Standard v2 Extension
 *
 * Aligns with the OWS v2 wallet descriptor format:
 *   - ows_version: 2
 *   - metadata["zquent:kyc"] — KYC status and commitment anchor
 *   - features["zquent:kyc"] — fully wired capability methods
 *
 * Feature namespace convention: namespace:capability (OWS §15)
 * Metadata extensions must be namespaced to prevent collisions.
 *
 * Rename alias: the pre-rename identifier "vero:kyc" is registered alongside
 * "zquent:kyc", pointing at the same feature object and metadata, so wallets
 * and integrators that look up "vero:kyc" keep working. It is deprecated and
 * is removed in the 90-day alias cleanup (ROADMAP).
 *
 * See: https://github.com/TechCortes/OpenWalletStandard
 */

import type { Wallet, WalletAccount } from "@wallet-standard/core";

// --- ZQUENT custom feature identifier (OWS namespaced per §15) ---
export const ZQUENT_KYC_FEATURE = "zquent:kyc" as const;

/** @deprecated Pre-rename alias of ZQUENT_KYC_FEATURE. Still registered on every wallet. */
export const VERO_KYC_FEATURE = "vero:kyc" as const;

export type ZquentKYCFeature = {
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

/** OWS v2 metadata shape for the zquent:kyc extension */
export interface ZquentKYCMetadata {
  version: "1.0.0";
  /** Poseidon(idHash, salt) — the ZK identity anchor. No PII stored. */
  commitment: string;
  /** ISO-8601 timestamp when the agent registered its KYC commitment */
  registeredAt: string;
  /** CAIP-2 chain identifiers this agent is permitted to transact on */
  chains: string[];
}

/** OWS v2 wallet descriptor shape with zquent:kyc metadata (and the deprecated vero:kyc alias) */
export interface ZquentWalletDescriptor extends Omit<Wallet, "features"> {
  ows_version: 2;
  metadata: {
    [ZQUENT_KYC_FEATURE]: ZquentKYCMetadata;
    /** @deprecated alias of metadata["zquent:kyc"] */
    [VERO_KYC_FEATURE]: ZquentKYCMetadata;
    [key: string]: unknown; // preserve unknown OWS extension fields
  };
  features: {
    [ZQUENT_KYC_FEATURE]: ZquentKYCFeature;
    /** @deprecated alias of features["zquent:kyc"] */
    [VERO_KYC_FEATURE]: ZquentKYCFeature;
    [key: string]: unknown;
  };
}

export interface ZquentWalletAccount extends Omit<WalletAccount, "features"> {
  features: {
    [ZQUENT_KYC_FEATURE]: ZquentKYCFeature;
    /** @deprecated alias of features["zquent:kyc"] */
    [VERO_KYC_FEATURE]: ZquentKYCFeature;
  };
}

/** @deprecated Pre-rename type names, kept for integrators. */
export type VeroKYCFeature = ZquentKYCFeature;
/** @deprecated */
export type VeroKYCMetadata = ZquentKYCMetadata;
/** @deprecated */
export type VeroWalletDescriptor = ZquentWalletDescriptor;
/** @deprecated */
export type VeroWalletAccount = ZquentWalletAccount;

/**
 * Creates a fully wired ZQUENT-compliant OWS v2 wallet descriptor.
 *
 * The wallet is a client-side capability object — it calls the ZQUENT API
 * endpoints so agents can interact with the policy engine without knowing
 * the underlying HTTP routes.
 *
 * @param agentId    - The registered agent identifier
 * @param commitment - Poseidon(idHash, salt) registered during onboarding
 * @param apiKey     - ows_key_<64 hex> bearer token issued at registration
 * @param chains     - CAIP-2 chain identifiers (e.g. ["eip155:1", "solana:mainnet"])
 * @param baseUrl    - API base URL (default: "" for relative in browser)
 */
export function createZquentWallet(
  agentId: string,
  commitment: string,
  apiKey: string,
  chains: string[] = [],
  baseUrl = ""
): ZquentWalletDescriptor {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const feature: ZquentKYCFeature = {
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

  const metadata: ZquentKYCMetadata = {
    version: "1.0.0",
    commitment,
    registeredAt: new Date().toISOString(),
    chains,
  };

  return {
    ows_version: 2,
    version: "1.0.0",
    name: "ZQUENT Agent Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI3IiBmaWxsPSIjMEIxRjNBIi8+PHBhdGggZD0iTTkgOC41SDIzVjExLjVMMTMuMiAyMC41SDIzVjIzLjVIOVYyMC41TDE4LjggMTEuNUg5WiIgZmlsbD0iI0ZGRkZGRiIvPjwvc3ZnPg==",
    chains: (chains.length > 0 ? chains : ["solana:mainnet", "eip155:1"]) as `${string}:${string}`[],
    features: {
      [ZQUENT_KYC_FEATURE]: feature,
      [VERO_KYC_FEATURE]: feature,
    },
    metadata: {
      [ZQUENT_KYC_FEATURE]: metadata,
      [VERO_KYC_FEATURE]: metadata,
    },
    accounts: [],
  };
}

/** @deprecated Pre-rename name of createZquentWallet. */
export const createVeroWallet = createZquentWallet;
