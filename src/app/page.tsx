import DemoWidget from "@/components/DemoWidget";

const steps = [
  {
    number: "01",
    color: "green",
    title: "Anonymous micropayment",
    description: "Agent initiates a payment under the daily threshold. No identity required. No data collected. Fully private by default.",
    badge: "< $1,000 / day",
    badgeColor: "green",
  },
  {
    number: "02",
    color: "yellow",
    title: "Real-time threshold check",
    description: "The ZKX compliance engine — an Open Wallet Standard middleware — evaluates cumulative daily spend in real time against the policy.",
    badge: "Policy engine",
    badgeColor: "yellow",
  },
  {
    number: "03",
    color: "purple",
    title: "Zero-knowledge identity proof",
    description: "Above the limit, the agent generates a Groth16 proof in-browser. The verifier learns the credential is valid — nothing more.",
    badge: "≥ $1,000 / day",
    badgeColor: "purple",
  },
];

const stats = [
  { value: "0 bytes", label: "PII transmitted" },
  { value: "~2.5s", label: "Proof generation" },
  { value: "Groth16", label: "ZK protocol" },
  { value: "OWS native", label: "Wallet standard" },
];

const techStack = [
  { name: "circom", description: "ZK circuit language", icon: "◈" },
  { name: "snarkjs", description: "Groth16 prover / verifier", icon: "⚡" },
  { name: "Open Wallet Standard", description: "zkx:kyc feature extension", icon: "⬡" },
  { name: "Poseidon hash", description: "ZK-friendly commitment", icon: "∿" },
  { name: "Next.js 16", description: "App + API routes", icon: "▲" },
  { name: "BN128 curve", description: "Elliptic curve cryptography", icon: "∞" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070710] text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#070710]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-black tracking-tight">ZX</div>
            <span className="font-bold tracking-tight">ZKX</span>
            <span className="hidden sm:block text-xs text-slate-600 border-l border-white/10 pl-2.5 ml-0.5">Agentic Finance Compliance</span>
          </div>
          <a
            href="https://github.com/TechCortes/ZKX"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            TechCortes/ZKX
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-700/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-blue-700/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-purple-500/25 bg-purple-500/8 text-purple-300 mb-8 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Open Wallet Standard · zkx:kyc
          </div>

          <h1 className="text-5xl md:text-[4.5rem] font-black tracking-tighter mb-5 leading-[0.95]">
            <span className="text-white">ZK-KYC</span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-blue-400 bg-clip-text text-transparent">
              for Agents
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Privacy &amp; Institutional-Grade Zero Knowledge Proofs
            <br className="hidden md:block" /> for Agentic Banking
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <a
              href="#demo"
              className="px-7 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-purple-900/30"
            >
              Try the Demo
            </a>
            <a
              href="#how-it-works"
              className="px-7 py-3 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
            >
              How it works
            </a>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/8">
            {stats.map((s) => (
              <div key={s.label} className="bg-[#070710] px-6 py-4 text-center">
                <p className="text-lg font-bold text-white mb-0.5">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Compliance that scales with risk
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              ZKX acts as a middleware layer in the payment stack. Low-value flows stay fully private. High-value flows require proof — not disclosure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-5 -ml-2.5 z-10">
                    <svg viewBox="0 0 20 8" className="w-full opacity-30" fill="none">
                      <path d="M0 4h16M12 1l4 3-4 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-colors h-full">
                  <div className="flex items-start justify-between mb-5">
                    <span className={`text-4xl font-black leading-none ${
                      step.color === "green" ? "text-green-500/20"
                      : step.color === "yellow" ? "text-yellow-500/20"
                      : "text-purple-500/20"
                    }`}>
                      {step.number}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      step.badgeColor === "green" ? "bg-green-500/8 border-green-500/20 text-green-400"
                      : step.badgeColor === "yellow" ? "bg-yellow-500/8 border-yellow-500/20 text-yellow-400"
                      : "bg-purple-500/8 border-purple-500/20 text-purple-400"
                    }`}>
                      {step.badge}
                    </span>
                  </div>
                  <h3 className="text-white font-semibold mb-2 leading-snug">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Circuit detail */}
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-[0.2em] mb-3">The ZK Circuit</p>
                <h3 className="text-xl font-bold text-white mb-4">What the verifier learns</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    <span className="text-slate-300">The holder knows a preimage <code className="text-purple-300 text-xs bg-purple-500/10 px-1 py-0.5 rounded">(idHash, salt)</code> that maps to a registered <code className="text-purple-300 text-xs bg-purple-500/10 px-1 py-0.5 rounded">commitment</code></span>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    <span className="text-slate-300">Age satisfies <code className="text-purple-300 text-xs bg-purple-500/10 px-1 py-0.5 rounded">currentYear − birthYear ≥ 18</code></span>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="text-red-500/60 mt-0.5 shrink-0">✗</span>
                    <span className="text-slate-600">Name, ID number, date of birth, or any PII</span>
                  </li>
                </ul>
              </div>
              <div className="bg-[#0a0a14] rounded-xl border border-white/5 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                  <span className="text-xs text-slate-600 ml-2 font-mono">kyc_credential.circom</span>
                </div>
                <div className="p-4 font-mono text-xs leading-6">
                  <div className="text-slate-600">{"// private inputs — never leave browser"}</div>
                  <div className="text-slate-400">signal <span className="text-yellow-400">private</span> input <span className="text-white">idHash</span>;</div>
                  <div className="text-slate-400">signal <span className="text-yellow-400">private</span> input <span className="text-white">birthYear</span>;</div>
                  <div className="text-slate-400">signal <span className="text-yellow-400">private</span> input <span className="text-white">salt</span>;</div>
                  <div className="mt-2 text-slate-600">{"// public inputs — visible to verifier"}</div>
                  <div className="text-slate-400">signal input <span className="text-green-400">commitment</span>;</div>
                  <div className="text-slate-400">signal input <span className="text-green-400">currentYear</span>;</div>
                  <div className="text-slate-400">signal input <span className="text-green-400">minAge</span>;</div>
                  <div className="mt-2 text-slate-600">{"// constraint: Poseidon(idHash, salt) == commitment"}</div>
                  <div className="text-slate-600">{"// constraint: currentYear - birthYear >= minAge"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-[0.2em] mb-3">Live demo</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Interactive compliance engine</h2>
            </div>
            <div className="text-sm text-slate-500 max-w-xs leading-relaxed">
              Select a scenario and send a payment. Exceed the daily threshold to trigger the ZK proof flow.
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/8 rounded-3xl p-5 md:p-8">
            <DemoWidget />
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-[0.2em] mb-3">Technology</p>
            <h2 className="text-3xl font-bold text-white">Built with</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="bg-white/[0.03] border border-white/8 rounded-xl p-4 text-center hover:border-purple-500/25 hover:bg-purple-500/4 transition-all group"
              >
                <div className="text-xl mb-2 opacity-60 group-hover:opacity-100 transition-opacity">{tech.icon}</div>
                <p className="text-white text-xs font-semibold mb-1">{tech.name}</p>
                <p className="text-slate-600 text-xs leading-tight">{tech.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-purple-600/50 flex items-center justify-center text-xs font-bold text-white">ZX</div>
            <span>ZKX — Built at a hackathon, April 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/TechCortes/ZKX" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">
              GitHub
            </a>
            <a href="https://github.com/open-wallet-standard/core" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">
              Open Wallet Standard
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
