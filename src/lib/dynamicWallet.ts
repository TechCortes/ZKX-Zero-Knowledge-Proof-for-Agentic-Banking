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

// Every approved proof would otherwise make the server sign and broadcast a
// transaction, and agent registration is open — so cap settlements per agent
// and globally per UTC day. Redis-backed so the cap holds across instances.
const MAX_SETTLEMENTS_PER_AGENT_PER_DAY = 1;
const MAX_SETTLEMENTS_PER_DAY = 50;
const BUDGET_TTL_SECONDS = 2 * 24 * 60 * 60;

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
    // Don't cache a failed login — otherwise one transient error breaks
    // settlement on this instance until it's recycled.
    clientPromise.catch(() => {
      clientPromise = null;
    });
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
  // Two cold requests can both get here. Only the first write wins; the loser
  // adopts the winner's wallet so there is only ever one (funded) wallet.
  const stored = await kv().set(WALLET_KEY, walletMetadata, { nx: true });
  if (stored) return walletMetadata;
  const winner = await kv().get<WalletMetadata>(WALLET_KEY);
  if (!winner) throw new Error("Settlement wallet record missing after create race.");
  return winner;
}

/** Address of the settlement wallet if it already exists — never creates one. */
export async function getExistingSettlementWalletAddress(): Promise<string | undefined> {
  const cached = await kv().get<WalletMetadata>(WALLET_KEY);
  return cached?.accountAddress;
}

/**
 * Reserve one settlement from today's per-agent and global budgets.
 * Returns false (and reserves nothing usable) when either is exhausted.
 */
export async function reserveSettlementBudget(agentId: string, now: Date = new Date()): Promise<boolean> {
  const day = now.toISOString().slice(0, 10);
  const agentCount = await kv().incrby(`dynamic:settlements:${day}:${agentId}`, 1, { ex: BUDGET_TTL_SECONDS });
  if (agentCount > MAX_SETTLEMENTS_PER_AGENT_PER_DAY) return false;
  const globalCount = await kv().incrby(`dynamic:settlements:${day}`, 1, { ex: BUDGET_TTL_SECONDS });
  return globalCount <= MAX_SETTLEMENTS_PER_DAY;
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
