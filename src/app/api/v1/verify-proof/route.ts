import { NextRequest, NextResponse } from "next/server";
import { authenticate, isAuthFailure, unauthorized } from "@/lib/auth";
import { verifyKYCProof } from "@/zkp/verifier";
import { evaluatePayment, approveWithProof } from "@/policy/engine";
import { logger } from "@/lib/logger";

const ROUTE = "POST /api/v1/verify-proof";

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
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
  if (typeof amount !== "number" || amount <= 0) {
    logger.warn(ROUTE, "validation_failed", { field: "amount", agentId: agent.id });
    return NextResponse.json({ error: "amount must be a positive number (USD)." }, { status: 422 });
  }
  if (typeof recipient !== "string" || recipient.trim().length === 0) {
    logger.warn(ROUTE, "validation_failed", { field: "recipient", agentId: agent.id });
    return NextResponse.json({ error: "recipient is required." }, { status: 422 });
  }

  // Bind proof to this agent's registered commitment — prevents cross-agent replay
  const proofCommitment = publicSignals[0];
  if (proofCommitment !== agent.commitment) {
    logger.warn(ROUTE, "commitment_mismatch", { agentId: agent.id });
    return NextResponse.json(
      { error: "Proof commitment does not match registered agent identity.", errorCode: "POLICY_DENIED" },
      { status: 403 }
    );
  }

  const result = await verifyKYCProof(proof as object, publicSignals as string[]);

  if (!result.valid) {
    logger.warn(ROUTE, "proof_rejected", { agentId: agent.id, error: result.error });
    return NextResponse.json(
      { status: "rejected", error: result.error ?? "Proof verification failed.", errorCode: "POLICY_DENIED" },
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

  const decision = evaluatePayment(paymentRequest, agent.policies);
  if (!decision.requiresKYC) {
    logger.warn(ROUTE, "proof_not_needed", { agentId: agent.id, amount });
    return NextResponse.json(
      { error: "Payment no longer requires a proof — use /api/v1/payment instead." },
      { status: 409 }
    );
  }

  const approved = approveWithProof(paymentRequest);
  logger.info(ROUTE, "payment_approved_zk", {
    agentId: agent.id,
    amount,
    chainId: chainId ?? null,
    commitment: result.commitment,
  });

  return NextResponse.json({
    status: "approved",
    txId: `zkx_${Date.now()}`,
    type: "zk-verified",
    commitment: result.commitment,
    piiTransmitted: 0,
    decision: approved,
    message: "Identity proven via ZK proof. No personal data disclosed.",
  });
}
