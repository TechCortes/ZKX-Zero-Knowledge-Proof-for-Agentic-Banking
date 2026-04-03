import { NextRequest, NextResponse } from "next/server";
import { verifyKYCProof } from "@/zkp/verifier";
import { evaluatePayment, approveWithProof } from "@/policy/engine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { proof, publicSignals, paymentRequest } = body;

  if (!proof || !publicSignals || !paymentRequest) {
    return NextResponse.json({ error: "Missing proof or payment request." }, { status: 400 });
  }

  // 1. Verify the ZK proof
  const result = await verifyKYCProof(proof, publicSignals);

  if (!result.valid) {
    return NextResponse.json(
      { status: "rejected", error: result.error ?? "Invalid proof." },
      { status: 403 }
    );
  }

  // 2. Re-evaluate policy (sanity check)
  const decision = evaluatePayment(paymentRequest);

  if (!decision.requiresKYC) {
    // Shouldn't happen, but handle gracefully
    return NextResponse.json({ status: "approved", txId: `zkx_${Date.now()}`, decision });
  }

  // 3. Approve with proof
  const approved = approveWithProof(paymentRequest);

  return NextResponse.json({
    status: "approved",
    txId: `zkx_${Date.now()}`,
    commitment: result.commitment,
    decision: approved,
    message: "Identity proven via ZK — no personal data disclosed.",
  });
}
