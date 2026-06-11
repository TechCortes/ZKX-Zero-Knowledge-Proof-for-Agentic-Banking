"use client";

import { useState } from "react";
import clsx from "clsx";

const DAILY_LIMIT = 1000;

const PRESETS = [
  { label: "$200", amount: 200, description: "Micropayment" },
  { label: "$600", amount: 600, description: "Standard" },
  { label: "$1,200", amount: 1200, description: "High value" },
];

const PROOF_STEPS = [
  { label: "Computing witness from private inputs", detail: "Poseidon(idHash, salt)" },
  { label: "Generating Groth16 proof", detail: "BN128 curve · ~2.1s" },
  { label: "Submitting proof for verification", detail: "On-chain verifier" },
];

type Stage = "idle" | "processing" | "approved" | "kyc_required" | "proving" | "kyc_approved";

interface Tx {
  id: string;
  amount: number;
  type: "anonymous" | "zk-verified";
  time: string;
  proof?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function DemoWidget() {
  const [amount, setAmount] = useState(200);
  const [dailySpend, setDailySpend] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [proofStep, setProofStep] = useState(-1);
  const [txLog, setTxLog] = useState<Tx[]>([]);
  const [lastTx, setLastTx] = useState<Tx | null>(null);

  const remaining = Math.max(0, DAILY_LIMIT - dailySpend);
  const spendPct = Math.min((dailySpend / DAILY_LIMIT) * 100, 100);
  const wouldTriggerKyc = dailySpend + amount >= DAILY_LIMIT;

  function reset() {
    setStage("idle");
    setProofStep(-1);
    setLastTx(null);
  }

  function fullReset() {
    setDailySpend(0);
    setTxLog([]);
    reset();
  }

  async function sendPayment() {
    if (stage === "proving" || stage === "processing") return;
    setStage("processing");
    setLastTx(null);
    await sleep(500);

    const projected = dailySpend + amount;

    if (projected < DAILY_LIMIT) {
      const tx: Tx = {
        id: "0x" + Math.random().toString(16).slice(2, 10).toUpperCase(),
        amount,
        type: "anonymous",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setDailySpend(projected);
      setTxLog((prev) => [tx, ...prev].slice(0, 8));
      setLastTx(tx);
      setStage("approved");
    } else {
      setStage("kyc_required");
    }
  }

  async function proveAndPay() {
    setStage("proving");
    setProofStep(0);
    await sleep(800);
    setProofStep(1);
    await sleep(1400);
    setProofStep(2);
    await sleep(700);

    const proofHash =
      "0x" +
      Array.from({ length: 8 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
      ).join("");

    const tx: Tx = {
      id: "0x" + Math.random().toString(16).slice(2, 10).toUpperCase(),
      amount,
      type: "zk-verified",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      proof: proofHash,
    };
    setDailySpend(dailySpend + amount);
    setTxLog((prev) => [tx, ...prev].slice(0, 8));
    setLastTx(tx);
    setStage("kyc_approved");
    setProofStep(-1);
  }

  return (
    <div className="space-y-4">

      {/* Session header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium font-mono">agent_live</span>
          </div>
          <span className="text-white/10">·</span>
          <span className="text-xs text-slate-600 font-mono">0x7f3a…c4d2</span>
          <span className="text-white/10">·</span>
          <span className="text-xs text-slate-700">zkx:kyc enabled</span>
        </div>
        <button
          onClick={fullReset}
          className="text-xs text-slate-700 hover:text-slate-400 transition-colors"
        >
          Reset session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left panel */}
        <div className="lg:col-span-3 space-y-3">

          {/* Account balance card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-[0.15em] mb-1.5">Daily Limit Used</p>
                <p className={clsx(
                  "text-3xl font-black font-mono tabular-nums tracking-tight",
                  spendPct >= 100 ? "text-red-400" : spendPct >= 60 ? "text-amber-400" : "text-white"
                )}>
                  ${dailySpend.toLocaleString()}
                  <span className="text-base text-slate-700 font-normal"> / $1,000</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-600 uppercase tracking-[0.15em] mb-1.5">Anonymous limit</p>
                <p className={clsx(
                  "text-sm font-bold font-mono",
                  remaining === 0 ? "text-red-400" : "text-slate-300"
                )}>
                  ${remaining.toLocaleString()} left
                </p>
                <p className="text-xs text-slate-700 mt-0.5">resets midnight UTC</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-700",
                    spendPct >= 100 ? "bg-red-500" : spendPct >= 60 ? "bg-amber-500" : "bg-blue-500"
                  )}
                  style={{ width: `${spendPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-700 font-mono">
                <span>$0</span>
                <span className={wouldTriggerKyc && dailySpend < DAILY_LIMIT ? "text-amber-600" : ""}>
                  {remaining > 0 ? `$${remaining.toLocaleString()} until ZK tier` : "ZK tier active"}
                </span>
                <span>$1,000</span>
              </div>
            </div>
          </div>

          {/* Transfer form */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-slate-600 uppercase tracking-[0.15em] mb-4">New Transfer</p>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {PRESETS.map((p) => {
                const triggers = dailySpend + p.amount >= DAILY_LIMIT;
                return (
                  <button
                    key={p.label}
                    onClick={() => { setAmount(p.amount); reset(); }}
                    className={clsx(
                      "rounded-xl border p-3 text-left transition-all",
                      amount === p.amount
                        ? "bg-blue-600/15 border-blue-500/30"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04]"
                    )}
                  >
                    <p className={clsx("text-sm font-bold", amount === p.amount ? "text-blue-300" : "text-white")}>
                      {p.label}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{p.description}</p>
                    <p className={clsx("text-xs mt-1.5 font-medium", triggers ? "text-amber-500" : "text-green-500")}>
                      {triggers ? "ZK required" : "Anonymous"}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Amount input */}
            <div className="mb-4">
              <label className="text-xs text-slate-600 mb-1.5 block">Custom amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(Number(e.target.value)); reset(); }}
                  min={1}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-7 pr-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-blue-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Compliance preview banner */}
            <div className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs mb-4 transition-colors",
              wouldTriggerKyc
                ? "bg-amber-500/5 border-amber-500/15 text-amber-400"
                : "bg-green-500/5 border-green-500/15 text-green-400"
            )}>
              <span className={clsx("w-1 h-1 rounded-full shrink-0", wouldTriggerKyc ? "bg-amber-400" : "bg-green-400")} />
              {wouldTriggerKyc
                ? `$${amount.toLocaleString()} transfer requires ZK identity proof`
                : `$${amount.toLocaleString()} transfer will settle anonymously`
              }
            </div>

            {/* Primary action */}
            {(stage === "idle" || stage === "approved" || stage === "kyc_approved") && (
              <button
                onClick={sendPayment}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Initiate Transfer
              </button>
            )}

            {stage === "processing" && (
              <div className="w-full bg-white/[0.03] border border-white/[0.06] text-slate-500 font-medium py-2.5 rounded-xl text-sm text-center">
                Processing…
              </div>
            )}

            {/* Compliance checkpoint */}
            {stage === "kyc_required" && (
              <div className="space-y-3">
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Compliance Checkpoint</p>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Cumulative daily spend would reach{" "}
                    <span className="text-white font-semibold font-mono">${(dailySpend + amount).toLocaleString()}</span>{" "}
                    — above the anonymous threshold. A zero-knowledge proof of identity is required to proceed.
                  </p>
                  <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-700">Protocol</p>
                      <p className="text-slate-400 font-mono mt-0.5">Groth16</p>
                    </div>
                    <div>
                      <p className="text-slate-700">PII transmitted</p>
                      <p className="text-green-400 font-mono mt-0.5">0 bytes</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={proveAndPay}
                  className="w-full bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
                >
                  Generate ZK Proof &amp; Authorize
                </button>
                <button
                  onClick={reset}
                  className="w-full border border-white/[0.06] text-slate-600 py-2 rounded-xl text-xs hover:text-slate-400 hover:border-white/10 transition-colors"
                >
                  Cancel transfer
                </button>
              </div>
            )}

            {/* ZK proof steps */}
            {stage === "proving" && (
              <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider">ZK Engine Running</p>
                </div>
                {PROOF_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={clsx(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all",
                      i < proofStep ? "bg-green-500/15 border-green-500/30"
                      : i === proofStep ? "bg-purple-500/15 border-purple-500/30"
                      : "bg-white/[0.03] border-white/[0.06]"
                    )}>
                      {i < proofStep ? (
                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : i === proofStep ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-xs transition-colors",
                        i < proofStep ? "text-green-400"
                        : i === proofStep ? "text-purple-200"
                        : "text-slate-700"
                      )}>{step.label}</p>
                      {i === proofStep && (
                        <p className="text-xs text-slate-700 font-mono mt-0.5">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Settlement confirmation */}
            {(stage === "approved" || stage === "kyc_approved") && lastTx && (
              <div className={clsx(
                "rounded-xl p-4 border",
                stage === "kyc_approved"
                  ? "bg-purple-500/5 border-purple-500/15"
                  : "bg-green-500/5 border-green-500/15"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <svg className={clsx("w-4 h-4 shrink-0", stage === "kyc_approved" ? "text-purple-400" : "text-green-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className={clsx("text-xs font-semibold", stage === "kyc_approved" ? "text-purple-300" : "text-green-400")}>
                    {stage === "kyc_approved" ? "Authorized via ZK proof · Settled" : "Anonymous transfer settled"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-slate-700">Tx ID</p>
                    <p className="text-slate-400 font-mono mt-0.5">{lastTx.id}</p>
                  </div>
                  <div>
                    <p className="text-slate-700">Amount</p>
                    <p className="text-white font-mono font-semibold mt-0.5">${lastTx.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-700">PII transmitted</p>
                    <p className="text-green-400 font-mono mt-0.5">0 bytes</p>
                  </div>
                  {lastTx.proof && (
                    <div>
                      <p className="text-slate-700">Proof hash</p>
                      <p className="text-slate-500 font-mono mt-0.5 truncate">π {lastTx.proof}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-3">

          {/* Active policy */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-slate-600 uppercase tracking-[0.15em] mb-4">Active Policy</p>
            <div className="space-y-2">
              <div className={clsx(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                dailySpend < DAILY_LIMIT ? "bg-green-500/8 border-green-500/20" : "bg-white/[0.02] border-white/[0.04]"
              )}>
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dailySpend < DAILY_LIMIT ? "bg-green-400" : "bg-green-400/20")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">Tier 1 · Anonymous</p>
                  <p className="text-xs text-slate-600 mt-0.5">&lt; $1,000 / day · 0 bytes PII</p>
                </div>
                {dailySpend < DAILY_LIMIT && <span className="text-xs text-green-400 font-semibold shrink-0">Active</span>}
              </div>
              <div className={clsx(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                dailySpend >= DAILY_LIMIT ? "bg-purple-500/8 border-purple-500/20" : "bg-white/[0.02] border-white/[0.04]"
              )}>
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dailySpend >= DAILY_LIMIT ? "bg-purple-400" : "bg-purple-400/20")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">Tier 2 · ZK Verified</p>
                  <p className="text-xs text-slate-600 mt-0.5">≥ $1,000 / day · Proof required</p>
                </div>
                {dailySpend >= DAILY_LIMIT && <span className="text-xs text-purple-400 font-semibold shrink-0">Active</span>}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-2 gap-3">
              {[["Protocol", "Groth16"], ["Curve", "BN128"], ["Hash", "Poseidon"], ["Standard", "zkx:kyc"]].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-700">{k}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Settlement ledger */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-slate-600 uppercase tracking-[0.15em] mb-4">Settlement Ledger</p>
            {txLog.length === 0 ? (
              <div className="py-5 text-center space-y-1">
                <p className="text-xs text-slate-700">No transactions this session.</p>
                <p className="text-xs text-slate-800">Initiate a transfer to begin.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {txLog.map((tx) => (
                  <div key={tx.id} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={clsx(
                        "w-1 h-1 rounded-full shrink-0 mt-1.5",
                        tx.type === "zk-verified" ? "bg-purple-400" : "bg-green-400"
                      )} />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 font-mono truncate">{tx.id}</p>
                        <p className="text-xs text-slate-700 mt-0.5">{tx.time}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-white font-mono">${tx.amount.toLocaleString()}</p>
                      <p className={clsx("text-xs font-medium mt-0.5",
                        tx.type === "zk-verified" ? "text-purple-400" : "text-green-400"
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
