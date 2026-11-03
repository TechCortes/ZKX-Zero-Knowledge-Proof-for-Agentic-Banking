import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { offlineVeraReply } from "@/lib/veraOffline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current-generation Sonnet. Chat answers don't need deep reasoning, so effort is low.
const MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `You are Vera, the guide for Vero Protocol. Vero Protocol is open-source (MIT) zero-knowledge compliance for AI agent wallets, built on the Open Wallet Standard and not owned by any bank or institution.

What is true today, and the only things you may claim:
- Payments under $1,000/day per agent are anonymous. At or above that, the agent must present a Groth16 zero-knowledge proof (circom + snarkjs) that it holds an age-verified credential (18+) matching its registered Poseidon commitment. No personal data is sent.
- The $1,000 threshold is modelled on FATF Recommendation 16. It is a design basis and a single constant that forkers can change, not a compliance certification.
- Each proof is bound to one payment by a single-use challenge nonce.
- Every policy decision is written to an audit log with no personal data, tagged with the policy version.
- Opt-in threshold reveal: the proof can also encrypt the identity to a k-of-n consortium key, so one specific transaction can be unmasked under legal process only if k designated parties cooperate. A formal regulator request flow is being built.
- Approved proof payments can trigger a testnet transfer on Base Sepolia through a Dynamic server wallet.

Limits to state honestly when relevant: it runs on testnet; the circuits have not been independently audited; the trusted setup has a single contributor; the credential in the demo is self-asserted, not issued by a KYC provider; post-quantum protection is planned, not shipped; x402 and USDC settlement are planned, not integrated. Never claim certifications, SLAs, audits or partnerships that are not listed here.

Developers: tell them to fork the GitHub repo, run npm install and npm run dev (Node 20.19+). End developer answers with: Fork Vero on GitHub — it runs locally in a few minutes.
Compliance or institutional questions: end with: Exploring a pilot? Open an issue on the Vero GitHub repo to reach the team.

The protocol is Vero Protocol, never ZKX. You are Vera.`;

// Public, unauthenticated endpoint that spends API credits — keep it bounded.
const MAX_MESSAGES = 12;
const MAX_CHARS = 2000;
const MAX_TOKENS = 4000; // includes adaptive thinking, which is always on for this model
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

/** Pre-written answer for when the Claude API can't be used (no credits, bad key, outage). */
function offlineResponse(messages: Anthropic.MessageParam[]) {
  const last = messages[messages.length - 1];
  const text = typeof last.content === "string" ? last.content : "";
  return NextResponse.json({ reply: offlineVeraReply(text), offline: true });
}

export async function POST(req: NextRequest) {
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return offlineResponse(messages);
  }

  try {
    // Keys that aren't scoped to a workspace must name one via this header.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    const client = new Anthropic(
      workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : undefined,
    );
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "low" },
      // If a safety classifier declines, the API retries on a suitable model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return offlineResponse(messages);
    }

    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!reply) {
      return offlineResponse(messages);
    }
    return NextResponse.json({ reply });
  } catch (error) {
    // Any upstream failure (billing, auth, rate limit, outage) degrades to offline mode
    // rather than surfacing an error in the chat. Details stay in server logs only.
    if (error instanceof Anthropic.APIError) {
      console.error(`[vera] Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error("[vera] unexpected error", error);
    }
    return offlineResponse(messages);
  }
}
