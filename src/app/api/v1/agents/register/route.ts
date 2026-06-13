import { NextRequest, NextResponse } from "next/server";
import { registerAgent, AgentExistsError } from "@/lib/registry";
import { logger } from "@/lib/logger";
import type { PolicyRule, PolicyRuleType } from "@/policy/engine";

const ROUTE = "POST /api/v1/agents/register";
const AGENT_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const COMMITMENT_RE = /^\d{1,80}$/;
const CAIP2_RE = /^[a-z0-9]+:[a-zA-Z0-9_-]+$/;
const VALID_RULE_TYPES = new Set<PolicyRuleType>(["allowed_chains", "expires_at", "spending_limit"]);

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

  const { agentId, commitment, chains, policies, expiresAt } = body as Record<string, unknown>;

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

  // Validate chains (optional) — must be CAIP-2 identifiers
  let resolvedChains: string[] = [];
  if (chains !== undefined) {
    if (!Array.isArray(chains) || !chains.every((c) => typeof c === "string" && CAIP2_RE.test(c))) {
      logger.warn(ROUTE, "validation_failed", { field: "chains", agentId });
      return NextResponse.json(
        { error: "chains must be an array of CAIP-2 identifiers (e.g. [\"eip155:1\", \"solana:mainnet\"])." },
        { status: 422 }
      );
    }
    resolvedChains = chains as string[];
  }

  // Validate policies (optional) — OWS typed rules
  let resolvedPolicies: PolicyRule[] = [];
  if (policies !== undefined) {
    if (!Array.isArray(policies)) {
      logger.warn(ROUTE, "validation_failed", { field: "policies", agentId });
      return NextResponse.json({ error: "policies must be an array of policy rule objects." }, { status: 422 });
    }
    for (const rule of policies as unknown[]) {
      if (typeof rule !== "object" || rule === null || !("type" in rule) || !("value" in rule)) {
        return NextResponse.json(
          { error: "Each policy rule must have { type, value }." },
          { status: 422 }
        );
      }
      if (!VALID_RULE_TYPES.has((rule as PolicyRule).type)) {
        return NextResponse.json(
          { error: `Unknown policy rule type '${(rule as PolicyRule).type}'. Valid types: ${[...VALID_RULE_TYPES].join(", ")}.` },
          { status: 422 }
        );
      }
    }
    resolvedPolicies = policies as PolicyRule[];
  }

  // Validate expiresAt (optional) — ISO-8601
  let resolvedExpiresAt: string | null = null;
  if (expiresAt !== undefined) {
    if (typeof expiresAt !== "string" || isNaN(Date.parse(expiresAt))) {
      logger.warn(ROUTE, "validation_failed", { field: "expiresAt", agentId });
      return NextResponse.json({ error: "expiresAt must be an ISO-8601 date string." }, { status: 422 });
    }
    resolvedExpiresAt = expiresAt;
  }

  try {
    const agent = registerAgent(agentId, commitment, {
      chains: resolvedChains,
      policies: resolvedPolicies,
      expiresAt: resolvedExpiresAt,
    });
    logger.info(ROUTE, "agent_registered", { agentId: agent.id, chains: agent.chains });
    return NextResponse.json(
      {
        agentId: agent.id,
        apiKey: agent.apiKey,
        commitment: agent.commitment,
        chains: agent.chains,
        policies: agent.policies,
        expiresAt: agent.expiresAt,
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
