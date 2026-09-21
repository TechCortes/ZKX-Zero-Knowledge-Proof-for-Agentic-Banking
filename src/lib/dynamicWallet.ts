/**
 * Dynamic MPC wallet — the real payment action behind a ZK-approved payment.
 *
 * One server-controlled wallet, created once and reused forever (its
 * non-sensitive `walletMetadata` is cached in the same Redis store as the
 * rest of Vero's state — see kv.ts). Threshold is TWO_OF_THREE with
 * backUpToDynamic: true, so Dynamic holds a backup share and the SDK can
 * recover and sign without this process ever holding raw key-share material.
 *
 * settleTestnetPayment() signs and broadcasts a small, fixed self-transfer on
 * Base Sepolia — a real signed, broadcast transaction with a verifiable hash.
 * It's a self-transfer (from === to) specifically so no third-party address
 * is required; the point is proving the signing path is real, not the
 * destination.
 */

import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import { ThresholdSignatureScheme, type WalletMetadata } from "@dynamic-labs-wallet/node";
import { baseSepolia } from "viem/chains";
import { parseEther, type Hex } from "viem";
import { kv } from "./kv";

const WALLET_KEY = "dynamic:settlement-wallet";
const SETTLEMENT_VALUE_WEI = parseEther("0.000001");

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let clientPromise: Promise<DynamicEvmWalletClient> | null = null;

async function getAuthenticatedClient(): Promise<DynamicEvmWalletClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new DynamicEvmWalletClient({
        environmentId: requiredEnv("DYNAMIC_ENVIRONMENT_ID"),
      });
      await client.authenticateApiToken(requiredEnv("DYNAMIC_API_TOKEN"));
      return client;
    })();
  }
  return clientPromise;
}

async function getOrCreateWalletMetadata(client: DynamicEvmWalletClient): Promise<WalletMetadata> {
  const cached = await kv().get<WalletMetadata>(WALLET_KEY);
  if (cached) return cached;

  const { walletMetadata } = await client.createWalletAccount({
    thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_THREE,
    backUpToDynamic: true,
    password: requiredEnv("DYNAMIC_WALLET_PASSWORD"),
  });
  await kv().set(WALLET_KEY, walletMetadata);
  return walletMetadata;
}

/** Address of the settlement wallet, creating it on first call. */
export async function getSettlementWalletAddress(): Promise<string> {
  const client = await getAuthenticatedClient();
  const walletMetadata = await getOrCreateWalletMetadata(client);
  return walletMetadata.accountAddress;
}

export interface SettlementResult {
  txHash: Hex;
  explorerUrl: string;
  fromAddress: string;
}

export async function settleTestnetPayment(): Promise<SettlementResult> {
  const client = await getAuthenticatedClient();
  const walletMetadata = await getOrCreateWalletMetadata(client);

  const walletClient = await client.getWalletClient({
    walletMetadata,
    password: requiredEnv("DYNAMIC_WALLET_PASSWORD"),
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || baseSepolia.rpcUrls.default.http[0],
  });

  const txHash = await walletClient.sendTransaction({
    to: walletMetadata.accountAddress as Hex,
    value: SETTLEMENT_VALUE_WEI,
  });

  return {
    txHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    fromAddress: walletMetadata.accountAddress,
  };
}
