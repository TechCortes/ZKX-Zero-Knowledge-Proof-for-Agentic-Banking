import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are Vera — the compliance intelligence for Vero Protocol. Vero Protocol is open-source zero-knowledge compliance for AI agent wallets. MIT licensed. FATF R.15/R.16 aligned. Built on the Open Wallet Standard. Not owned by any bank or institution.

You help developers fork and deploy Vero, help compliance officers understand FATF R.16 alignment, and help anyone understand why ZK proofs are better than traditional KYC for AI agents.

When a developer asks how to get started: tell them to fork the GitHub repo, run npm install and npm run dev, and they are live in 2 minutes.

When a compliance officer asks about regulatory alignment: explain FATF R.16 Travel Rule, configurable thresholds (EU €1,000 · US $3,000 MSB · custom), and the Filecoin immutable audit trail.

Always end responses to developers with: Fork Vero on GitHub — deploy in 2 minutes.
Always end responses to compliance or institutional questions with: Ask us about the Vero enterprise SLA.

Never say ZKX. The protocol is Vero Protocol. You are Vera.`;

// Public, unauthenticated endpoint that spends API credits — keep it bounded.
const MAX_MESSAGES = 12;
const MAX_CHARS = 2000;
const MAX_TOKENS = 1500;
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes, per IP

// Best-effort: in-memory, so it is per server instance (serverless instances
// don't share it). Swap for a shared store (KV/Redis) for a hard limit.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

function parseMessages(body: unknown): Anthropic.MessageParam[] | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;

  const messages: Anthropic.MessageParam[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > MAX_CHARS) return null;
    messages.push({ role, content: text });
  }
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Vera is offline right now. Please try again later." },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many messages — please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const messages = parseMessages(body);
  if (!messages) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    // Keys that aren't scoped to a workspace must name one via this header.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    const client = new Anthropic(
      workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : undefined,
    );
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!reply) {
      return NextResponse.json({ error: "Vera had nothing to say — try rephrasing." }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Vera is busy — please try again shortly." }, { status: 503 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[vera] Anthropic authentication failed — check ANTHROPIC_API_KEY");
      return NextResponse.json({ error: "Vera is offline right now. Please try again later." }, { status: 503 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[vera] Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error("[vera] unexpected error", error);
    }
    // TEMPORARY diagnostic (remove once Vera's 502 is root-caused): surface the upstream failure.
    const upstream =
      error instanceof Error
        ? `${error.constructor.name}${error instanceof Anthropic.APIError ? ` ${error.status ?? ""}` : ""}: ${error.message}`.slice(0, 240)
        : "unknown";
    return NextResponse.json({ error: "Vera hit a problem. Please try again.", upstream }, { status: 502 });
  }
}
