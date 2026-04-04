"use client";

import { useState, useCallback } from "react";
import clsx from "clsx";

const DAILY_LIMIT = 1000;
const AGENT_ID = "demo-agent";

const PRESETS = [
  { label: "$200", amount: 200, hint: "Anonymous" },
  { label: "$600", amount: 600, hint: "Anonymous" },
  { label: "$1,200", amount: 1200, hint: "Triggers KYC" },
];

const PROOF_STEPS = [
  "Computing witness from private inputs…",
  "Generating Groth16 proof (bn128 curve)…",
  "Submitting proof to verifier…",
];

type PaymentStatus = "idle" | "pending" | "approved" | "requires_kyc" | "proving" | "rejected";

interface Transaction {
  id: string;
  amount: number;
  recipient: string;
  status: "approved" | "kyc_approved";
  timestamp: string;
  proofUsed?: boolean;
  proofHash?: string;
}

export default function DemoWidget() {
  const [amount, setAmount] = useState(200);
  const [recipient, setRecipient] = useState("0xA3F9…c0de");
  const [dailySpend, setDailySpend] = useState(0);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState("");
  const [txId, setTxId] = useState("");
  const [proofHash, setProofHash] = useState("");
  const [proofStep, setProofStep] = useState(0);
  const [pendingPayment, setPendingPayment] = useState<{ amount: number; recipient: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);

  const spendPercent = Math.min((dailySpend / DAILY_LIMIT) * 100, 100);
  const isNearLimit = spendPercent >= 60;
  const isAtLimit = spendPercent >= 100;

  const addTransaction = (tx: Transaction) =>
    setTransactions((prev) => [tx, ...prev].slice(0, 8));

  const reset = () => {
    setStatus("idle");
    setPendingPayment(null);
    setMessage("");
    setTxId("");
    setProofHash("");
    setProofStep(0);
  };

  const requestPayment = useCallback(async () => {
    setStatus("pending");
    setMessage("");
    setTxId("");
    setProofHash("");
    try {
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: AGENT_ID, amount, recipient }),
      });
      const data = await res.json();
      if (data.status === "approved") {
        setDailySpend(data.decision.dailyTotal);
        setStatus("approved");
        setTxId(data.txId);
        setMessage("Payment cleared — no identity data transmitted.");
        addTransaction({
          id: data.txId,
          amount,
          recipient,
          status: "approved",
          timestamp: new Date().toLocaleTimeString(),
          proofUsed: false,
        });
      } else {
        setDailySpend(data.decision.dailyTotal);
        setStatus("requires_kyc");
        setMessage(data.decision.reason);
        setPendingPayment({ amount, recipient });
      }
    } catch {
      setStatus("rejected");
      setMessage("Network error.");
    }
  }, [amount, recipient]);

  const proveAndPay = useCallback(async () => {
    if (!pendingPayment) return;
    setStatus("proving");
    setIsGeneratingProof(true);
    setProofStep(0);

    try {
      // Animate through proof steps
      for (let i = 0; i < PROOF_STEPS.length; i++) {
        setProofStep(i);
        await new Promise((r) => setTimeout(r, 850));
      }

      const mockProof = {
        pi_a: ["0x1f3a9c", "0x2b8e7d", "0x1"],
        pi_b: [["0x3c1a2b", "0x4d9f8e"], ["0x5e2b3c", "0x6f1a9d"], ["0x1", "0x0"]],
        pi_c: ["0x7a3b4c", "0x8d2e1f", "0x1"],
        protocol: "groth16",
        curve: "bn128",
      };
      const mockPublicSignals = ["12345678901234567890", "2026", "18"];

      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof: mockProof,
          publicSignals: mockPublicSignals,
          paymentRequest: { agentId: AGENT_ID, ...pendingPayment },
        }),
      });
      const data = await res.json();

      if (data.status === "approved") {
        const hash = "0x" + Math.random().toString(16).slice(2, 18).toUpperCase();
        setDailySpend(data.decision.dailyTotal);
        setStatus("approved");
        setTxId(data.txId);
        setProofHash(hash);
        setMessage("Identity verified via ZK proof. Zero PII transmitted.");
        setPendingPayment(null);
        addTransaction({
          id: data.txId,
          amount: pendingPayment.amount,
          recipient: pendingPayment.recipient,
          status: "kyc_approved",
          timestamp: new Date().toLocaleTimeString(),
          proofUsed: true,
          proofHash: hash,
        });
      } else {
        setStatus("rejected");
        setMessage(data.error ?? "Proof rejected.");
      }
    } catch {
      setStatus("rejected");
      setMessage("Proof generation failed.");
    } finally {
      setIsGeneratingProof(false);
    }
  }, [pendingPayment]);

  return (
    <div className="space-y-6">
      {/* Scenario quick-select */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 uppercase tracking-widest">Scenario</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => { setAmount(p.amount); reset(); }}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              amount === p.amount
                ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
            )}
          >
            {p.label}
            <span className={clsx("ml-1.5", p.hint === "Triggers KYC" ? "text-yellow-500" : "text-green-500")}>
              · {p.hint}
            </span>
          </button>
        ))}
        {(status !== "idle") && (
          <button onClick={reset} className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors underline">
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Payment form — 3 cols */}
        <div className="lg:col-span-3 bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Agent</p>
              <p className="text-sm font-semibold text-white font-mono">agent-demo</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Daily spend</p>
              <p className={clsx("text-sm font-semibold font-mono", isAtLimit ? "text-red-400" : isNearLimit ? "text-yellow-400" : "text-green-400")}>
                ${dailySpend.toLocaleString()} <span className="text-slate-600">/ $1,000</span>
              </p>
            </div>
          </div>

          {/* Spend bar */}
          <div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all duration-700", isAtLimit ? "bg-red-500" : isNearLimit ? "bg-yellow-500" : "bg-green-500")}
                style={{ width: `${spendPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-slate-600">
              <span>$0</span>
              <span className="text-slate-500">KYC threshold</span>
              <span>$1,000</span>
            </div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                  min={1}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Recipient</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Send button */}
          {status !== "requires_kyc" && status !== "proving" && (
            <button
              onClick={requestPayment}
              disabled={status === "pending"}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm tracking-wide"
            >
              {status === "pending" ? "Processing…" : "Initiate Payment"}
            </button>
          )}

          {/* KYC Challenge */}
          {status === "requires_kyc" && (
            <div className="space-y-3">
              <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">Compliance Gate</p>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{message}</p>
              </div>
              <button
                onClick={proveAndPay}
                className="w-full bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                Generate ZK Proof &amp; Pay
              </button>
              <button
                onClick={reset}
                className="w-full border border-white/10 text-slate-500 py-2 rounded-xl text-xs hover:border-white/20 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ZK Proof generation progress */}
          {status === "proving" && (
            <div className="border border-purple-500/20 bg-purple-500/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider">ZK Engine</p>
              </div>
              {PROOF_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className={clsx("w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all", i < proofStep ? "bg-green-500/20 border border-green-500/40" : i === proofStep ? "bg-purple-500/20 border border-purple-500/40" : "bg-white/5 border border-white/10")}>
                    {i < proofStep ? (
                      <svg className="w-2.5 h-2.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : i === proofStep ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    ) : null}
                  </div>
                  <span className={clsx(i < proofStep ? "text-green-400" : i === proofStep ? "text-purple-300" : "text-slate-600")}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {status === "approved" && (
            <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-green-400 text-xs font-semibold">Payment Settled</p>
              </div>
              <p className="text-slate-300 text-xs">{message}</p>
              <p className="text-slate-600 text-xs font-mono">tx: {txId}</p>
              {proofHash && <p className="text-slate-600 text-xs font-mono">proof: {proofHash}</p>}
            </div>
          )}

          {status === "rejected" && (
            <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-3 text-xs text-red-400">{message}</div>
          )}
        </div>

        {/* Right: Policy + Tx log — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          {/* Policy */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Compliance Policy</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">&lt; $1,000 / day</p>
                  <p className="text-xs text-slate-500 mt-0.5">Anonymous · 0 bytes PII</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">&ge; $1,000 / day</p>
                  <p className="text-xs text-slate-500 mt-0.5">ZK proof · identity verified, not revealed</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-600">Protocol</p>
                <p className="text-xs text-white font-mono mt-0.5">Groth16</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Curve</p>
                <p className="text-xs text-white font-mono mt-0.5">BN128</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Hash fn</p>
                <p className="text-xs text-white font-mono mt-0.5">Poseidon</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Standard</p>
                <p className="text-xs text-white font-mono mt-0.5">zkx:kyc</p>
              </div>
            </div>
          </div>

          {/* Tx log */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Ledger</p>
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-600 leading-relaxed">No transactions yet.<br />Try sending a payment above.</p>
            ) : (
              <div className="space-y-2.5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={clsx("w-1 h-1 rounded-full shrink-0", tx.proofUsed ? "bg-purple-400" : "bg-green-400")} />
                        <span className="text-white font-mono font-semibold">${tx.amount.toLocaleString()}</span>
                      </div>
                      <span className={clsx("px-1.5 py-0.5 rounded text-xs font-medium", tx.proofUsed ? "bg-purple-500/10 text-purple-400" : "bg-green-500/10 text-green-400")}>
                        {tx.proofUsed ? "ZK-verified" : "anonymous"}
                      </span>
                    </div>
                    <p className="text-slate-600 font-mono pl-3">{tx.recipient.slice(0, 12)}… · {tx.timestamp}</p>
                    {tx.proofHash && <p className="text-slate-700 font-mono pl-3 truncate">π {tx.proofHash}</p>}
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
