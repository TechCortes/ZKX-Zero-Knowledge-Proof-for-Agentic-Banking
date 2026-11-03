import { NextRequest, NextResponse } from "next/server";
import { authenticate, isAuthFailure, unauthorized } from "@/lib/auth";
import { verifyKYCProof, commitmentFromSignals, txNonceFromSignals } from "@/zkp/verifier";
import { consumeChallenge } from "@/policy/challenges";
import { getRevealPublicKey, getEscrowKeySet } from "@/zkp/revealConfig";
import { evaluatePayment, approveWithProof, computePolicyVersionHash, usdAmountError } from "@/policy/engine";
import { recordAuditEntry } from "@/policy/auditLog";
import { storeRevealEscrow } from "@/policy/escrow";
import { logger } from "@/lib/logger";
import { newTxId } from "@/lib/ids";
import {
  settleTestnetPayment,
  getExistingSettlementWalletAddress,
  reserveSettlementBudget,
} from "@/lib/dynamicWallet";

const ROUTE = "POST /api/v1/verify-proof";

// MPC signing round-trips over the network; give it real headroom.
export const maxDuration = 60;

// Settlement gets a hard deadline well inside maxDuration, so a slow MPC
// round-trip or RPC can never time out the function after approval.
const SETTLEMENT_TIMEOUT_MS = 25_000;

type Settlement =
  | { status: "sent"; txHash: string; explorerUrl: string; fromAddress: string }
  | { status: "failed"; error: string; fundAddress?: string }
  | { status: "skipped"; reason: string }
  | { status: "unconfigured" };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Settlement timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** The real payment action behind a ZK-approved payment — never fails the approval itself. */
async function attemptSettlement(agentId: string): Promise<Settlement> {
  if (!process.env.DYNAMIC_ENVIRONMENT_ID || !process.env.DYNAMIC_API_TOKEN) {
    return { status: "unconfigured" };
  }
  try {
    if (!(await reserveSettlementBudget(agentId))) {
      return { status: "skipped", reason: "Daily settlement limit reached." };
    }
    const result = await withTimeout(settleTestnetPayment(), SETTLEMENT_TIMEOUT_MS);
    return { status: "sent", ...result };
  } catch (err) {
    // Full error stays server-side: SDK/RPC errors can include the RPC URL,
    // which for hosted providers embeds an API key.
    logger.error(ROUTE, "settlement_failed", {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    const fundAddress = await getExistingSettlementWalletAddress().catch(() => undefined);
    return { status: "failed", error: "Settlement could not be completed.", fundAddress };
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (isAuthFailure(auth)) {
    logger.warn(ROUTE, "unauthorized", { errorCode: auth.errorCode });
    return unauthorized(auth.message, auth.errorCode);
  }
  const agent = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logger.warn(ROUTE, "invalid_json", { agentId: agent.id });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { proof, publicSignals, amount, recipient, memo, chainId } =
    (body ?? {}) as Record<string, unknown>;

  if (!proof || !Array.isArray(publicSignals)) {
    logger.warn(ROUTE, "validation_failed", { field: "proof|publicSignals", agentId: agent.id });
    return NextResponse.json({ error: "proof and publicSignals are required." }, { status: 422 });
  }
  const amountError = usdAmountError(amount);
  if (amountError || typeof amount !== "number") {
    logger.warn(ROUTE, "validation_failed", { field: "amount", agentId: agent.id });
    return NextResponse.json({ error: amountError }, { status: 422 });
  }
  if (typeof recipient !== "string" || recipient.trim().length === 0) {
    logger.warn(ROUTE, "validation_failed", { field: "recipient", agentId: agent.id });
    return NextResponse.json({ error: "recipient is required." }, { status: 422 });
  }

  const revealPublicKey = await getRevealPublicKey();
  // Throws on a malformed VERO_ESCROW_KEYS now, before any challenge or spend is touched.
  getEscrowKeySet();

  // Bind proof to this agent's registered commitment — prevents cross-agent replay
  const proofCommitment = commitmentFromSignals(publicSignals as string[], revealPublicKey);
  if (proofCommitment !== agent.commitment) {
    logger.warn(ROUTE, "commitment_mismatch", { agentId: agent.id });
    return NextResponse.json(
      { error: "Proof commitment does not match registered agent identity.", errorCode: "POLICY_DENIED" },
      { status: 403 }
    );
  }

  const paymentRequest = {
    agentId: agent.id,
    amount,
    recipient,
    memo: typeof memo === "string" ? memo : undefined,
    chainId: typeof chainId === "string" ? chainId : undefined,
  };
  const decision = await evaluatePayment(paymentRequest, agent.policies);
  const policyVersionHash = computePolicyVersionHash(agent.policies);

  // A policy rule (chain, expiry, spending limit) blocks this payment, proof or not.
  if (!decision.allowed && !decision.requiresKYC) {
    logger.warn(ROUTE, "policy_denied", { agentId: agent.id, errorCode: decision.errorCode });
    await recordAuditEntry({
      agentId: agent.id,
      commitment: proofCommitment,
      policyVersionHash,
      decision: "policy_denied",
      thresholdMet: true,
      dailyTotal: decision.dailyTotal,
    });
    return NextResponse.json(
      { error: decision.reason, errorCode: decision.errorCode },
      { status: 403 }
    );
  }

  // Bind proof to the one payment it was challenged for — prevents replay and reuse.
  // Consumed before verification so a failed attempt can't be retried on the same nonce.
  const txNonce = txNonceFromSignals(publicSignals as string[], revealPublicKey);
  const challenge = await consumeChallenge(agent.id, txNonce, {
    amount,
    recipient,
    chainId: paymentRequest.chainId,
  });
  if (!challenge.ok) {
    logger.warn(ROUTE, "challenge_rejected", { agentId: agent.id, error: challenge.error });
    await recordAuditEntry({
      agentId: agent.id,
      commitment: proofCommitment,
      policyVersionHash,
      decision: "proof_rejected",
      thresholdMet: true,
      dailyTotal: decision.dailyTotal,
    });
    return NextResponse.json(
      { status: "rejected", error: challenge.error, errorCode: "POLICY_DENIED" },
      { status: 403 }
    );
  }

  const result = await verifyKYCProof(proof as object, publicSignals as string[], { revealPublicKey });

  if (!result.valid) {
    logger.warn(ROUTE, "proof_rejected", { agentId: agent.id, error: result.error });
    await recordAuditEntry({
      agentId: agent.id,
      commitment: proofCommitment,
      policyVersionHash,
      decision: "proof_rejected",
      thresholdMet: true,
      dailyTotal: decision.dailyTotal,
    });
    return NextResponse.json(
      { status: "rejected", error: result.error ?? "Proof verification failed.", errorCode: "POLICY_DENIED" },
      { status: 403 }
    );
  }

  if (!decision.requiresKYC) {
    logger.warn(ROUTE, "proof_not_needed", { agentId: agent.id, amount });
    return NextResponse.json(
      { error: "Payment no longer requires a proof — use /api/v1/payment instead." },
      { status: 409 }
    );
  }

  const approved = await approveWithProof(paymentRequest);
  const txId = newTxId();
  // Escrow the identity ciphertext apart from the agent-readable audit log.
  const revealEscrow = result.revealCiphertext
    ? await storeRevealEscrow({
        txId,
        agentId: agent.id,
        txNonce: result.txNonce,
        ciphertext: result.revealCiphertext,
      })
    : undefined;
  // Audit the approval before any settlement work, so the compliance record
  // exists even if settlement is slow or the function is cut short.
  await recordAuditEntry({
    agentId: agent.id,
    commitment: result.commitment,
    txId,
    policyVersionHash,
    decision: "approved_proof",
    thresholdMet: true,
    dailyTotal: approved.dailyTotal,
    txNonce: result.txNonce,
    ...(revealEscrow ? { revealEscrow } : {}),
  });
  const settlement = await attemptSettlement(agent.id);
  logger.info(ROUTE, "payment_approved_zk", {
    agentId: agent.id,
    amount,
    chainId: chainId ?? null,
    commitment: result.commitment,
    settlementStatus: settlement.status,
    revealEnabled: Boolean(result.revealCiphertext),
  });

  return NextResponse.json({
    status: "approved",
    txId,
    type: "zk-verified",
    commitment: result.commitment,
    piiTransmitted: 0,
    revealEscrowed: Boolean(result.revealCiphertext),
    decision: approved,
    settlement,
    message: "Identity proven via ZK proof. No personal data disclosed.",
  });
}
