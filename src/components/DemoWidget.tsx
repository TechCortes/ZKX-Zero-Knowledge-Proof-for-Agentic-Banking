"use client";

import { useState } from "react";
import clsx from "clsx";

const DAILY_LIMIT = 1000;

const PRESETS = [
  { label: "$200", amount: 200 },
  { label: "$600", amount: 600 },
  { label: "$1,200", amount: 1200 },
];

const PROOF_STEPS = [
  "Computing witness from private inputs…",
  "Generating Groth16 proof (BN128 curve)…",
  "Verifying proof on-chain…",
];

type Stage = "idle" | "approved" | "kyc_required" | "proving" | "kyc_approved";

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
    if (stage === "proving") return;
    setStage("idle");
    setLastTx(null);

    await sleep(600);

    const projected = dailySpend + amount;

    if (projected < DAILY_LIMIT) {
      // Anonymous — approve immediately
      const tx: Tx = {
        id: "zkx_" + Math.random().toString(36).slice(2, 10),
        amount,
        type: "anonymous",
        time: new Date().toLocaleTimeString(),
      };
      setDailySpend(projected);
      setTxLog((prev) => [tx, ...prev].slice(0, 8));
      setLastTx(tx);
      setStage("approved");
    } else {
      // KYC required
      setStage("kyc_required");
    }
  }

  async function proveAndPay() {
    setStage("proving");
    setProofStep(0);
    await sleep(900);
    setProofStep(1);
    await sleep(900);
    setProofStep(2);
    await sleep(700);

    const proofHash = "0x" + Math.random().toString(16).slice(2, 18).toUpperCase();
    const newSpend = dailySpend + amount;
    const tx: Tx = {
      id: "zkx_" + Math.random().toString(36).slice(2, 10),
      amount,
      type: "zk-verified",
      time: new Date().toLocaleTimeString(),
      proof: proofHash,
    };
    setDailySpend(newSpend);
    setTxLog((prev) => [tx, ...prev].slice(0, 8));
    setLastTx(tx);
    setStage("kyc_approved");
    setProofStep(-1);
  }

  return (
    <div className="space-y-5">
      {/* Scenario presets */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-600 uppercase tracking-widest">Scenario</span>
        {PRESETS.map((p) => {
          const wouldTrigger = dailySpend + p.amount >= DAILY_LIMIT;
          return (
            <button
              key={p.label}
              onClick={() => { setAmount(p.amount); reset(); }}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                amount === p.amount
                  ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                  : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
              )}
            >
              {p.label}
              <span className={clsx("ml-1.5 text-xs", wouldTrigger ? "text-yellow-500" : "text-green-500")}>
                · {wouldTrigger ? "KYC" : "anon"}
              </span>
            </button>
          );
        })}
        <button
          onClick={fullReset}
          className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors underline"
        >
          Reset demo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left panel */}
        <div className="lg:col-span-3 bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-5">

          {/* Agent header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-widest mb-0.5">Agent</p>
              <p className="text-sm font-semibold text-white font-mono">agent-zkx-demo</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-600 uppercase tracking-widest mb-0.5">Daily spend</p>
              <p className={clsx("text-sm font-bold font-mono tabular-nums",
                spendPct >= 100 ? "text-red-400" : spendPct >= 60 ? "text-yellow-400" : "text-green-400"
              )}>
                ${dailySpend.toLocaleString()}
                <span className="text-slate-700 font-normal"> / $1,000</span>
              </p>
            </div>
          </div>

          {/* Spend bar */}
          <div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all duration-700",
                  spendPct >= 100 ? "bg-red-500" : spendPct >= 60 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${spendPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-slate-700">
              <span>$0</span>
              <span>{remaining > 0 ? `$${remaining.toLocaleString()} until KYC` : "KYC threshold reached"}</span>
              <span>$1,000</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Payment amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(Number(e.target.value)); reset(); }}
                min={1}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Primary action */}
          {(stage === "idle" || stage === "approved" || stage === "kyc_approved") && (
            <button
              onClick={sendPayment}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Send Payment
            </button>
          )}

          {/* KYC gate */}
          {stage === "kyc_required" && (
            <div className="space-y-3">
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">Compliance Gate</p>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Daily spend would reach <span className="text-white font-semibold">${(dailySpend + amount).toLocaleString()}</span> — above the $1,000 anonymous threshold. A zero-knowledge proof of identity is required to proceed.
                </p>
              </div>
              <button
                onClick={proveAndPay}
                className="w-full bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 text-white font-semibold py-3 rounded-xl transition-all text-sm"
              >
                Generate ZK Proof &amp; Pay
              </button>
              <button
                onClick={reset}
                className="w-full border border-white/10 text-slate-500 py-2 rounded-xl text-xs hover:text-slate-300 hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ZK proof steps */}
          {stage === "proving" && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider">ZK Engine Running</p>
              </div>
              {PROOF_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={clsx(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all",
                    i < proofStep ? "bg-green-500/20 border-green-500/40"
                    : i === proofStep ? "bg-purple-500/20 border-purple-500/40"
                    : "bg-white/5 border-white/10"
                  )}>
                    {i < proofStep ? (
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i === proofStep ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    ) : null}
                  </div>
                  <span className={clsx("text-xs transition-colors",
                    i < proofStep ? "text-green-400"
                    : i === proofStep ? "text-purple-200"
                    : "text-slate-700"
                  )}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Success */}
          {(stage === "approved" || stage === "kyc_approved") && lastTx && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-400 text-xs font-semibold">
                  {stage === "kyc_approved" ? "Payment approved via ZK proof" : "Anonymous payment approved"}
                </p>
              </div>
              <p className="text-slate-500 text-xs">
                {stage === "kyc_approved"
                  ? "Identity verified — zero personal data transmitted."
                  : "No identity data collected or stored."}
              </p>
              <p className="text-slate-700 text-xs font-mono">tx: {lastTx.id}</p>
              {lastTx.proof && <p className="text-slate-700 text-xs font-mono truncate">π {lastTx.proof}</p>}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Policy */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-slate-600 uppercase tracking-widest mb-4">Active Policy</p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">&lt; $1,000 / day</p>
                  <p className="text-xs text-slate-600 mt-0.5">Anonymous · 0 bytes PII</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">&ge; $1,000 / day</p>
                  <p className="text-xs text-slate-600 mt-0.5">ZK proof · verified, not revealed</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                ["Protocol", "Groth16"],
                ["Curve", "BN128"],
                ["Hash", "Poseidon"],
                ["Standard", "zkx:kyc"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-700">{k}</p>
                  <p className="text-xs text-white font-mono mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ledger */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-slate-600 uppercase tracking-widest mb-4">Transaction Ledger</p>
            {txLog.length === 0 ? (
              <p className="text-xs text-slate-700 leading-relaxed">No transactions yet.<br />Send a payment to get started.</p>
            ) : (
              <div className="space-y-3">
                {txLog.map((tx) => (
                  <div key={tx.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={clsx("w-1 h-1 rounded-full shrink-0", tx.type === "zk-verified" ? "bg-purple-400" : "bg-green-400")} />
                        <span className="text-white text-xs font-mono font-semibold">${tx.amount.toLocaleString()}</span>
                      </div>
                      <span className={clsx("text-xs px-1.5 py-0.5 rounded font-medium",
                        tx.type === "zk-verified"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-green-500/10 text-green-400"
                      )}>
                        {tx.type}
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs font-mono pl-3">{tx.id} · {tx.time}</p>
                    {tx.proof && <p className="text-slate-800 text-xs font-mono pl-3 truncate">π {tx.proof}</p>}
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
