"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { deriveCommitment, generateKYCProof, randomFieldElement } from "@/zkp/prover";
import { AGENT_STORAGE_KEY, migrateLegacyAgentStorage } from "@/lib/agentStorage";

const DAILY_LIMIT    = 1000;
const DEMO_BIRTH_YEAR = 1990;
const DEMO_RECIPIENT  = "0x7f3ac4d2e8b19c5f6a23d40";
const LS_KEY          = AGENT_STORAGE_KEY;

const PRESETS = [
  { label: "$200",   amount: 200,  description: "Micropayment" },
  { label: "$600",   amount: 600,  description: "Standard"     },
  { label: "$1,200", amount: 1200, description: "High value"   },
];

const PROOF_STEPS = [
  { label: "Computing witness from private inputs", detail: "Poseidon(idHash, salt)"          },
  { label: "Generating Groth16 proof",              detail: "BN128 curve · in-browser"        },
  { label: "Submitting proof for verification",     detail: "Server verifier · real proof"    },
];

type Stage =
  | "init"
  | "idle"
  | "processing"
  | "approved"
  | "kyc_required"
  | "proving"
  | "kyc_approved"
  | "error";

interface Tx {
  id: string;
  amount: number;
  type: "anonymous" | "zk-verified";
  time: string;
  proof?: string;
}

interface DemoSession {
  agentId: string;
  apiKey: string;
  commitment: string;
  /** Private inputs — kept client-side only (state + localStorage), never sent to the server. */
  idHash: string;
  salt: string;
  birthYear: number;
  type: "registered" | "demo";
}

type StoredSession = Pick<DemoSession, "agentId" | "apiKey" | "commitment" | "idHash" | "salt" | "birthYear">;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function randomAgentId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return "demo-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function persistSession(s: StoredSession) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* storage unavailable — non-fatal */ }
}

async function registerDemoAgent(): Promise<DemoSession | null> {
  try {
    const idHash = randomFieldElement();
    const salt = randomFieldElement();
    const birthYear = DEMO_BIRTH_YEAR;
    const commitment = await deriveCommitment({ idHash, salt, birthYear });

    const res = await fetch("/api/v1/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: randomAgentId(),
        commitment,
        chains: ["eip155:1", "solana:mainnet"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const session: DemoSession = {
      agentId: data.agentId,
      apiKey: data.apiKey,
      commitment,
      idHash,
      salt,
      birthYear,
      type: "demo",
    };
    persistSession(session);
    return session;
  } catch {
    return null;
  }
}

/**
 * Try to resume a previously registered agent from localStorage.
 * Validates it against the server; returns null if stale (server restarted),
 * incomplete (e.g. a session saved before proof-generation fields existed),
 * or if localStorage is empty.
 */
async function loadRegisteredSession(): Promise<{ session: DemoSession; dailySpend: number } | null> {
  try {
    migrateLegacyAgentStorage(localStorage);
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredSession>;
    if (
      !stored.agentId || !stored.apiKey || !stored.commitment ||
      !stored.idHash || !stored.salt || typeof stored.birthYear !== "number"
    ) {
      return null;
    }

    const res = await fetch(`/api/v1/agents/${stored.agentId}`, {
      headers: { Authorization: `Bearer ${stored.apiKey}` },
    });
    if (!res.ok) {
      localStorage.removeItem(LS_KEY); // stale — server restarted
      return null;
    }
    const data = await res.json();
    return {
      session: { ...(stored as StoredSession), type: "registered" },
      dailySpend: data.compliance?.dailySpend ?? 0,
    };
  } catch {
    return null;
  }
}

export default function DemoWidget() {
  const [session, setSession]       = useState<DemoSession | null>(null);
  const [amount, setAmount]         = useState(200);
  const [dailySpend, setDailySpend] = useState(0);
  const [stage, setStage]           = useState<Stage>("init");
  const [proofStep, setProofStep]   = useState(-1);
  const [txLog, setTxLog]           = useState<Tx[]>([]);
  const [lastTx, setLastTx]         = useState<Tx | null>(null);
  const [apiError, setApiError]     = useState("");
  const [challenge, setChallenge]   = useState<{
    commitment: string;
    currentYear: number;
    minAge: number;
    txNonce: string;
    reveal?: { publicKey: [string, string] };
  } | null>(null);

  // Keep the proof progress and its result in view on small screens while a proof runs.
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stage === "proving" || stage === "kyc_approved") {
      progressRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [stage]);

  const remaining      = Math.max(0, DAILY_LIMIT - dailySpend);
  const spendPct       = Math.min((dailySpend / DAILY_LIMIT) * 100, 100);
  const wouldTriggerKyc = dailySpend + amount >= DAILY_LIMIT;

  useEffect(() => {
    (async () => {
      // Prefer a previously registered agent from localStorage
      const registered = await loadRegisteredSession();
      if (registered) {
        setSession(registered.session);
        setDailySpend(registered.dailySpend);
        setStage("idle");
        return;
      }
      // Fall back to an ephemeral demo agent
      const demo = await registerDemoAgent();
      setSession(demo);
      setStage(demo ? "idle" : "error");
    })();
  }, []);

  function reset() {
    setStage(session ? "idle" : "error");
    setProofStep(-1);
    setLastTx(null);
    setApiError("");
  }

  async function fullReset() {
    setStage("init");
    setDailySpend(0);
    setTxLog([]);
    setLastTx(null);
    setApiError("");
    setProofStep(-1);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    const s = await registerDemoAgent();
    setSession(s);
    setStage(s ? "idle" : "error");
  }

  async function sendPayment() {
    if (!session || stage === "proving" || stage === "processing") return;
    setStage("processing");
    setLastTx(null);
    setApiError("");

    try {
      const res = await fetch("/api/v1/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.apiKey}`,
        },
        body: JSON.stringify({ amount, recipient: DEMO_RECIPIENT }),
      });

      const data = await res.json();

      if (res.ok && data.status === "approved") {
        // decision.dailyTotal is the total BEFORE this payment; add amount for current total
        const newTotal = (data.decision?.dailyTotal ?? dailySpend) + amount;
        const tx: Tx = {
          id: data.txId,
          amount,
          type: "anonymous",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        };
        setDailySpend(newTotal);
        setTxLog((prev) => [tx, ...prev].slice(0, 8));
        setLastTx(tx);
        setStage("approved");
      } else if (res.status === 402) {
        setChallenge(data.challenge ?? null);
        setStage("kyc_required");
      } else {
        setApiError(data.error ?? "Payment request failed.");
        setStage("idle");
      }
    } catch {
      setApiError("Network error — is the dev server running?");
      setStage("idle");
    }
  }

  async function proveAndPay() {
    if (!session) return;
    if (!challenge?.txNonce) {
      // Proofs are bound to a single-use server challenge; without one, ask again.
      setApiError("Challenge expired — send the payment again to get a new one.");
      setStage("idle");
      return;
    }
    setStage("proving");
    setApiError("");
    setProofStep(0);
    await sleep(400);

    try {
      // Real Groth16 proof, generated in the browser — private inputs never leave this device.
      setProofStep(1);
      const minAge = challenge?.minAge ?? 18;
      const { proof, publicSignals } = await generateKYCProof(
        { idHash: session.idHash, salt: session.salt, birthYear: session.birthYear },
        session.commitment,
        minAge,
        challenge?.txNonce ?? "",
        challenge?.reveal
      );

      setProofStep(2);
      const res = await fetch("/api/v1/verify-proof", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.apiKey}`,
        },
        body: JSON.stringify({
          proof,
          publicSignals,
          amount,
          recipient: DEMO_RECIPIENT,
        }),
      });

      const data = await res.json();
      setProofStep(-1);

      if (res.ok && data.status === "approved") {
        // approveWithProof records spend and returns dailyTotal AFTER the payment
        const newTotal = data.decision?.dailyTotal ?? dailySpend + amount;
        const proofHash = data.commitment
          ? "0x" + String(data.commitment).slice(-16).padStart(16, "0")
          : "0x" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
              b.toString(16).padStart(2, "0")
            ).join("");

        const tx: Tx = {
          id: data.txId,
          amount,
          type: "zk-verified",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          proof: proofHash,
        };
        setDailySpend(newTotal);
        setTxLog((prev) => [tx, ...prev].slice(0, 8));
        setLastTx(tx);
        setStage("kyc_approved");
      } else {
        // The challenge nonce is single-use and now spent; a retry needs a fresh one.
        setApiError(data.error ?? "Proof verification failed.");
        setChallenge(null);
        setStage("idle");
      }
    } catch (err) {
      setProofStep(-1);
      setApiError(
        err instanceof Error ? `Proof generation failed: ${err.message}` : "Proof generation failed."
      );
      setChallenge(null);
      setStage("idle");
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (stage === "init") {
    return (
      <div className="py-12 text-center space-y-3">
        <span className="w-2 h-2 rounded-full bg-zq-accent animate-pulse inline-block"/>
        <p className="text-xs text-zq-muted">Initialising demo session…</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-zq-danger">Could not start demo session.</p>
        <p className="text-xs text-zq-muted">Make sure the dev server is running, then reload.</p>
        <button
          onClick={fullReset}
          className="text-xs text-zq-muted hover:text-zq-text transition-colors border border-zq-line px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Session header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zq-success animate-pulse" />
            <span className="text-xs text-zq-success font-medium font-mono">agent_live</span>
          </div>
          <span className="text-zq-faint">·</span>
          <span className="text-xs text-zq-muted font-mono">{session?.agentId ?? "…"}</span>
          <span className="text-zq-faint">·</span>
          {session?.type === "registered" ? (
            <span className="text-xs px-1.5 py-0.5 rounded border border-zq-accent/30 bg-zq-accent/10 text-zq-accent font-medium">
              registered
            </span>
          ) : (
            <span className="text-xs text-zq-faint">demo agent</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {session?.type === "demo" && (
            <a
              href="/register"
              className="text-xs text-zq-accent hover:text-zq-accent transition-colors"
            >
              Register an agent →
            </a>
          )}
          <button
            onClick={fullReset}
            className="text-xs text-zq-faint hover:text-zq-text transition-colors"
          >
            Reset session
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="md:col-span-3 space-y-3">

          {/* Daily limit card */}
          <div className="bg-zq-surface border border-zq-line rounded-md p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="font-mono text-xs text-zq-muted uppercase tracking-[0.12em] mb-1.5">Daily limit used</p>
                <p className={clsx(
                  "text-3xl font-black font-mono tabular-nums tracking-tight",
                  spendPct >= 100 ? "text-zq-danger" : spendPct >= 60 ? "text-zq-warn" : "text-zq-text"
                )}>
                  ${dailySpend.toLocaleString()}
                  <span className="text-base text-zq-faint font-normal"> / $1,000</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-zq-muted uppercase tracking-[0.12em] mb-1.5">Anonymous limit</p>
                <p className={clsx(
                  "text-sm font-bold font-mono",
                  remaining === 0 ? "text-zq-danger" : "text-zq-soft"
                )}>
                  ${remaining.toLocaleString()} left
                </p>
                <p className="text-xs text-zq-faint mt-0.5">resets midnight UTC</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-1 bg-zq-surface rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-700",
                    spendPct >= 100 ? "bg-zq-danger" : spendPct >= 60 ? "bg-zq-warn" : "bg-zq-accent"
                  )}
                  style={{ width: `${spendPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zq-faint font-mono">
                <span>$0</span>
                <span className={wouldTriggerKyc && dailySpend < DAILY_LIMIT ? "text-zq-warn" : ""}>
                  {remaining > 0 ? `$${remaining.toLocaleString()} until ZK tier` : "ZK tier active"}
                </span>
                <span>$1,000</span>
              </div>
            </div>
          </div>

          {/* Transfer form */}
          <div className="bg-zq-surface border border-zq-line rounded-md p-5">
            <p className="font-mono text-xs text-zq-muted uppercase tracking-[0.12em] mb-4">New transfer</p>

            {/* Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {PRESETS.map((p) => {
                const triggers = dailySpend + p.amount >= DAILY_LIMIT;
                return (
                  <button
                    key={p.label}
                    onClick={() => { setAmount(p.amount); reset(); }}
                    className={clsx(
                      "rounded-md border p-3 text-left transition-all",
                      amount === p.amount
                        ? "bg-zq-accent/10 border-zq-accent/40"
                        : "bg-zq-surface border-zq-line hover:border-zq-line-strong hover:bg-zq-surface"
                    )}
                  >
                    <p className={clsx("text-sm font-bold", amount === p.amount ? "text-zq-accent" : "text-zq-text")}>
                      {p.label}
                    </p>
                    <p className="text-xs text-zq-muted mt-0.5">{p.description}</p>
                    <p className={clsx("text-xs mt-1.5 font-medium", triggers ? "text-zq-warn" : "text-zq-success")}>
                      {triggers ? "ZK required" : "Anonymous"}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Custom amount */}
            <div className="mb-4">
              <label className="text-xs text-zq-muted mb-1.5 block">Custom amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zq-muted font-mono text-sm">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(Number(e.target.value)); reset(); }}
                  min={1}
                  className="w-full bg-zq-surface border border-zq-line rounded-md pl-7 pr-4 py-2.5 text-zq-text text-sm font-mono focus:outline-none focus:border-zq-accent/60 transition-colors"
                />
              </div>
            </div>

            {/* Compliance preview */}
            <div className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded border text-xs mb-4 transition-colors",
              wouldTriggerKyc
                ? "bg-zq-warn/10 border-zq-warn/30 text-zq-warn"
                : "bg-zq-success/10 border-zq-success/30 text-zq-success"
            )}>
              <span className={clsx("w-1 h-1 rounded-full shrink-0", wouldTriggerKyc ? "bg-zq-warn" : "bg-zq-success")} />
              {wouldTriggerKyc
                ? `$${amount.toLocaleString()} transfer requires ZK identity proof`
                : `$${amount.toLocaleString()} transfer will settle anonymously`}
            </div>

            {/* API error */}
            {apiError && (
              <div className="mb-4 px-3 py-2 rounded border border-zq-danger/30 bg-zq-danger/10 text-xs text-zq-danger">
                {apiError}
              </div>
            )}

            {/* Actions */}
            {(stage === "idle" || stage === "approved" || stage === "kyc_approved") && (
              <button
                onClick={sendPayment}
                className="w-full bg-zq-accent hover:bg-zq-accent-strong text-zq-on-accent font-semibold min-h-[44px] py-2.5 rounded transition-colors text-sm"
              >
                Initiate transfer
              </button>
            )}

            {stage === "processing" && (
              <div className="w-full bg-zq-surface border border-zq-line text-zq-muted font-medium py-2.5 rounded-md text-sm text-center flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zq-accent animate-pulse"/>
                Processing…
              </div>
            )}

            {/* Compliance checkpoint */}
            {stage === "kyc_required" && (
              <div className="space-y-3">
                <div className="bg-zq-warn/10 border border-zq-warn/30 rounded-md p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zq-warn" />
                    <p className="text-zq-warn text-xs font-semibold uppercase tracking-wider">Compliance checkpoint</p>
                  </div>
                  <p className="text-zq-soft text-xs leading-relaxed">
                    Cumulative daily spend would reach{" "}
                    <span className="text-zq-text font-semibold font-mono">${(dailySpend + amount).toLocaleString()}</span>{" "}
                    — above the anonymous threshold. A zero-knowledge proof of identity is required to proceed.
                  </p>
                  <div className="mt-3 pt-3 border-t border-zq-line grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-zq-faint">Protocol</p>
                      <p className="text-zq-soft font-mono mt-0.5">Groth16</p>
                    </div>
                    <div>
                      <p className="text-zq-faint">PII transmitted</p>
                      <p className="text-zq-success font-mono mt-0.5">0 bytes</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={proveAndPay}
                  className="w-full bg-zq-accent hover:bg-zq-accent-strong text-zq-on-accent font-semibold min-h-[44px] py-2.5 rounded transition-all text-sm"
                >
                  Generate proof and authorize
                </button>
                <button
                  onClick={reset}
                  className="w-full min-h-[44px] border border-zq-line text-zq-muted py-2 rounded text-sm hover:text-zq-text hover:border-zq-line-strong transition-colors"
                >
                  Cancel transfer
                </button>
              </div>
            )}

            {/* ZK proof steps */}
            {stage === "proving" && (
              <div ref={progressRef} className="bg-zq-accent/10 border border-zq-accent/30 rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zq-accent animate-pulse" />
                  <p className="text-zq-accent text-sm font-semibold">Generating zero-knowledge proof</p>
                </div>
                {PROOF_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={clsx(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all",
                      i < proofStep  ? "bg-zq-accent/10 border-zq-accent/40"
                      : i === proofStep ? "bg-zq-accent/10 border-zq-accent/40"
                      : "bg-zq-surface border-zq-line"
                    )}>
                      {i < proofStep ? (
                        <svg className="w-3 h-3 text-zq-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : i === proofStep ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-zq-accent animate-pulse" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-xs transition-colors",
                        i < proofStep  ? "text-zq-accent"
                        : i === proofStep ? "text-zq-accent"
                        : "text-zq-faint"
                      )}>{step.label}</p>
                      {i === proofStep && (
                        <p className="text-xs text-zq-faint font-mono mt-0.5">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Settlement confirmation */}
            {(stage === "approved" || stage === "kyc_approved") && lastTx && (
              <div ref={stage === "kyc_approved" ? progressRef : undefined} className={clsx(
                "rounded-md p-4 border",
                stage === "kyc_approved"
                  ? "bg-zq-success/10 border-zq-success/30"
                  : "bg-zq-success/10 border-zq-success/30"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <svg className={clsx("w-4 h-4 shrink-0", stage === "kyc_approved" ? "text-zq-success" : "text-zq-success")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className={clsx("text-xs font-semibold", stage === "kyc_approved" ? "text-zq-success" : "text-zq-success")}>
                    {stage === "kyc_approved" ? "Authorized via zero-knowledge proof · settled" : "Anonymous transfer settled"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-zq-faint">Tx ID</p>
                    <p className="text-zq-soft font-mono mt-0.5">{lastTx.id}</p>
                  </div>
                  <div>
                    <p className="text-zq-faint">Amount</p>
                    <p className="text-zq-text font-mono font-semibold mt-0.5">${lastTx.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-zq-faint">PII transmitted</p>
                    <p className="text-zq-success font-mono mt-0.5">0 bytes</p>
                  </div>
                  {lastTx.proof && (
                    <div>
                      <p className="text-zq-faint">Proof hash</p>
                      <p className="text-zq-muted font-mono mt-0.5 truncate">π {lastTx.proof}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div className="md:col-span-2 space-y-3">

          {/* Active policy */}
          <div className="bg-zq-surface border border-zq-line rounded-md p-5">
            <p className="font-mono text-xs text-zq-muted uppercase tracking-[0.12em] mb-4">Active policy</p>
            <div className="space-y-2">
              <div className={clsx(
                "flex items-center gap-3 p-3 rounded-md border transition-colors",
                dailySpend < DAILY_LIMIT ? "bg-zq-success/10 border-zq-success/30" : "bg-zq-surface border-zq-line"
              )}>
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dailySpend < DAILY_LIMIT ? "bg-zq-success" : "bg-zq-success/20")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zq-text">Tier 1 · Anonymous</p>
                  <p className="text-xs text-zq-muted mt-0.5">&lt; $1,000 / day · 0 bytes PII</p>
                </div>
                {dailySpend < DAILY_LIMIT && <span className="text-xs text-zq-success font-semibold shrink-0">Active</span>}
              </div>
              <div className={clsx(
                "flex items-center gap-3 p-3 rounded-md border transition-colors",
                dailySpend >= DAILY_LIMIT ? "bg-zq-success/10 border-zq-success/30" : "bg-zq-surface border-zq-line"
              )}>
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dailySpend >= DAILY_LIMIT ? "bg-zq-success" : "bg-zq-success/20")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zq-text">Tier 2 · ZK Verified</p>
                  <p className="text-xs text-zq-muted mt-0.5">≥ $1,000 / day · Proof required</p>
                </div>
                {dailySpend >= DAILY_LIMIT && <span className="text-xs text-zq-success font-semibold shrink-0">Active</span>}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-zq-line grid grid-cols-2 gap-3">
              {[["Protocol", "Groth16"], ["Curve", "BN128"], ["Hash", "Poseidon"], ["Standard", "zquent:kyc"]].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-zq-faint">{k}</p>
                  <p className="text-xs text-zq-soft font-mono mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Settlement ledger */}
          <div className="bg-zq-surface border border-zq-line rounded-md p-5">
            <p className="font-mono text-xs text-zq-muted uppercase tracking-[0.12em] mb-4">Settlement ledger</p>
            {txLog.length === 0 ? (
              <div className="py-5 text-center space-y-1">
                <p className="text-xs text-zq-faint">No transactions this session.</p>
                <p className="text-xs text-zq-faint">Initiate a transfer to begin.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {txLog.map((tx) => (
                  <div key={tx.id} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={clsx(
                        "w-1 h-1 rounded-full shrink-0 mt-1.5",
                        tx.type === "zk-verified" ? "bg-zq-success" : "bg-zq-success"
                      )} />
                      <div className="min-w-0">
                        <p className="text-xs text-zq-soft font-mono truncate">{tx.id}</p>
                        <p className="text-xs text-zq-faint mt-0.5">{tx.time}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-zq-text font-mono">${tx.amount.toLocaleString()}</p>
                      <p className={clsx("text-xs font-medium mt-0.5",
                        tx.type === "zk-verified" ? "text-zq-success" : "text-zq-success"
                      )}>
                        {tx.type === "zk-verified" ? "zk-verified" : "anon"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
