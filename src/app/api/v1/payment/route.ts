import { NextRequest, NextResponse } from "next/server";
import { authenticate, isAuthFailure, unauthorized } from "@/lib/auth";
import { evaluatePayment, recordSpend, computePolicyVersionHash } from "@/policy/engine";
import { recordAuditEntry } from "@/policy/auditLog";
import { logger } from "@/lib/logger";
import { getRevealPublicKey } from "@/zkp/revealConfig";
import { REQUIRED_MIN_AGE } from "@/zkp/verifier";
import { issueChallenge, CHALLENGE_TTL_SECONDS } from "@/policy/challenges";

const ROUTE = "POST /api/v1/payment";

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

  const { amount, recipient, memo, chainId } = (body ?? {}) as Record<string, unknown>;

  if (typeof amount !== "number" || amount <= 0) {
    logger.warn(ROUTE, "validation_failed", { field: "amount", agentId: agent.id });
    return NextResponse.json({ error: "amount must be a positive number (USD)." }, { status: 422 });
  }
  if (typeof recipient !== "string" || recipient.trim().length === 0) {
    logger.warn(ROUTE, "validation_failed", { field: "recipient", agentId: agent.id });
    return NextResponse.json({ error: "recipient is required." }, { status: 422 });
  }

  const decision = await evaluatePayment(
    {
      agentId: agent.id,
      amount,
      recipient,
      memo: typeof memo === "string" ? memo : undefined,
      chainId: typeof chainId === "string" ? chainId : undefined,
    },
    agent.policies
  );

  const policyVersionHash = computePolicyVersionHash(agent.policies);

  // OWS policy rule denial (chain not allowed, key expired via policy, etc.)
  if (!decision.allowed && !decision.requiresKYC) {
    logger.warn(ROUTE, "policy_denied", { agentId: agent.id, errorCode: decision.errorCode });
    await recordAuditEntry({
      agentId: agent.id,
      policyVersionHash,
      decision: "policy_denied",
      thresholdMet: false,
      dailyTotal: decision.dailyTotal,
    });
    return NextResponse.json(
      { error: decision.reason, errorCode: decision.errorCode },
      { status: 403 }
    );
  }

  if (decision.allowed) {
    await recordSpend(agent.id, amount);
    const txId = `zkx_${Date.now()}`;
    logger.info(ROUTE, "payment_approved_anonymous", {
      agentId: agent.id,
      amount,
      chainId: chainId ?? null,
      dailyTotal: decision.dailyTotal + amount,
    });
    await recordAuditEntry({
      agentId: agent.id,
      txId,
      policyVersionHash,
      decision: "approved_anonymous",
      thresholdMet: false,
      dailyTotal: decision.dailyTotal + amount,
    });
    return NextResponse.json({
      status: "approved",
      txId,
      type: "anonymous",
      decision,
    });
  }

  // When threshold reveal is configured, the proof must also encrypt the identity
  // to this consortium key (kyc_reveal circuit). verify-proof pins the same key.
  const revealPublicKey = await getRevealPublicKey();

  // Single-use nonce bound to exactly this payment. The proof must commit to it,
  // and verify-proof will only accept it for the same amount and recipient.
  const txNonce = await issueChallenge(agent.id, {
    amount,
    recipient,
    chainId: typeof chainId === "string" ? chainId : undefined,
  });

  logger.info(ROUTE, "proof_required", { agentId: agent.id, amount, dailyTotal: decision.dailyTotal });
  await recordAuditEntry({
    agentId: agent.id,
    policyVersionHash,
    decision: "kyc_required",
    thresholdMet: true,
    dailyTotal: decision.dailyTotal,
  });
  return NextResponse.json(
    {
      status: "requires_proof",
      commitment: agent.commitment,
      challenge: {
        currentYear: new Date().getUTCFullYear(),
        minAge: REQUIRED_MIN_AGE,
        commitment: agent.commitment,
        txNonce,
        expiresInSeconds: CHALLENGE_TTL_SECONDS,
        payment: { amount, recipient, ...(typeof chainId === "string" ? { chainId } : {}) },
        ...(revealPublicKey ? { reveal: { publicKey: revealPublicKey } } : {}),
      },
      decision,
    },
    { status: 402 }
  );
}
