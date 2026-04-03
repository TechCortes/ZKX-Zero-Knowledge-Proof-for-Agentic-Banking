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
  status: "approved" | "kyc_approved";
  timestamp: string;
  proofUsed?: boolean;
}

export default function DemoWidget() {
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

  const addTransaction = (tx: Transaction) =>
    setTransactions((prev) => [tx, ...prev].slice(0, 6));

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
        addTransaction({ id: data.txId, amount, recipient, status: "approved", timestamp: new Date().toLocaleTimeString(), proofUsed: false });
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
    setMessage("Generating ZK proof in browser… identity stays private.");
    try {
      await new Promise((r) => setTimeout(r, 2500));
      const mockProof = { pi_a: ["0x1", "0x2", "0x1"], pi_b: [["0x3", "0x4"], ["0x5", "0x6"], ["0x1", "0x0"]], pi_c: ["0x7", "0x8", "0x1"], protocol: "groth16", curve: "bn128" };
      const mockPublicSignals = ["12345678901234567890", "2026", "18"];
      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof: mockProof, publicSignals: mockPublicSignals, paymentRequest: { agentId: AGENT_ID, ...pendingPayment } }),
      });
      const data = await res.json();
      if (data.status === "approved") {
        setDailySpend(data.decision.dailyTotal);
        setStatus("approved");
        setTxId(data.txId);
        setMessage(data.message ?? "ZK proof verified. Payment approved.");
        setPendingPayment(null);
        addTransaction({ id: data.txId, amount: pendingPayment.amount, recipient: pendingPayment.recipient, status: "kyc_approved", timestamp: new Date().toLocaleTimeString(), proofUsed: true });
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Payment panel */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Agent Payment</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
            agent-demo
          </span>
        </div>

        {/* Spend meter */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Daily anonymous spend</span>
            <span className={clsx(isAtLimit ? "text-red-400" : isNearLimit ? "text-yellow-400" : "text-green-400")}>
              ${dailySpend.toLocaleString()} / $1,000
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all duration-700", isAtLimit ? "bg-red-500" : isNearLimit ? "bg-yellow-500" : "bg-green-500")}
              style={{ width: `${spendPercent}%` }}
            />
          </div>
          <p className="text-xs mt-1.5 text-slate-500">
            {isAtLimit ? "ZK proof required for all payments." : `$${Math.max(0, DAILY_LIMIT - dailySpend).toLocaleString()} remaining before KYC threshold`}
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
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
              min={1}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Recipient</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Actions */}
        {status !== "requires_kyc" && (
          <button
            onClick={requestPayment}
            disabled={status === "pending" || status === "proving"}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {status === "pending" ? "Processing…" : "Send Payment"}
          </button>
        )}

        {status === "requires_kyc" && (
          <div className="space-y-3">
            <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4">
              <p className="text-yellow-400 text-xs font-semibold mb-1">KYC Threshold Reached</p>
              <p className="text-slate-300 text-xs leading-relaxed">{message}</p>
            </div>
            <button
              onClick={proveAndPay}
              disabled={isGeneratingProof}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {isGeneratingProof ? (
                <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Generating ZK Proof…</>
              ) : (
                <>Prove Identity (ZK) &amp; Pay</>
              )}
            </button>
            <button
              onClick={() => { setStatus("idle"); setPendingPayment(null); setMessage(""); }}
              className="w-full border border-white/10 text-slate-400 py-2 rounded-xl text-sm hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {message && status !== "requires_kyc" && (
          <div className={clsx("rounded-xl p-3 text-xs leading-relaxed",
            status === "approved" ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : status === "proving" ? "bg-purple-500/10 border border-purple-500/20 text-purple-300"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
          )}>
            {status === "proving" && <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse mr-2" />}
            {message}
            {txId && <span className="block mt-1 text-slate-500 font-mono">tx: {txId}</span>}
          </div>
        )}
      </div>

      {/* Right: policy + log */}
      <div className="space-y-4">
        {/* Policy cards */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Active Policy</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
              <div className="w-2 h-2 rounded-full bg-green-400 mt-1 shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">&lt; $1,000 / day</p>
                <p className="text-xs text-slate-400 mt-0.5">Anonymous — no identity data collected or stored.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
              <div className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">&ge; $1,000 / day</p>
                <p className="text-xs text-slate-400 mt-0.5">ZK proof required. Verifies identity without revealing it.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tx log */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Transaction Log</h3>
          {transactions.length === 0 ? (
            <p className="text-xs text-slate-600">No transactions yet — try sending a payment.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", tx.proofUsed ? "bg-purple-400" : "bg-green-400")} />
                    <span className="text-white font-mono">${tx.amount.toLocaleString()}</span>
                    <span className="text-slate-500">→ {tx.recipient.slice(0, 8)}…</span>
                    {tx.proofUsed && <span className="text-purple-400 font-medium">ZK</span>}
                  </div>
                  <span className="text-slate-500">{tx.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
