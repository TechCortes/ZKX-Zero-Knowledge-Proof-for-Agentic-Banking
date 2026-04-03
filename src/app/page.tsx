import DemoWidget from "@/components/DemoWidget";

const steps = [
  {
    number: "01",
    color: "green",
    title: "Anonymous micropayment",
    description: "Agent sends a payment under the daily threshold. No identity required. No data collected. Fully private by default.",
    badge: "< $1,000 / day",
    badgeColor: "green",
  },
  {
    number: "02",
    color: "yellow",
    title: "Threshold check",
    description: "The ZKX policy engine — an Open Wallet Standard middleware — evaluates the agent's daily spend in real time.",
    badge: "Policy enforced",
    badgeColor: "yellow",
  },
  {
    number: "03",
    color: "purple",
    title: "ZK proof of identity",
    description: "Above the limit, the agent generates a Groth16 ZK proof in-browser. The verifier learns the identity is valid — nothing else.",
    badge: "≥ $1,000 / day",
    badgeColor: "purple",
  },
];

const techStack = [
  { name: "circom", description: "ZK circuit language", icon: "◈" },
  { name: "snarkjs", description: "Groth16 prover / verifier", icon: "⚡" },
  { name: "Open Wallet Standard", description: "zkx:kyc feature extension", icon: "⬡" },
  { name: "Poseidon hash", description: "ZK-friendly commitment scheme", icon: "∿" },
  { name: "Next.js 14", description: "App + API routes", icon: "▲" },
  { name: "Groth16", description: "Succinct non-interactive ZK", icon: "∞" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070710] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#070710]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-bold">ZX</div>
            <span className="font-bold tracking-tight">ZKX</span>
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
      <section className="pt-32 pb-20 px-6 text-center relative">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Built on Open Wallet Standard
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-none">
            <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
              ZK-KYC
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              for Agents
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Privacy &amp; Institutional-Grade Zero Knowledge Proofs for Agentic Banking
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#demo"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Try the Demo
            </a>
            <a
              href="#how-it-works"
              className="px-6 py-3 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors text-sm"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Compliance that scales with risk
            </h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
              The ZKX policy engine acts as an OWS middleware layer. Low-value flows stay private. High-value flows require proof — not disclosure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-px bg-gradient-to-r from-green-500/50 via-yellow-500/50 to-purple-500/50" />

            {steps.map((step) => (
              <div
                key={step.number}
                className="relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors backdrop-blur-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className={`text-3xl font-black ${
                    step.color === "green" ? "text-green-500/30"
                    : step.color === "yellow" ? "text-yellow-500/30"
                    : "text-purple-500/30"
                  }`}>
                    {step.number}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                    step.badgeColor === "green"
                      ? "bg-green-500/10 border-green-500/20 text-green-400"
                      : step.badgeColor === "yellow"
                      ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                      : "bg-purple-500/10 border-purple-500/20 text-purple-400"
                  }`}>
                    {step.badge}
                  </span>
                </div>
                <h3 className="text-white font-semibold mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>

          {/* ZK proof detail */}
          <div className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">The ZK Circuit</p>
                <h3 className="text-xl font-bold text-white mb-3">What the proof actually proves</h3>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    I know a secret <code className="text-purple-300 text-xs">(idHash, salt)</code> that hashes to a registered <code className="text-purple-300 text-xs">commitment</code>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    My age satisfies <code className="text-purple-300 text-xs">currentYear − birthYear ≥ 18</code>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">✗</span>
                    <span className="text-slate-500">My name, ID number, date of birth — never revealed</span>
                  </li>
                </ul>
              </div>
              <div className="bg-[#0a0a0f] rounded-xl p-4 font-mono text-xs leading-relaxed border border-white/5">
                <span className="text-slate-500">// kyc_credential.circom</span>
                <br />
                <span className="text-purple-400">template</span>{" "}
                <span className="text-white">KYCCredential</span>() &#123;
                <br />
                <span className="text-slate-500 ml-4">// private — stays in browser</span>
                <br />
                <span className="text-slate-400 ml-4">signal <span className="text-yellow-400">private</span> input idHash;</span>
                <br />
                <span className="text-slate-400 ml-4">signal <span className="text-yellow-400">private</span> input birthYear;</span>
                <br />
                <span className="text-slate-400 ml-4">signal <span className="text-yellow-400">private</span> input salt;</span>
                <br />
                <span className="text-slate-500 ml-4 mt-1">// public — seen by verifier</span>
                <br />
                <span className="text-slate-400 ml-4">signal input <span className="text-green-400">commitment</span>;</span>
                <br />
                <span className="text-slate-400 ml-4">signal input <span className="text-green-400">currentYear</span>;</span>
                <br />
                <span className="text-slate-400 ml-4">signal input <span className="text-green-400">minAge</span>;</span>
                <br />&#125;
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">Live demo</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Try it yourself</h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Send payments as an AI agent. Hit the $1,000 threshold to trigger the ZK KYC flow.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8">
            <DemoWidget />
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">Tech stack</p>
            <h2 className="text-3xl font-bold text-white">Built with</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
              >
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{tech.icon}</div>
                <p className="text-white text-xs font-semibold mb-1">{tech.name}</p>
                <p className="text-slate-500 text-xs leading-tight">{tech.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5 text-center text-xs text-slate-600">
        <p>
          ZKX — Built at a hackathon, April 2026 &middot;{" "}
          <a href="https://github.com/TechCortes/ZKX" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors underline">
            TechCortes/ZKX
          </a>
          {" "}&middot;{" "}
          <a href="https://github.com/open-wallet-standard/core" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors underline">
            Open Wallet Standard
          </a>
        </p>
      </footer>
    </div>
  );
}
