"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";

type Step = "agent" | "identity" | "review" | "success";

interface RegistrationResult {
  agentId: string;
  apiKey: string;
  commitment: string;
  chains: string[];
  createdAt: string;
}

const CHAIN_OPTIONS = [
  { id: "eip155:1",       label: "Ethereum",  short: "ETH"  },
  { id: "eip155:8453",    label: "Base",       short: "BASE" },
  { id: "solana:mainnet", label: "Solana",     short: "SOL"  },
  { id: "eip155:137",     label: "Polygon",    short: "MATIC"},
];

const AGENT_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;

function randomFieldElement(): string {
  const bytes = new Uint8Array(31); // 248-bit, always < BN128 prime
  crypto.getRandomValues(bytes);
  return BigInt(
    "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  ).toString();
}

export default function AgentRegistrationWizard() {
  const [step, setStep]               = useState<Step>("agent");
  const [agentId, setAgentId]         = useState("");
  const [birthYear, setBirthYear]     = useState(1990);
  const [idHash, setIdHash]           = useState("");
  const [salt, setSalt]               = useState("");
  const [commitment, setCommitment]   = useState("");
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitError, setCommitError] = useState("");
  const [selectedChains, setSelectedChains] = useState<string[]>(["eip155:1", "solana:mainnet"]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [result, setResult]           = useState<RegistrationResult | null>(null);
  const [copied, setCopied]           = useState(false);
  const [demoFilled, setDemoFilled]   = useState(false);

  const agentIdValid = AGENT_ID_RE.test(agentId);

  // ── Derive Poseidon commitment from idHash + salt ─────────────────────────
  const deriveCommitment = useCallback(async (ih: string, s: string) => {
    if (!ih || !s) { setCommitment(""); setCommitError(""); return; }
    setCommitLoading(true);
    setCommitError("");
    try {
      const { buildPoseidon } = await import("circomlibjs");
      const poseidon = await buildPoseidon();
      const hash = poseidon([BigInt(ih), BigInt(s)]);
      setCommitment(poseidon.F.toString(hash));
    } catch {
      setCommitment("");
      setCommitError("Invalid input — idHash and salt must be decimal BigInt strings.");
    } finally {
      setCommitLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!idHash && !salt) return;
    const id = setTimeout(() => deriveCommitment(idHash, salt), 420);
    return () => clearTimeout(id);
  }, [idHash, salt, deriveCommitment]);

  function fillDemoCredentials() {
    setIdHash(randomFieldElement());
    setSalt(randomFieldElement());
    setBirthYear(1990);
    setDemoFilled(true);
  }

  function toggleChain(chainId: string) {
    setSelectedChains((prev) =>
      prev.includes(chainId) ? prev.filter((c) => c !== chainId) : [...prev, chainId]
    );
  }

  async function register() {
    if (!commitment || !agentIdValid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, commitment, chains: selectedChains }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed."); return; }
      // Persist to localStorage so the demo widget can pick it up
      try {
        localStorage.setItem(
          "zkx_agent",
          JSON.stringify({ agentId: data.agentId, apiKey: data.apiKey, commitment: data.commitment })
        );
      } catch { /* storage unavailable — non-fatal */ }
      setResult(data);
      setStep("success");
    } catch {
      setError("Network error — check the dev server is running.");
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    if (!result) return;
    navigator.clipboard.writeText(result.apiKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Step progress indicator ───────────────────────────────────────────────
  const STEP_LABELS: Record<Step, string> = {
    agent:    "Agent ID",
    identity: "KYC Setup",
    review:   "Review",
    success:  "Done",
  };
  const ORDERED: Step[] = ["agent", "identity", "review", "success"];
  const stepIdx = ORDERED.indexOf(step);

  return (
    <div className="max-w-xl mx-auto">

      {/* Progress bar */}
      {step !== "success" && (
        <div className="flex items-center gap-2 mb-10">
          {(["agent", "identity", "review"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all",
                stepIdx > i
                  ? "bg-green-500/15 border-green-500/30 text-green-400"
                  : stepIdx === i
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white/[0.02] border-white/[0.08] text-slate-700"
              )}>
                {stepIdx > i ? "✓" : i + 1}
              </div>
              <span className={clsx(
                "text-xs hidden sm:block",
                stepIdx === i ? "text-white" : stepIdx > i ? "text-slate-500" : "text-slate-700"
              )}>
                {STEP_LABELS[s]}
              </span>
              {i < 2 && <div className="w-6 h-px bg-white/[0.06] hidden sm:block" />}
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1: Agent ID ───────────────────────────────────────────────── */}
      {step === "agent" && (
        <div className="space-y-7">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Register an Agent</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Create an OWS-compatible agent identity with ZKX compliance built in. Your KYC commitment is derived locally — no personal data leaves your device.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.15em] block mb-2">
              Agent ID
            </label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value.trim())}
              placeholder="my-trading-agent"
              autoComplete="off"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-700"
            />
            <p className="text-xs text-slate-700 mt-2">3–64 characters · letters, numbers, hyphens, underscores</p>
            {agentId.length > 0 && !agentIdValid && (
              <p className="text-xs text-red-400/80 mt-1">Invalid format.</p>
            )}
          </div>

          {/* What you get */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: "🔑", label: "Bearer token",   sub: "ows_key_ format" },
              { icon: "🔒", label: "ZKX compliance", sub: "zkx:kyc feature" },
              { icon: "⛓",  label: "Multi-chain",    sub: "CAIP-2 chains"   },
            ].map((f) => (
              <div key={f.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-center">
                <p className="text-lg mb-1">{f.icon}</p>
                <p className="text-xs font-semibold text-white">{f.label}</p>
                <p className="text-xs text-slate-700 mt-0.5 font-mono">{f.sub}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep("identity")}
            disabled={!agentIdValid}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Continue →
          </button>
        </div>
      )}

      {/* ── Step 2: Identity / KYC commitment ─────────────────────────────── */}
      {step === "identity" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">KYC Commitment Setup</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Your identity is hashed into a Poseidon commitment locally.{" "}
              <span className="text-slate-400">Only the commitment is registered — zero PII is transmitted.</span>
            </p>
          </div>

          {/* Demo credentials shortcut */}
          <button
            onClick={fillDemoCredentials}
            className="w-full flex items-center gap-3 p-4 bg-purple-500/5 border border-purple-500/20 hover:border-purple-500/35 rounded-xl transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:border-purple-500/35 transition-colors">
              <span className="text-purple-400 font-mono text-sm font-bold">⚡</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Use demo credentials</p>
              <p className="text-xs text-slate-600 mt-0.5">Auto-generate a random idHash + salt — not tied to a real identity</p>
            </div>
            {demoFilled && (
              <span className="text-xs text-green-400 font-medium shrink-0">Generated ✓</span>
            )}
          </button>

          <div className="space-y-4">
            {/* idHash */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.15em] block mb-2">
                Identity Hash{" "}
                <span className="text-slate-700 font-normal normal-case">— Poseidon hash of your gov ID</span>
              </label>
              <textarea
                value={idHash}
                onChange={(e) => { setIdHash(e.target.value.trim()); setDemoFilled(false); }}
                placeholder="Decimal BigInt string…"
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-700 resize-none"
              />
            </div>

            {/* salt */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.15em] block mb-2">
                Salt{" "}
                <span className="text-slate-700 font-normal normal-case">— random nonce, keep this secret</span>
              </label>
              <textarea
                value={salt}
                onChange={(e) => { setSalt(e.target.value.trim()); setDemoFilled(false); }}
                placeholder="Random BigInt string…"
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-700 resize-none"
              />
            </div>

            {/* birthYear */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.15em] block mb-2">
                Birth Year{" "}
                <span className="text-slate-700 font-normal normal-case">— private input for age ≥ 18 proof</span>
              </label>
              <input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
                min={1900}
                max={new Date().getUTCFullYear() - 18}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              <p className="text-xs text-slate-700 mt-1.5">
                Never sent to the server — used only when generating a ZK proof locally.
              </p>
            </div>
          </div>

          {/* Live commitment preview */}
          <div className={clsx(
            "rounded-xl border p-4 transition-all",
            commitment       ? "bg-green-500/5 border-green-500/20"
            : commitError    ? "bg-red-500/5 border-red-500/20"
            : commitLoading  ? "bg-white/[0.02] border-white/[0.06]"
            : "bg-white/[0.02] border-white/[0.06]"
          )}>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em] mb-2">
              Derived Commitment — Poseidon(idHash, salt)
            </p>
            {commitLoading ? (
              <p className="text-xs text-slate-600 font-mono animate-pulse">Computing…</p>
            ) : commitment ? (
              <p className="text-xs text-green-400 font-mono break-all leading-relaxed">{commitment}</p>
            ) : commitError ? (
              <p className="text-xs text-red-400/80">{commitError}</p>
            ) : (
              <p className="text-xs text-slate-700 font-mono">Enter idHash + salt above to derive</p>
            )}
          </div>

          {/* Private inputs notice */}
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 shrink-0 mt-0.5 text-xs">⚠</span>
            <p className="text-xs text-slate-500 leading-relaxed">
              Store your <span className="text-slate-400 font-mono">idHash</span>,{" "}
              <span className="text-slate-400 font-mono">salt</span>, and{" "}
              <span className="text-slate-400 font-mono">birthYear</span> securely.
              You will need them to generate ZK proofs for payments above $1,000/day.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("agent")}
              className="px-5 py-3 border border-white/[0.08] text-slate-500 hover:text-white hover:border-white/15 rounded-xl text-sm transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!commitment || commitLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & register ──────────────────────────────────────── */}
      {step === "review" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Review & Register</h2>
            <p className="text-slate-500 text-sm">Confirm your agent configuration before registering.</p>
          </div>

          {/* Summary table */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
            {[
              { label: "Agent ID",   val: agentId,                                    mono: true  },
              { label: "Commitment", val: commitment.slice(0, 36) + "…",              mono: true  },
              { label: "Birth Year", val: String(birthYear),                          mono: false },
            ].map(({ label, val, mono }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
                <span className="text-xs text-slate-600 shrink-0 w-24">{label}</span>
                <span className={clsx("text-xs text-slate-300 truncate", mono && "font-mono")}>{val}</span>
              </div>
            ))}
          </div>

          {/* Chain selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.15em] mb-3">
              Permitted Chains
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CHAIN_OPTIONS.map((c) => {
                const active = selectedChains.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleChain(c.id)}
                    className={clsx(
                      "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      active
                        ? "bg-blue-600/10 border-blue-500/30"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                    )}
                  >
                    <div className={clsx(
                      "w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0",
                      active ? "bg-blue-500 border-blue-500" : "border-slate-600"
                    )}>
                      {active && (
                        <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{c.label}</p>
                      <p className="text-xs text-slate-700 font-mono">{c.short}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep("identity"); setError(""); }}
              className="px-5 py-3 border border-white/[0.08] text-slate-500 hover:text-white hover:border-white/15 rounded-xl text-sm transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={register}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-700 to-blue-600 hover:from-purple-600 hover:to-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse"/>
                  Registering…
                </span>
              ) : "Register Agent"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Success ────────────────────────────────────────────────── */}
      {step === "success" && result && (
        <div className="space-y-6">
          <div className="text-center pt-2">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Agent Registered</h2>
            <p className="text-slate-500 text-sm">
              <span className="font-mono text-slate-400">{result.agentId}</span> is live with{" "}
              <span className="text-purple-400">zkx:kyc</span> compliance.
            </p>
          </div>

          {/* API Key — shown once */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-[0.12em]">
                API Key — shown once, store it now
              </p>
            </div>
            <div className="bg-[#04040a] border border-white/[0.06] rounded-lg p-3 flex items-start gap-3">
              <code className="text-xs text-green-400 font-mono flex-1 break-all leading-relaxed">
                {result.apiKey}
              </code>
              <button
                onClick={copyKey}
                className={clsx(
                  "shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all mt-0.5",
                  copied
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/15"
                )}
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
            {[
              { label: "Agent ID",    val: result.agentId },
              { label: "Commitment",  val: result.commitment.slice(0, 28) + "…" },
              { label: "Chains",      val: result.chains.length ? result.chains.join(", ") : "All chains" },
              { label: "Registered",  val: new Date(result.createdAt).toLocaleString() },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
                <span className="text-xs text-slate-600 shrink-0 w-24">{label}</span>
                <span className="text-xs text-slate-300 font-mono truncate">{val}</span>
              </div>
            ))}
          </div>

          {/* Usage snippet */}
          <div className="bg-[#060610] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.04]">
              <div className="w-2 h-2 rounded-full bg-red-500/40"/>
              <div className="w-2 h-2 rounded-full bg-yellow-500/40"/>
              <div className="w-2 h-2 rounded-full bg-green-500/40"/>
              <span className="text-xs text-slate-700 ml-2 font-mono">usage</span>
            </div>
            <div className="p-4 font-mono text-xs leading-6 space-y-0.5">
              <div className="text-slate-700"># POST /api/v1/payment — anonymous below $1,000/day</div>
              <div>
                <span className="text-blue-400">curl</span>{" "}
                <span className="text-green-400">-X POST /api/v1/payment</span> \
              </div>
              <div className="pl-4">
                <span className="text-yellow-400">-H</span>{" "}
                <span className="text-orange-300">
                  &quot;Authorization: Bearer {result.apiKey.slice(0, 22)}…&quot;
                </span> \
              </div>
              <div className="pl-4">
                <span className="text-yellow-400">-d</span>{" "}
                <span className="text-orange-300">
                  &apos;&#123;&quot;amount&quot;: 500, &quot;recipient&quot;: &quot;0x…&quot;&#125;&apos;
                </span>
              </div>
            </div>
          </div>

          {/* Browser session notice */}
          <div className="flex items-center gap-2 px-4 py-3 bg-green-500/5 border border-green-500/15 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>
            <p className="text-xs text-slate-400">
              Agent saved to this browser — the{" "}
              <span className="text-green-400 font-medium">Live Demo</span> will use your registered agent automatically.
            </p>
          </div>

          {/* CTA row */}
          <div className="flex gap-3">
            <a
              href="/#demo"
              className="flex-1 text-center px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Try the Demo →
            </a>
            <a
              href="/"
              className="px-5 py-3 border border-white/[0.08] text-slate-500 hover:text-white hover:border-white/15 rounded-xl text-sm transition-colors"
            >
              Home
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
