import { NextRequest, NextResponse } from "next/server";
import { authenticate, isAuthFailure, unauthorized } from "@/lib/auth";
import { evaluatePayment, recordSpend } from "@/policy/engine";
import { logger } from "@/lib/logger";

const ROUTE = "POST /api/v1/payment";

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

  const { amount, recipient, memo, chainId } = (body ?? {}) as Record<string, unknown>;

  if (typeof amount !== "number" || amount <= 0) {
    logger.warn(ROUTE, "validation_failed", { field: "amount", agentId: agent.id });
    return NextResponse.json({ error: "amount must be a positive number (USD)." }, { status: 422 });
  }
  if (typeof recipient !== "string" || recipient.trim().length === 0) {
    logger.warn(ROUTE, "validation_failed", { field: "recipient", agentId: agent.id });
    return NextResponse.json({ error: "recipient is required." }, { status: 422 });
  }

  const decision = evaluatePayment(
    {
      agentId: agent.id,
      amount,
      recipient,
      memo: typeof memo === "string" ? memo : undefined,
      chainId: typeof chainId === "string" ? chainId : undefined,
    },
    agent.policies
  );

  // OWS policy rule denial (chain not allowed, key expired via policy, etc.)
  if (!decision.allowed && !decision.requiresKYC) {
    logger.warn(ROUTE, "policy_denied", { agentId: agent.id, errorCode: decision.errorCode });
    return NextResponse.json(
      { error: decision.reason, errorCode: decision.errorCode },
      { status: 403 }
    );
  }

  if (decision.allowed) {
    recordSpend(agent.id, amount);
    logger.info(ROUTE, "payment_approved_anonymous", {
      agentId: agent.id,
      amount,
      chainId: chainId ?? null,
      dailyTotal: decision.dailyTotal + amount,
    });
    return NextResponse.json({
      status: "approved",
      txId: `zkx_${Date.now()}`,
      type: "anonymous",
      decision,
    });
  }

  logger.info(ROUTE, "proof_required", { agentId: agent.id, amount, dailyTotal: decision.dailyTotal });
  return NextResponse.json(
    {
      status: "requires_proof",
      commitment: agent.commitment,
      challenge: {
        currentYear: new Date().getUTCFullYear(),
        minAge: 18,
        commitment: agent.commitment,
      },
      decision,
    },
    { status: 402 }
  );
}
