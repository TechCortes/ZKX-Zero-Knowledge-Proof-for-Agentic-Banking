import ClientDemoWidget from "@/components/ClientDemoWidget";
import { LogoWordmark, LogoIcon } from "@/components/Logo";
import { ZKXFacilitator } from "@/components/ZKXFacilitator";

const zkxPrinciples = [
  {
    num: "01",
    title: "Proof-first",
    body: "Agents never reveal identity. They prove facts about it. A Groth16 proof certifies credential validity without transmitting any underlying data — to anyone.",
  },
  {
    num: "02",
    title: "No PII calls",
    body: "No HTTP forms. No document uploads. No third-party data brokers. No retention database. If there is no PII, there is nothing to breach.",
  },
  {
    num: "03",
    title: "Self-sovereign compliance",
    body: "Your identity commitment lives in your wallet, not in a KYC vendor's silo. The circuit runs locally. The proof is yours.",
  },
  {
    num: "04",
    title: "Policy composable",
    body: "Integrates natively with the Open Wallet Standard policy engine via the zkx:kyc feature extension. Same wallet, same security model, compliance included.",
  },
  {
    num: "05",
    title: "Zero-trust identity",
    body: "Verifiers trust the math, not the data. The Poseidon commitment is the only anchor. Private inputs never cross the verification boundary — ever.",
  },
  {
    num: "06",
    title: "FATF-compatible",
    body: "Designed around global AML thresholds, not despite them. The $1,000 daily limit follows FATF Recommendation 16. Compliance is the product, not a checkbox.",
  },
];

const steps = [
  {
    step: "01",
    title: "Agent submits payment",
    description: "An autonomous agent calls POST /api/v1/payment with amount, recipient, and its OWS-issued bearer token. No identity data sent at entry.",
    tag: "API call",
    color: "blue",
  },
  {
    step: "02",
    title: "Policy evaluation",
    description: "The ZKX compliance engine evaluates cumulative daily spend against the configured FATF threshold — sub-10ms, no network calls, no external APIs.",
    tag: "< 10ms",
    color: "slate",
  },
  {
    step: "03",
    title: "ZK proof generated locally",
    description: "Above the threshold, the agent runs the kyc_credential circom circuit on-device. Private inputs never leave the execution environment. Zero bytes of PII transmitted.",
    tag: "Groth16",
    color: "purple",
  },
  {
    step: "04",
    title: "Settlement — identity not required",
    description: "The verifier confirms proof validity without learning identity. Payment settles. Compliance is logged cryptographically. No PII retained anywhere in the stack.",
    tag: "Settled",
    color: "green",
  },
];

const protocolStack = [
  { name: "circom 2.0",           description: "ZK circuit compiler — defines the kyc_credential constraint system",       tag: "Circuit"   },
  { name: "snarkjs",              description: "Groth16 prover and verifier — generates and checks the proof",              tag: "Proving"   },
  { name: "Poseidon",             description: "ZK-friendly hash — binds idHash + salt into a verifiable commitment",      tag: "Hash"      },
  { name: "BN128",                description: "Barreto-Naehrig elliptic curve — pairing-based proving system",            tag: "Curve"     },
  { name: "Open Wallet Standard", description: "zkx:kyc feature extension — OWS policy engine integration point",          tag: "Standard"  },
  { name: "CAIP-2",               description: "Chain-agnostic identifiers — multi-chain wallet address resolution",        tag: "Chains"    },
  { name: "x402",                 description: "HTTP payment protocol — ows pay request for API-native agentic payments",  tag: "Payments"  },
  { name: "Next.js 16",           description: "App Router with Turbopack — edge-ready API runtime",                       tag: "Runtime"   },
  { name: "FATF Rec. 16",         description: "Travel Rule compliance framework — $1,000 threshold design basis",         tag: "Regulatory"},
];

const owsCliCommands = [
  { cmd: "ows wallet create",  desc: "Create a local multi-chain vault — EVM, Solana, Bitcoin + 7 more" },
  { cmd: "ows fund deposit",   desc: "Fund agent wallet with USDC on any supported chain"               },
  { cmd: "ows pay request",    desc: "Make x402 payments to API-native endpoints — no card required"     },
  { cmd: "ows pay discover",   desc: "Discover x402-enabled services in the OWS ecosystem"               },
  { cmd: "ows key create",     desc: "Issue ows_key_ agent tokens with typed policy rules attached"      },
  { cmd: "ows policy create",  desc: "Register allowed_chains · expires_at · spending_limit rules"       },
];

const owsChains = [
  { name: "EVM",     networks: "Ethereum · Base · Polygon · Arbitrum", curve: "secp256k1" },
  { name: "Solana",  networks: "mainnet · devnet",                       curve: "Ed25519"   },
  { name: "Bitcoin", networks: "mainnet · testnet (BIP-84 bech32)",      curve: "secp256k1" },
  { name: "Cosmos",  networks: "cosmos · osmosis · +IBC chains",         curve: "secp256k1" },
  { name: "Sui",     networks: "mainnet · testnet",                       curve: "Ed25519"   },
  { name: "TON",     networks: "mainnet · testnet (v5r1)",                curve: "Ed25519"   },
];

const researchPartners = [
  {
    name: "Open Wallet Standard",
    role: "Wallet Infrastructure",
    detail: "The foundation — local key custody, AES-256-GCM encryption, CAIP-2 multi-chain support, and a pre-signing policy engine across 10 chain families.",
    tag: "v1.3.2",
    color: "green",
  },
];

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
          <LogoWordmark />
          <div className="flex items-center gap-3">
            <a
              href="https://openwallet.sh/"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              OWS ↗
            </a>
            <a
              href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
            <a
              href="#founder"
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Founder
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

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-900/10 rounded-full blur-3xl"/>
          <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-purple-900/8 rounded-full blur-3xl"/>
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-6">

            {/* Left — copy */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-300 font-medium mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>
                OWS Native · zkx:kyc · FATF-Compatible
              </div>

              <h1 className="text-5xl md:text-[5rem] font-black tracking-tighter leading-[0.92] mb-6">
                <span className="text-white">Zero-Knowledge</span>
                <br/>
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-purple-300 bg-clip-text text-transparent">
                  Agentic Banking
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-400 max-w-xl mb-3 leading-relaxed font-light mx-auto lg:mx-0">
                OWS gives every agent a wallet.{" "}
                <span className="text-slate-300 font-normal">ZKX gives every wallet compliance — without disclosing a single byte of identity data.</span>
              </p>

              <p className="text-sm text-slate-600 max-w-lg mb-8 leading-relaxed mx-auto lg:mx-0">
                Agents authenticate with scoped API tokens. Verifiers receive cryptographic proofs.
                Private inputs never cross the boundary — to anyone, ever.
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-8">
                <a
                  href="#demo"
                  className="px-7 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
                >
                  Try the Demo
                </a>
                <a
                  href="https://openwallet.sh/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-7 py-3 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
                >
                  Open Wallet Standard ↗
                </a>
              </div>

              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600">
                <span className="w-1 h-1 rounded-full bg-purple-500"/>
                Guided by <span className="text-purple-400 font-medium ml-1">Vera</span> — KYA facilitator
              </div>
            </div>

            {/* Right — Vera */}
            <div className="w-72 md:w-80 lg:w-96 shrink-0">
              <ZKXFacilitator/>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: "0 bytes",    label: "PII transmitted"   },
              { value: "< 10ms",     label: "Anonymous approval" },
              { value: "Groth16",    label: "ZK protocol"        },
              { value: "OWS native", label: "Wallet standard"    },
            ].map((s) => (
              <div key={s.label} className="bg-[#04040a] px-6 py-5 text-center">
                <p className="text-xl font-bold text-white mb-1 font-mono tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-600 uppercase tracking-[0.1em]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ THE COMPLIANCE GAP ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">The Problem</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 max-w-2xl">
              OWS solved key chaos.<br/>
              <span className="text-slate-500">The compliance gap remained.</span>
            </h2>
            <p className="text-slate-500 max-w-2xl text-sm leading-relaxed">
              The Open Wallet Standard unified how agents manage keys: one vault, one interface, AES-256-GCM encryption.
              But every agent wallet that touches financial rails still triggers a compliance question — and traditional KYC
              requires disclosing the very identity that self-custody wallets exist to protect.
            </p>
          </div>

          {/* Before / After split */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* Before */}
            <div className="bg-white/[0.02] border border-red-500/10 rounded-2xl p-6">
              <p className="text-xs font-semibold text-red-400/70 uppercase tracking-[0.15em] mb-5">Traditional KYC for agents</p>
              <div className="space-y-3 font-mono text-xs">
                {[
                  ["Collects",  "name, DOB, government ID"],
                  ["Stores",    "PII in vendor database"],
                  ["Requires",  "third-party identity broker"],
                  ["Exposes",   "single point of breach"],
                  ["Violates",  "self-custody principles"],
                ].map(([label, val]) => (
                  <div key={label} className="flex gap-3">
                    <span className="text-red-500/50 shrink-0 w-16">{label}</span>
                    <span className="text-slate-600 line-through decoration-red-500/25">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After */}
            <div className="bg-white/[0.02] border border-purple-500/10 rounded-2xl p-6">
              <p className="text-xs font-semibold text-purple-400/70 uppercase tracking-[0.15em] mb-5">ZKX · Know Your Agent</p>
              <div className="space-y-3 font-mono text-xs">
                {[
                  ["Collects",  "nothing"],
                  ["Stores",    "Poseidon commitment only"],
                  ["Requires",  "Groth16 proof — generated locally"],
                  ["Exposes",   "no data — math is the anchor"],
                  ["Extends",   "OWS zkx:kyc natively"],
                ].map(([label, val]) => (
                  <div key={label} className="flex gap-3">
                    <span className="text-purple-500/50 shrink-0 w-16">{label}</span>
                    <span className="text-slate-300">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* OWS parallel pull-quote */}
          <div className="border border-white/[0.06] rounded-2xl p-6 grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-[0.15em] mb-3">Open Wallet Standard</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                <span className="text-slate-500 font-mono">&ldquo;</span>Agents never see plaintext keys.
                Instead, they authenticate with scoped API tokens.<span className="text-slate-500 font-mono">&rdquo;</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-500/60 uppercase tracking-[0.15em] mb-3">ZKX · Know Your Agent</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                <span className="text-purple-500/50 font-mono">&ldquo;</span>Compliance never sees plaintext identity.
                Instead, verifiers receive cryptographic proofs.<span className="text-purple-500/50 font-mono">&rdquo;</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SIX PRINCIPLES ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Design Principles</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Six principles that make ZKX different.
            </h2>
            <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
              Modeled after the Open Wallet Standard&apos;s ethos — no new primitives, existing standards implemented in a compliance-native way.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zkxPrinciples.map((p) => (
              <div key={p.num} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                <p className="text-xs font-mono font-bold text-white/15 mb-3">{p.num}</p>
                <h3 className="text-white font-semibold text-sm mb-2">{p.title}</h3>
                <p className="text-slate-600 text-xs leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FOUNDER ═══════════════ */}
      <section id="founder" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Founder & Research</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Built at the intersection of civic identity and agentic finance.
            </h2>
            <p className="text-slate-500 text-sm max-w-2xl leading-relaxed">
              ZKX originated as a research project on zero-knowledge identity — extending prior work on civic digital credentials to autonomous agents and the Open Wallet Standard.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Founder card */}
            <div className="md:col-span-1 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-bold tracking-tight">JC</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Jorge Cortes</p>
                  <p className="text-slate-500 text-xs">Founder · ZKX · MiamiDadeDAO</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">
                Research at the intersection of zero-knowledge proofs, civic identity, and decentralized compliance infrastructure.
              </p>
              <div className="border-t border-white/[0.06] pt-4 mb-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-[0.12em] font-semibold mb-2">Prior work</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Founded the{" "}
                    <a href="https://miamiid.org/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">
                      Miami-Dade Community ID
                    </a>
                    {" "}— a zero-knowledge credential system for digital and community identity in Miami, built under the{" "}
                    <a href="https://linktr.ee/miamidadedao" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">
                      Greater Miami DAO
                    </a>
                    . ZKX extends that civic ZK work into agentic finance.
                  </p>
                </div>
                <a
                  href="https://crypto.news/zero-knowledge-cryptography-is-bigger-than-web3"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ZK cryptography is bigger than Web3 ↗
                </a>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["ZKX", "MiamiDadeDAO", "Community ID", "Groth16", "OWS", "FATF"].map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded border border-white/[0.08] text-slate-500 font-mono">{t}</span>
                ))}
              </div>
            </div>

            {/* Research partners */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
              {researchPartners.map((p) => (
                <div key={p.name} className={`bg-white/[0.02] border rounded-2xl p-5 transition-colors ${
                  p.color === "blue" ? "border-blue-500/10 hover:border-blue-500/20" :
                  "border-green-500/10 hover:border-green-500/20"
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className={`text-sm font-semibold ${p.color === "blue" ? "text-blue-300" : "text-green-300"}`}>
                      {p.name}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-mono shrink-0 ${
                      p.color === "blue"
                        ? "border-blue-500/20 bg-blue-500/5 text-blue-400"
                        : "border-green-500/20 bg-green-500/5 text-green-400"
                    }`}>{p.tag}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.1em] mb-2">{p.role}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{p.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ OWS INTEGRATION ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Open Wallet Standard</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built for OWS. Native by design.
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              OWS already defines a Policy Engine that evaluates spending limits, allowlists, and chain rules before any key is touched.
              ZKX extends that boundary with the <span className="font-mono text-purple-400">zkx:kyc</span> feature — compliance enforced at the same layer as key access, with the same zero-trust model.
            </p>
          </div>

          {/* Architecture stack */}
          <div className="bg-white/[0.015] border border-white/[0.06] rounded-3xl overflow-hidden mb-5">
            <div className="flex items-center gap-1.5 px-5 py-3 border-b border-white/[0.04]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"/>
              <span className="text-xs text-slate-700 ml-2 font-mono">zkx-ows-integration.ts</span>
            </div>

            {/* Visual stack */}
            <div className="p-6 space-y-2">
              {[
                { label: "Agent",            sub: "Claude · GPT · Custom · Polymarket",    color: "border-blue-500/20  text-blue-400",   bg: "bg-blue-500/5"    },
                { label: "OWS Interface",    sub: "MCP · SDK · CLI · REST",                color: "border-slate-500/20 text-slate-400",  bg: "bg-slate-500/5"   },
                { label: "OWS Policy Engine",sub: "Spending limits · Allowlists · Chains", color: "border-slate-500/15 text-slate-500",  bg: "bg-slate-500/4"   },
                { label: "ZKX · zkx:kyc",   sub: "FATF threshold · Groth16 verification", color: "border-purple-500/25 text-purple-400", bg: "bg-purple-500/8"  },
                { label: "Wallet Vault",     sub: "~/.ows/wallets/ · AES-256-GCM",         color: "border-slate-600/15 text-slate-600",  bg: "bg-[#04040a]"     },
              ].map((row, i) => (
                <div key={row.label}>
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${row.color} ${row.bg}`}>
                    <span className="text-sm font-semibold">{row.label}</span>
                    <span className="text-xs text-slate-600 font-mono">{row.sub}</span>
                  </div>
                  {i < 4 && (
                    <div className="flex justify-center py-1">
                      <span className="text-slate-700 text-xs font-mono">↓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* The boundary line */}
            <div className="mx-6 mb-6 mt-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-red-500/20"/>
                <span className="text-xs font-mono text-red-500/50 shrink-0">Keys never cross this boundary · Identity never crosses this boundary</span>
                <div className="flex-1 h-px bg-red-500/20"/>
              </div>
            </div>
          </div>

          {/* zkx:kyc feature registration */}
          <div className="bg-[#060610] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.04]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"/>
              <span className="text-xs text-slate-700 ml-2 font-mono">ows-wallet-features.ts</span>
            </div>
            <div className="p-5 font-mono text-xs leading-7">
              <div className="text-slate-700">{"// Register zkx:kyc as an OWS wallet feature"}</div>
              <div><span className="text-blue-400">const</span> wallet = <span className="text-yellow-400">await</span> ows.<span className="text-green-400">load</span>(<span className="text-orange-300">&apos;agent-treasury&apos;</span>);</div>
              <div className="mt-1"/>
              <div><span className="text-blue-400">wallet</span>.<span className="text-green-400">registerFeature</span>{"({"}</div>
              <div className="pl-6"><span className="text-purple-400">name</span>: <span className="text-orange-300">&apos;zkx:kyc&apos;</span>,</div>
              <div className="pl-6"><span className="text-purple-400">version</span>: <span className="text-orange-300">&apos;1.0.0&apos;</span>,</div>
              <div className="pl-6"><span className="text-purple-400">commitment</span>: <span className="text-green-400">poseidon</span>([idHash, salt]),</div>
              <div className="pl-6"><span className="text-purple-400">threshold</span>: <span className="text-white">1000</span>, <span className="text-slate-700">{"// USD, FATF Rec. 16"}</span></div>
              <div className="pl-6"><span className="text-purple-400">circuit</span>: <span className="text-orange-300">&apos;kyc_credential.circom&apos;</span>,</div>
              <div>{"});"}</div>
              <div className="mt-2 text-slate-700">{"// zkx:kyc is now enforced by the OWS policy engine"}</div>
              <div className="text-green-400">{"// ✓ Compliant by default. Private by design."}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ OWS ECOSYSTEM ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">OWS Ecosystem</p>
            <h2 className="text-2xl font-bold text-white mb-2">One interface. Ten chains. Every agent.</h2>
            <p className="text-slate-600 text-sm max-w-xl leading-relaxed">
              OWS gives every agent local key custody, multi-chain signing, and a pre-signing policy engine out of the box.
              ZKX adds the compliance layer to the same stack — no new primitives, no new infrastructure.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* CLI commands */}
            <div className="bg-[#060610] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.04]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"/>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"/>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"/>
                <span className="text-xs text-slate-700 ml-2 font-mono">ows — CLI reference</span>
              </div>
              <div className="p-5 space-y-4">
                {owsCliCommands.map((c) => (
                  <div key={c.cmd} className="flex items-start gap-3">
                    <span className="text-white/20 font-mono text-xs shrink-0 mt-0.5 select-none">$</span>
                    <div>
                      <p className="text-green-400 font-mono text-xs">{c.cmd}</p>
                      <p className="text-slate-700 text-xs mt-0.5 leading-relaxed">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chain support */}
            <div className="flex flex-col gap-3">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden flex-1">
                <div className="px-5 py-3.5 border-b border-white/[0.04]">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em]">Supported Chains · OWS v1.3.2</p>
                </div>
                <div className="divide-y divide-white/[0.03]">
                  {owsChains.map((c) => (
                    <div key={c.name} className="flex items-center justify-between px-5 py-2.5">
                      <div>
                        <p className="text-white text-xs font-semibold">{c.name}</p>
                        <p className="text-slate-700 text-xs font-mono mt-0.5">{c.networks}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded border border-white/[0.06] text-slate-600 font-mono shrink-0 ml-3">{c.curve}</span>
                    </div>
                  ))}
                  <div className="px-5 py-2.5 text-xs text-slate-800 font-mono">+ Tron · XRPL · Filecoin · Spark</div>
                </div>
              </div>

              {/* x402 callout */}
              <div className="bg-purple-500/[0.04] border border-purple-500/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"/>
                  <p className="text-purple-400 text-xs font-semibold">x402 · HTTP Payments</p>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-mono">ows pay request</p>
                <p className="text-slate-600 text-xs leading-relaxed mt-1">
                  Agents make payments directly to API endpoints — no exchange, no manual steps. OWS signs and broadcasts atomically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPLIANCE POLICY ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Compliance Policy</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Risk-tiered by design.
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
              Two tiers. One protocol. No PII — ever. Agents transact freely below the FATF threshold.
              Above it, they prove identity without revealing it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            {/* Tier 1 */}
            <div className="bg-white/[0.02] border border-green-500/10 rounded-2xl p-6 hover:border-green-500/20 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-green-400"/>
                <span className="text-xs font-semibold text-green-400 uppercase tracking-[0.15em]">Tier 1 — Anonymous</span>
              </div>
              <p className="text-4xl font-black text-white mb-1 tracking-tight">&lt; $1,000</p>
              <p className="text-sm text-slate-600 mb-6">cumulative per calendar day · FATF Rec. 16</p>
              <div className="space-y-2.5">
                {[
                  "No KYC — no identity data collected",
                  "No AML exposure — no reporting obligation",
                  "Sub-100ms approval — pure policy evaluation",
                  "OWS bearer token sufficient for auth",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <svg className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    <span className="text-sm text-slate-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier 2 */}
            <div className="bg-white/[0.02] border border-purple-500/10 rounded-2xl p-6 hover:border-purple-500/20 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-purple-400"/>
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-[0.15em]">Tier 2 — ZK Verified</span>
              </div>
              <p className="text-4xl font-black text-white mb-1 tracking-tight">≥ $1,000</p>
              <p className="text-sm text-slate-600 mb-6">cumulative per calendar day · FATF Rec. 16</p>
              <div className="space-y-2.5">
                {[
                  "Groth16 proof of identity — generated locally",
                  "Zero personal data transmitted — math only",
                  "Verifier learns: credential valid ✓",
                  "Verifier learns: age ≥ 18 ✓",
                  "Verifier learns: nothing else",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <svg className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    <span className="text-sm text-slate-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Never learned */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em] mb-4">What the verifier never learns — in either tier</p>
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

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="how-it-works" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Every payment, one of two paths.
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              ZKX sits at the compliance boundary of the OWS access layer. The decision is made before settlement —
              milliseconds for anonymous payments, ~2.5 seconds when the FATF threshold requires a proof.
            </p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-9 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"/>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {steps.map((step) => (
                <div key={step.step} className={`bg-white/[0.02] border rounded-2xl p-5 hover:bg-white/[0.04] transition-colors ${
                  step.color === "blue"   ? "border-blue-500/10 hover:border-blue-500/20"     :
                  step.color === "purple" ? "border-purple-500/10 hover:border-purple-500/20" :
                  step.color === "green"  ? "border-green-500/10 hover:border-green-500/20"   :
                  "border-white/[0.06] hover:border-white/10"
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-mono font-bold ${
                      step.color === "blue"   ? "text-blue-500/40"   :
                      step.color === "purple" ? "text-purple-500/40" :
                      step.color === "green"  ? "text-green-500/40"  :
                      "text-white/20"
                    }`}>{step.step}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      step.color === "blue"   ? "bg-blue-500/8 border-blue-500/20 text-blue-400"     :
                      step.color === "purple" ? "bg-purple-500/8 border-purple-500/20 text-purple-400" :
                      step.color === "green"  ? "bg-green-500/8 border-green-500/20 text-green-400"   :
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

      {/* ═══════════════ LIVE DEMO ═══════════════ */}
      <section id="demo" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Live Demo</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Compliance engine in action.</h2>
              <p className="text-slate-500 text-sm mt-2 max-w-md leading-relaxed">
                Send transfers as an autonomous agent. Cross the $1,000 daily threshold to trigger the Groth16 proof flow. No PII collected at any point.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-xs text-green-400 font-medium">Demo mode · No real funds</span>
            </div>
          </div>

          <div className="bg-white/[0.015] border border-white/[0.06] rounded-3xl p-5 md:p-6">
            <ClientDemoWidget/>
          </div>
        </div>
      </section>

      {/* ═══════════════ ARCHITECTURE ═══════════════ */}
      <section id="architecture" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">ZK Architecture</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Cryptographic proof, not disclosure.
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
              The <span className="font-mono text-slate-400">kyc_credential</span> circuit proves two statements simultaneously — credential validity and age eligibility — without revealing the underlying data to anyone, anywhere.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em] mb-4">What the verifier learns</p>
                <div className="space-y-4">
                  {[
                    { label: "Credential validity",  detail: "Poseidon(idHash, salt) == commitment" },
                    { label: "Age requirement met",  detail: "currentYear − birthYear ≥ minAge"      },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
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
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em] mb-4">What stays private — always</p>
                <div className="space-y-4">
                  {[
                    { label: "Identity hash", detail: "idHash — private input, never leaves device" },
                    { label: "Date of birth",  detail: "birthYear — private input, never leaves device" },
                    { label: "Salt / nonce",   detail: "salt — private input, never leaves device"      },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-red-400/50 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
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

            {/* Circuit */}
            <div className="bg-[#060610] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.04]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"/>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"/>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"/>
                <span className="text-xs text-slate-700 ml-2 font-mono">kyc_credential.circom</span>
              </div>
              <div className="p-5 font-mono text-xs leading-7 overflow-auto">
                <div className="text-slate-700">{"// ── private inputs ─────────────────────"}</div>
                <div><span className="text-blue-400">signal</span> <span className="text-yellow-400">private</span> input <span className="text-white">idHash</span>;</div>
                <div><span className="text-blue-400">signal</span> <span className="text-yellow-400">private</span> input <span className="text-white">birthYear</span>;</div>
                <div><span className="text-blue-400">signal</span> <span className="text-yellow-400">private</span> input <span className="text-white">salt</span>;</div>
                <div className="mt-2 text-slate-700">{"// ── public inputs ──────────────────────"}</div>
                <div><span className="text-blue-400">signal</span> input <span className="text-green-400">commitment</span>;</div>
                <div><span className="text-blue-400">signal</span> input <span className="text-green-400">currentYear</span>;</div>
                <div><span className="text-blue-400">signal</span> input <span className="text-green-400">minAge</span>;</div>
                <div className="mt-2 text-slate-700">{"// ── constraints ─ math is the anchor ──"}</div>
                <div><span className="text-purple-400">Poseidon</span>([idHash, salt]) <span className="text-slate-500">===</span> <span className="text-green-400">commitment</span>;</div>
                <div><span className="text-green-400">currentYear</span> - <span className="text-white">birthYear</span> <span className="text-slate-500">&gt;=</span> <span className="text-green-400">minAge</span>;</div>
                <div className="mt-4 text-slate-700">{"// ── what crosses the boundary ──────────"}</div>
                <div className="text-green-400">{"// ✓ proof · publicSignals · commitment"}</div>
                <div className="text-red-400/50">{"// ✗ idHash · birthYear · salt"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ PROTOCOL STACK ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-2">Protocol Stack</p>
            <h2 className="text-2xl font-bold text-white mb-2">No new primitives.</h2>
            <p className="text-slate-600 text-sm max-w-xl leading-relaxed">
              ZKX implements existing BIP, CAIP, and FATF standards in a ZK-native, agent-friendly way.
              Every component has a published spec — nothing proprietary, nothing invented here.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {protocolStack.map((tech) => (
              <div key={tech.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-white text-xs font-semibold font-mono leading-snug">{tech.name}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded border border-white/8 text-slate-600 font-medium shrink-0 ml-2">{tech.tag}</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">{tech.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ VISION CLOSE ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-[0.2em] mb-8">The mission</p>
          <blockquote className="text-2xl md:text-3xl font-bold text-white leading-snug mb-4">
            Every agent deserves a wallet.
            <br/>
            Every wallet deserves a standard.
            <br/>
            <span className="text-purple-400">Every standard deserves compliance.</span>
          </blockquote>
          <p className="text-slate-600 text-sm max-w-xl mx-auto leading-relaxed mb-10">
            The Open Wallet Standard unified key management. ZKX closes the compliance gap —
            adding identity verification to the stack without breaking the privacy-first principles
            that make agent wallets worth building.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#demo"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
            >
              Try the Live Demo
            </a>
            <a
              href="https://openwallet.sh/"
              target="_blank"
              rel="noreferrer"
              className="px-8 py-3 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white font-medium rounded-xl transition-colors text-sm"
            >
              Read the OWS Spec ↗
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="py-10 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={20} id="zkx-footer"/>
            <span>ZKX · Know Your Agent</span>
            <span className="text-slate-800">·</span>
            <span>zkx:kyc for Open Wallet Standard</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://openwallet.sh/" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">OWS Spec ↗</a>
            <a href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
