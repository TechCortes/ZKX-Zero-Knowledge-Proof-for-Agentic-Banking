import ClientDemoWidget from "@/components/ClientDemoWidget";

const steps = [
  {
    step: "01",
    title: "Payment Request",
    description: "An autonomous agent submits a transfer with amount, recipient, and agent ID. No identity data required at entry.",
    tag: "API call",
    color: "blue",
  },
  {
    step: "02",
    title: "Policy Evaluation",
    description: "The ZKX compliance engine evaluates cumulative daily spend in real time against the configured threshold policy.",
    tag: "< 10ms",
    color: "slate",
  },
  {
    step: "03",
    title: "ZK Proof Generation",
    description: "Above the threshold, the agent generates a Groth16 proof locally. Private inputs never leave the execution environment.",
    tag: "Groth16",
    color: "purple",
  },
  {
    step: "04",
    title: "Settlement",
    description: "The verifier confirms proof validity without learning identity. Payment settles. Compliance is logged. No PII retained.",
    tag: "Settled",
    color: "green",
  },
];

const protocolStack = [
  { name: "circom 2.0", description: "ZK circuit compiler", tag: "Circuit" },
  { name: "snarkjs", description: "Groth16 prover / verifier", tag: "Proving" },
  { name: "Poseidon", description: "ZK-friendly hash function", tag: "Hash" },
  { name: "BN128", description: "Elliptic curve pairing", tag: "Curve" },
  { name: "Open Wallet Standard", description: "zkx:kyc feature extension", tag: "Standard" },
  { name: "Next.js 16", description: "Edge-ready runtime", tag: "Runtime" },
];

const trustBadges = ["FATF-Compatible", "OWS Native", "Groth16", "Zero PII"];

const neverLearnedItems = [
  "Name", "Date of birth", "Government ID", "Address",
  "Tax ID", "Account number", "IP address", "Agent wallet",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#04040a] text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.04] bg-[#04040a]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <span className="text-[9px] font-black text-white tracking-tighter">ZKX</span>
            </div>
            <span className="font-bold text-sm tracking-tight">ZKX</span>
            <span className="hidden md:block h-3.5 w-px bg-white/10" />
            <span className="hidden md:block text-xs text-slate-600">Agent Banking Infrastructure</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
            <a
              href="#demo"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Live Demo
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-900/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-purple-900/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Private Beta · Open Wallet Standard · zkx:kyc
            </div>
          </div>

          <h1 className="text-center text-5xl md:text-[5.5rem] font-black tracking-tighter leading-[0.92] mb-6">
            <span className="text-white">Zero-Knowledge</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-purple-300 bg-clip-text text-transparent">
              Agentic Banking
            </span>
          </h1>

          <p className="text-center text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-4 leading-relaxed font-light">
            Zero-knowledge compliance infrastructure for AI agents operating in financial markets.{" "}
            <span className="text-slate-300 font-normal">Compliant by default. Private by design.</span>
          </p>

          <div className="flex justify-center flex-wrap gap-2 mb-10">
            {trustBadges.map((badge) => (
              <span key={badge} className="text-xs px-2.5 py-1 rounded-md border border-white/8 bg-white/[0.03] text-slate-500 font-medium">
                {badge}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <a
              href="#demo"
              className="px-7 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
            >
              Try the Demo
            </a>
            <a
              href="#architecture"
              className="px-7 py-3 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
            >
              View Architecture
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: "0 bytes", label: "PII transmitted" },
              { value: "~2.5s", label: "Proof generation" },
              { value: "Groth16", label: "ZK protocol" },
              { value: "OWS native", label: "Wallet standard" },
            ].map((s) => (
              <div key={s.label} className="bg-[#04040a] px-6 py-5 text-center">
                <p className="text-xl font-bold text-white mb-1 font-mono tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-600 uppercase tracking-[0.1em]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Policy */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Compliance Policy</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Risk-tiered by design
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
              Two tiers. One protocol. No PII ever transmitted. Agents transact freely below the threshold — and prove identity without revealing it above.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div className="bg-white/[0.02] border border-green-500/10 rounded-2xl p-6 hover:border-green-500/20 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs font-semibold text-green-400 uppercase tracking-[0.15em]">Tier 1 — Anonymous</span>
              </div>
              <p className="text-4xl font-black text-white mb-1 tracking-tight">&lt; $1,000</p>
              <p className="text-sm text-slate-600 mb-6">per calendar day</p>
              <div className="space-y-2.5">
                {["No KYC required", "No identity data collected", "No AML exposure", "Sub-100ms approval"].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-purple-500/10 rounded-2xl p-6 hover:border-purple-500/20 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-[0.15em]">Tier 2 — ZK Verified</span>
              </div>
              <p className="text-4xl font-black text-white mb-1 tracking-tight">≥ $1,000</p>
              <p className="text-sm text-slate-600 mb-6">per calendar day</p>
              <div className="space-y-2.5">
                {[
                  "Groth16 proof of identity",
                  "Zero personal data transmitted",
                  "Verifier learns: credential valid",
                  "Verifier learns: age ≥ 18",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em] mb-4">What the verifier never learns</p>
            <div className="flex flex-wrap gap-2">
              {neverLearnedItems.map((item) => (
                <span key={item} className="text-xs px-2.5 py-1 rounded-md border border-red-500/10 bg-red-500/[0.04] text-slate-600 font-mono line-through decoration-red-500/30">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Every payment, one of two paths
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              ZKX sits as a middleware layer in the payment stack. The compliance decision is made before settlement — in milliseconds for anonymous payments, in ~2.5 seconds when a ZK proof is required.
            </p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-9 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {steps.map((step) => (
                <div key={step.step} className={`bg-white/[0.02] border rounded-2xl p-5 hover:bg-white/[0.04] transition-colors ${
                  step.color === "blue" ? "border-blue-500/10 hover:border-blue-500/20" :
                  step.color === "purple" ? "border-purple-500/10 hover:border-purple-500/20" :
                  step.color === "green" ? "border-green-500/10 hover:border-green-500/20" :
                  "border-white/[0.06] hover:border-white/10"
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-mono font-bold ${
                      step.color === "blue" ? "text-blue-500/40" :
                      step.color === "purple" ? "text-purple-500/40" :
                      step.color === "green" ? "text-green-500/40" :
                      "text-white/20"
                    }`}>{step.step}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      step.color === "blue" ? "bg-blue-500/8 border-blue-500/20 text-blue-400" :
                      step.color === "purple" ? "bg-purple-500/8 border-purple-500/20 text-purple-400" :
                      step.color === "green" ? "bg-green-500/8 border-green-500/20 text-green-400" :
                      "bg-white/5 border-white/10 text-slate-400"
                    }`}>{step.tag}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-2 leading-snug">{step.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Live Demo</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Compliance engine in action</h2>
              <p className="text-slate-500 text-sm mt-2 max-w-md leading-relaxed">
                Send transfers as an autonomous agent. Cross the $1,000 daily threshold to trigger the ZK proof flow.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Demo mode · No real funds</span>
            </div>
          </div>

          <div className="bg-white/[0.015] border border-white/[0.06] rounded-3xl p-5 md:p-6">
            <ClientDemoWidget />
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">ZK Architecture</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Cryptographic proof, not disclosure
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
              The kyc_credential circuit proves two statements simultaneously — without revealing the underlying data to anyone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em] mb-4">Verifier learns</p>
                <div className="space-y-4">
                  {[
                    { label: "Credential validity", detail: "Poseidon(idHash, salt) == commitment" },
                    { label: "Age requirement met", detail: "currentYear − birthYear ≥ 18" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-white font-medium">{item.label}</p>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em] mb-4">Verifier never learns</p>
                <div className="space-y-4">
                  {[
                    { label: "Identity hash", detail: "idHash — private input" },
                    { label: "Date of birth", detail: "birthYear — private input" },
                    { label: "Salt / nonce", detail: "salt — private input" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-red-400/50 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-slate-600">{item.label}</p>
                        <p className="text-xs text-slate-700 font-mono mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#060610] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.04]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                <span className="text-xs text-slate-700 ml-2 font-mono">kyc_credential.circom</span>
              </div>
              <div className="p-5 font-mono text-xs leading-7 overflow-auto">
                <div className="text-slate-700">{"// ── private inputs ─────────────────────"}</div>
                <div><span className="text-blue-400">signal</span> <span className="text-yellow-400">private</span> input <span className="text-white">idHash</span>;</div>
                <div><span className="text-blue-400">signal</span> <span className="text-yellow-400">private</span> input <span className="text-white">birthYear</span>;</div>
                <div><span className="text-blue-400">signal</span> <span className="text-yellow-400">private</span> input <span className="text-white">salt</span>;</div>
                <div className="mt-2 text-slate-700">{"// ── public inputs ──────────────────────"}</div>
                <div><span className="text-blue-400">signal</span> input <span className="text-green-400">commitment</span>;</div>
                <div><span className="text-blue-400">signal</span> <span className="text-green-400">input currentYear</span>;</div>
                <div><span className="text-blue-400">signal</span> input <span className="text-green-400">minAge</span>;</div>
                <div className="mt-2 text-slate-700">{"// ── constraints ────────────────────────"}</div>
                <div><span className="text-purple-400">Poseidon</span>([idHash, salt]) <span className="text-slate-500">===</span> <span className="text-green-400">commitment</span>;</div>
                <div><span className="text-green-400">currentYear</span> - <span className="text-white">birthYear</span> <span className="text-slate-500">&gt;=</span> <span className="text-green-400">minAge</span>;</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Protocol Stack */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-2">Protocol Stack</p>
            <h2 className="text-2xl font-bold text-white">Infrastructure</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {protocolStack.map((tech) => (
              <div key={tech.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-white text-sm font-semibold font-mono">{tech.name}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded border border-white/8 text-slate-600 font-medium shrink-0 ml-2">{tech.tag}</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">{tech.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-blue-600/60 flex items-center justify-center">
              <span className="text-[8px] font-black text-white">ZKX</span>
            </div>
            <span>ZKX · Agent Banking Infrastructure</span>
            <span className="text-slate-800">·</span>
            <span>Open Wallet Standard · zkx:kyc</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/open-wallet-standard/core"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              Open Wallet Standard
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
