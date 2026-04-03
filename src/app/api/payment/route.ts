import { NextRequest, NextResponse } from "next/server";
import { evaluatePayment, recordSpend, getDailySpend } from "@/policy/engine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentId, amount, recipient, memo } = body;

  if (!agentId || typeof amount !== "number" || !recipient) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const decision = evaluatePayment({ agentId, amount, recipient, memo });

  if (decision.allowed) {
    recordSpend(agentId, amount);
    return NextResponse.json({
      status: "approved",
      txId: `zkx_${Date.now()}`,
      decision,
    });
  }

  // Payment requires ZK proof
  return NextResponse.json(
    {
      status: "requires_kyc",
      decision,
    },
    { status: 402 }
  );
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId") ?? "demo-agent";
  return NextResponse.json({ agentId, dailySpend: getDailySpend(agentId) });
}
