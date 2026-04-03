"use client";

import { useState, useCallback } from "react";
import clsx from "clsx";

const DAILY_LIMIT = 1000;
const AGENT_ID = "demo-agent";

type PaymentStatus = "idle" | "pending" | "approved" | "requires_kyc" | "proving" | "rejected";

interface Transaction {
  id: string;
  amount: number;
  recipient: string;
  status: "approved" | "kyc_approved" | "rejected";
  timestamp: string;
  proofUsed?: boolean;
}

export default function Home() {
  const [amount, setAmount] = useState(500);
  const [recipient, setRecipient] = useState("0xAgent...f00d");
  const [dailySpend, setDailySpend] = useState(0);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState("");
  const [txId, setTxId] = useState("");
  const [pendingPayment, setPendingPayment] = useState<{ amount: number; recipient: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);

  const spendPercent = Math.min((dailySpend / DAILY_LIMIT) * 100, 100);
  const isNearLimit = spendPercent >= 70;
  const isAtLimit = spendPercent >= 100;

  const addTransaction = (tx: Transaction) => {
    setTransactions((prev) => [tx, ...prev].slice(0, 10));
  };

  const requestPayment = useCallback(async () => {
    setStatus("pending");
    setMessage("");

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
        setMessage(data.decision.reason);
        addTransaction({
          id: data.txId,
          amount,
          recipient,
          status: "approved",
          timestamp: new Date().toLocaleTimeString(),
          proofUsed: false,
        });
      } else if (data.status === "requires_kyc") {
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
    setMessage("Generating ZK proof in browser... (identity stays private)");

    try {
      // For the demo: call /api/verify-proof with a simulated proof
      // In production this calls generateKYCProof() from src/zkp/prover.ts
      // which runs snarkjs in the browser using the compiled .wasm + .zkey
      await new Promise((r) => setTimeout(r, 2500)); // simulate proof generation time

      const mockProof = {
        pi_a: ["0x1", "0x2", "0x1"],
        pi_b: [["0x3", "0x4"], ["0x5", "0x6"], ["0x1", "0x0"]],
        pi_c: ["0x7", "0x8", "0x1"],
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
        setDailySpend(data.decision.dailyTotal);
        setStatus("approved");
        setTxId(data.txId);
        setMessage(data.message ?? "ZK proof verified. Payment approved.");
        setPendingPayment(null);
        addTransaction({
          id: data.txId,
          amount: pendingPayment.amount,
          recipient: pendingPayment.recipient,
          status: "kyc_approved",
          timestamp: new Date().toLocaleTimeString(),
          proofUsed: true,
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
    <main className="min-h-screen bg-zkx-bg p-6 md:p-12">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-zkx-accent flex items-center justify-center text-white font-bold text-sm">
            ZX
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ZKX</h1>
          <span className="text-xs px-2 py-0.5 rounded-full border border-zkx-border text-slate-400">
            ZK-KYC for Agents
          </span>
        </div>
        <p className="text-slate-400 text-sm mb-8">
          Composable compliance without doxxing — built on the{" "}
          <a
            href="https://github.com/open-wallet-standard/core"
            target="_blank"
            rel="noreferrer"
            className="text-zkx-accent underline"
          >
            Open Wallet Standard
          </a>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Payment Panel */}
          <div className="bg-zkx-panel border border-zkx-border rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Agent Payment
            </h2>

            {/* Daily spend meter */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Daily anonymous spend</span>
                <span>
                  ${dailySpend.toLocaleString()} / $1,000
                </span>
              </div>
              <div className="h-2 bg-zkx-border rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-700",
                    isAtLimit
                      ? "bg-zkx-red"
                      : isNearLimit
                      ? "bg-zkx-yellow"
                      : "bg-zkx-green"
                  )}
                  style={{ width: `${spendPercent}%` }}
                />
              </div>
              <p className="text-xs mt-1 text-slate-500">
                {isAtLimit
                  ? "ZK proof required for all payments today."
                  : `$${Math.max(0, DAILY_LIMIT - dailySpend).toLocaleString()} remaining before KYC threshold.`}
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Amount (USD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-zkx-bg border border-zkx-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zkx-accent"
                  min={1}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Recipient</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-zkx-bg border border-zkx-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zkx-accent"
                />
              </div>
            </div>

            {/* Action Button */}
            {status !== "requires_kyc" && (
              <button
                onClick={requestPayment}
                disabled={status === "pending" || status === "proving"}
                className="w-full bg-zkx-accent hover:bg-purple-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {status === "pending" ? "Processing..." : "Send Payment"}
              </button>
            )}

            {/* KYC Challenge */}
            {status === "requires_kyc" && (
              <div className="space-y-3">
                <div className="border border-zkx-yellow/40 bg-zkx-yellow/5 rounded-lg p-4">
                  <p className="text-zkx-yellow text-xs font-semibold mb-1">KYC Required</p>
                  <p className="text-slate-300 text-xs">{message}</p>
                </div>
                <button
                  onClick={proveAndPay}
                  disabled={isGeneratingProof}
                  className="w-full bg-zkx-green hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                >
                  {isGeneratingProof ? "Generating ZK Proof..." : "Prove Identity (ZK) & Pay"}
                </button>
                <button
                  onClick={() => { setStatus("idle"); setPendingPayment(null); }}
                  className="w-full border border-zkx-border text-slate-400 py-2 rounded-lg text-sm hover:border-slate-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Status Message */}
            {message && status !== "requires_kyc" && (
              <div
                className={clsx(
                  "rounded-lg p-3 text-xs",
                  status === "approved"
                    ? "bg-zkx-green/10 border border-zkx-green/30 text-zkx-green"
                    : status === "proving"
                    ? "bg-zkx-accent/10 border border-zkx-accent/30 text-purple-300"
                    : "bg-zkx-red/10 border border-zkx-red/30 text-zkx-red"
                )}
              >
                {status === "proving" && (
                  <span className="inline-block w-2 h-2 rounded-full bg-zkx-accent animate-pulse mr-2" />
                )}
                {message}
                {txId && (
                  <span className="block mt-1 text-slate-400">tx: {txId}</span>
                )}
              </div>
            )}
          </div>

          {/* Right: Policy + Tx log */}
          <div className="space-y-6">
            {/* Policy overview */}
            <div className="bg-zkx-panel border border-zkx-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
                Policy Rules
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-zkx-green mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white">&lt; $1,000 / day</p>
                    <p className="text-xs text-slate-400">Anonymous micropayments — no KYC, no identity data collected.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-zkx-yellow mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white">&ge; $1,000 / day</p>
                    <p className="text-xs text-slate-400">ZK proof of identity required. Proves compliance without revealing personal data.</p>
                  </div>
                </div>
                <div className="border-t border-zkx-border pt-3 mt-2">
                  <p className="text-xs text-slate-500">
                    Built on{" "}
                    <span className="text-zkx-accent">zkx:kyc</span> — an OWS feature extension.
                    The circuit verifies age &amp; identity commitment via Poseidon hash.
                    Zero personal data leaves your device.
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction log */}
            <div className="bg-zkx-panel border border-zkx-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
                Transaction Log
              </h2>
              {transactions.length === 0 ? (
                <p className="text-xs text-slate-500">No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-xs border border-zkx-border rounded-lg px-3 py-2"
                    >
                      <div>
                        <span className="text-white font-mono">${tx.amount.toLocaleString()}</span>
                        <span className="text-slate-500 ml-2">→ {tx.recipient.slice(0, 10)}…</span>
                        {tx.proofUsed && (
                          <span className="ml-2 text-zkx-accent">🔐 ZK</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={clsx(
                            "font-semibold",
                            tx.status === "approved" ? "text-zkx-green" : "text-zkx-accent"
                          )}
                        >
                          {tx.status === "kyc_approved" ? "ZK approved" : "approved"}
                        </span>
                        <span className="block text-slate-600">{tx.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
