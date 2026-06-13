import { NextRequest, NextResponse } from "next/server";
import { registerAgent, AgentExistsError } from "@/lib/registry";
import { logger } from "@/lib/logger";

const ROUTE = "POST /api/v1/agents/register";
const AGENT_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const COMMITMENT_RE = /^\d{1,80}$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logger.warn(ROUTE, "invalid_json");
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    logger.warn(ROUTE, "invalid_body");
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const { agentId, commitment } = body as Record<string, unknown>;

  if (typeof agentId !== "string" || !AGENT_ID_RE.test(agentId)) {
    logger.warn(ROUTE, "validation_failed", { field: "agentId" });
    return NextResponse.json(
      { error: "agentId must be 3–64 characters: letters, numbers, hyphens, underscores." },
      { status: 422 }
    );
  }

  if (typeof commitment !== "string" || !COMMITMENT_RE.test(commitment)) {
    logger.warn(ROUTE, "validation_failed", { field: "commitment", agentId });
    return NextResponse.json(
      { error: "commitment must be a decimal Poseidon hash string (Poseidon(idHash, salt))." },
      { status: 422 }
    );
  }

  try {
    const agent = registerAgent(agentId, commitment);
    logger.info(ROUTE, "agent_registered", { agentId: agent.id });
    return NextResponse.json(
      {
        agentId: agent.id,
        apiKey: agent.apiKey,
        commitment: agent.commitment,
        createdAt: agent.createdAt,
        message: "Agent registered. Store your apiKey — it will not be shown again.",
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AgentExistsError) {
      logger.warn(ROUTE, "agent_exists", { agentId });
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    logger.error(ROUTE, "unexpected_error", { error: String(err) });
    throw err;
  }
}
