import ClientDemoWidget from "@/components/ClientDemoWidget";
import { LogoWordmark, LogoIcon } from "@/components/Logo";
import { VeroFacilitator } from "@/components/VeroFacilitator";

const zkxPrinciples = [
  {
    num: "01",
    title: "Proof-first",
    body: "Agents don't reveal who they are — they prove what's true about them. A cryptographic proof confirms a credential is valid without transmitting any of the underlying data, to you or anyone else.",
  },
  {
    num: "02",
    title: "No PII to protect",
    body: "No forms, no document uploads, no third-party data brokers, no database of personal records sitting on a server. If you never collect the data, there's nothing for a breach to expose.",
  },
  {
    num: "03",
    title: "Self-sovereign compliance",
    body: "The customer's identity stays in their own wallet, not in a KYC vendor's database. Verification runs on their device, and the resulting proof belongs to them — not to a third party you now have to trust and audit.",
  },
  {
    num: "04",
    title: "Fits your existing stack",
    body: "Integrates natively with the Open Wallet Standard (OWS) policy engine through a compliance extension called vero:kyc. Same wallet infrastructure, same security model — compliance comes with it, not bolted on after.",
  },
  {
    num: "05",
    title: "Zero-trust identity",
    body: "Your systems trust the math, not a data file. A one-way cryptographic fingerprint is the only thing that ever reaches your verifier — the private details behind it never leave the customer's device.",
  },
  {
    num: "06",
    title: "FATF-compatible",
    body: "Built around the AML thresholds regulators already use, not around them. The $1,000 daily limit follows FATF Recommendation 16 — the same travel-rule standard banks report against today.",
  },
];

const steps = [
  {
    step: "01",
    title: "Agent submits payment",
    description: "An autonomous agent initiates a payment using its wallet's secure token. No identity information is sent at this stage — just the transaction request itself.",
    tag: "API call",
    color: "blue",
  },
  {
    step: "02",
    title: "Policy evaluation",
    description: "Vero checks the agent's cumulative spend for the day against your compliance threshold — instantly, with no network call and no third-party lookup.",
    tag: "< 10ms",
    color: "slate",
  },
  {
    step: "03",
    title: "Proof generated on-device",
    description: "If the payment crosses the threshold, the agent generates a cryptographic proof of identity locally, on its own device. The underlying personal data never leaves that device — zero bytes of PII are transmitted.",
    tag: "Groth16",
    color: "purple",
  },
  {
    step: "04",
    title: "Settlement — no identity required",
    description: "Your system checks that the proof is valid without ever learning who the customer is. The payment settles, compliance is logged cryptographically, and no personal data is stored anywhere in the stack.",
    tag: "Settled",
    color: "green",
  },
];

const protocolStack = [
  { name: "circom 2.0",           description: "ZK circuit compiler — defines the kyc_credential constraint system",       tag: "Circuit"   },
  { name: "snarkjs",              description: "Groth16 prover and verifier — generates and checks the proof",              tag: "Proving"   },
  { name: "Poseidon",             description: "ZK-friendly hash — binds idHash + salt into a verifiable commitment",      tag: "Hash"      },
  { name: "BN128",                description: "Barreto-Naehrig elliptic curve — pairing-based proving system",            tag: "Curve"     },
  { name: "Open Wallet Standard", description: "vero:kyc feature extension — OWS policy engine integration point",          tag: "Standard"  },
  { name: "CAIP-2",               description: "Chain-agnostic identifiers — multi-chain wallet address resolution",        tag: "Chains"    },
  { name: "x402",                 description: "HTTP payment protocol (Coinbase/Cloudflare) — ows pay request for API-native agentic payments", tag: "Payments" },
  { name: "Agent Payments Protocol", description: "Google's agent-to-agent payment spec — OWS speaks it natively alongside x402",           tag: "Payments"  },
  { name: "MPP",                  description: "Machine Payments Protocol (Stripe/Tempo) — streaming micropayments for agent workloads",   tag: "Payments"  },
  { name: "MCP",                  description: "Model Context Protocol — OWS ships an MCP server, wallets attach as a native agent tool",  tag: "Integration"},
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

const owsContributors = [
  "MoonPay", "Circle", "PayPal", "Ripple", "OKX", "Solana Foundation",
  "Ethereum Foundation", "Base", "Polygon", "Arbitrum", "TON Foundation",
  "Filecoin Foundation", "LayerZero", "Dynamic", "Allium",
];

const researchPartners = [
  {
    name: "Open Wallet Standard",
    role: "Wallet Infrastructure",
    detail: "The foundation — local key custody, AES-256-GCM encryption, CAIP-2 multi-chain support, and a pre-signing policy engine across 10 chain families.",
    tag: "v1.4.2",
    color: "green",
  },
];

const neverLearnedItems = [
  "Name", "Date of birth", "Government ID", "Address",
  "Tax ID", "Account number", "IP address", "Agent wallet",
];

const forkIdeas = [
  {
    title: "Swap the threshold",
    body: "The $1,000 FATF Rec. 16 cutoff is one constant in the policy engine. Point it at your own risk model — per-jurisdiction limits, velocity checks, whatever your compliance team needs.",
  },
  {
    title: "Extend the circuit",
    body: "kyc_credential.circom proves two facts today: commitment validity and age. Add a new private input — jurisdiction, accreditation status, sanctions-list exclusion — and re-run the trusted setup.",
  },
  {
    title: "Bring your own chain",
    body: "The OWS wallet integration already speaks CAIP-2 across ten chain families. Point vero:kyc at the chain your agents actually settle on — no new primitives required.",
  },
  {
    title: "Replace the registry",
    body: "The /api/v1/agents onboarding API is a working reference, not a requirement. Swap it for your own agent identity system and keep the ZK verification boundary as-is.",
  },
];

type Status = "live" | "building" | "planned";

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  live:     { label: "Live",           cls: "bg-green-500/15 border-green-500/40 text-green-300" },
  building: { label: "Building today", cls: "bg-amber-500/15 border-amber-500/40 text-amber-300" },
  planned:  { label: "Planned",        cls: "bg-slate-500/15 border-slate-500/40 text-slate-300" },
};

function StatusBadge({ status }: { status: Status }) {
  const b = STATUS_BADGE[status];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${b.cls}`}>
      {b.label}
    </span>
  );
}

const sponsors: {
  name: string; initial: string; role: string; body: string; status: Status;
  card: string; mark: string; roleText: string;
}[] = [
  {
    name: "Dynamic",
    initial: "D",
    role: "Agent wallets",
    body: "Planned: a Dynamic-powered wallet that signs a payment only after Vero's compliance check approves it. No valid proof, no signature, above the reporting threshold. Not yet integrated.",
    status: "planned",
    card: "border-blue-500/25 bg-blue-500/[0.05] hover:border-blue-500/45",
    mark: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    roleText: "text-blue-400",
  },
  {
    name: "x402 + Base",
    initial: "x",
    role: "Micropayments · target rail",
    body: "Target payment rail: instant, low-cost USDC micropayments on Base using the x402 standard. Vero's compliance check works in front of this rail, or any other. Not yet integrated.",
    status: "planned",
    card: "border-indigo-500/25 bg-indigo-500/[0.05] hover:border-indigo-500/45",
    mark: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
    roleText: "text-indigo-400",
  },
  {
    name: "Filecoin",
    initial: "F",
    role: "Audit trail",
    body: "Planned: store proof receipts on decentralized storage for a tamper-proof, PII-free audit trail your regulators can independently verify. Today the audit log is a working reference implementation, not yet decentralized.",
    status: "planned",
    card: "border-cyan-500/25 bg-cyan-500/[0.05] hover:border-cyan-500/45",
    mark: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    roleText: "text-cyan-400",
  },
  {
    name: "Anchorage Digital",
    initial: "A",
    role: "Institutional settlement",
    body: "Planned: a settlement path through regulated, bank-grade custody. Not built yet.",
    status: "planned",
    card: "border-emerald-500/25 bg-emerald-500/[0.05] hover:border-emerald-500/45",
    mark: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    roleText: "text-emerald-400",
  },
];

const stackLayers: {
  layer: string; name: string; detail: string; status: Status;
  accent: string; bg: string; here: boolean;
}[] = [
  { layer: "Layer 1", name: "Dynamic",       detail: "Agent wallets and payment signing — planned",                     status: "planned",  accent: "border-blue-500/25 text-blue-300",       bg: "bg-blue-500/[0.06]",    here: false },
  { layer: "Layer 2", name: "x402 on Base",  detail: "Low-cost USDC micropayments — target rail",                       status: "planned",  accent: "border-indigo-500/25 text-indigo-300",   bg: "bg-indigo-500/[0.06]",  here: false },
  { layer: "Layer 3", name: "Vero Protocol", detail: "Compliance proof — FATF Rec. 16, live today",                     status: "live",     accent: "border-purple-500/50 text-purple-300",   bg: "bg-purple-500/[0.12]",  here: true  },
  { layer: "Layer 4", name: "Filecoin",      detail: "Tamper-proof, PII-free audit trail — planned",                    status: "planned",  accent: "border-cyan-500/25 text-cyan-300",       bg: "bg-cyan-500/[0.06]",    here: false },
  { layer: "Layer 5", name: "Anchorage",     detail: "Regulated institutional custody and settlement — planned",        status: "planned",  accent: "border-emerald-500/25 text-emerald-300", bg: "bg-emerald-500/[0.06]", here: false },
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
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg"
            >
              Founder
            </a>
            <a
              href="/register"
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors border border-purple-500/20 hover:border-purple-500/40 px-3 py-1.5 rounded-lg bg-purple-500/5 hover:bg-purple-500/10"
            >
              Register Agent
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
                OWS Native · vero:kyc · FATF-Compatible · MIT Licensed
              </div>

              <h1 className="text-5xl md:text-[5rem] font-black tracking-tighter leading-[0.92] mb-6">
                <span className="text-white">Zero-Knowledge</span>
                <br/>
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-purple-300 bg-clip-text text-transparent">
                  Agent Compliance
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-400 max-w-xl mb-3 leading-relaxed font-light mx-auto lg:mx-0">
                AI agents are starting to make payments on their own.{" "}
                <span className="text-slate-300 font-normal">Vero Protocol proves an agent is compliant — verified age, verified credential — without your systems ever touching the personal data behind it.</span>
              </p>

              <p className="text-sm text-slate-600 max-w-lg mb-8 leading-relaxed mx-auto lg:mx-0">
                No forms. No document uploads. No personal data stored on your servers or ours — every
                check is a cryptographic proof, not a data transfer. The full protocol — proof circuit,
                verifier, and wallet integration — is open source, so your security team can review it line by line.
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-8">
                <a
                  href="#demo"
                  className="px-7 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
                >
                  Try the Demo
                </a>
                <a
                  href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking/fork"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-7 py-3 border border-purple-500/20 hover:border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 hover:text-purple-200 font-semibold rounded-xl transition-colors text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Fork on GitHub
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
                Guided by <span className="text-purple-400 font-medium ml-1">Vera</span> — your Know-Your-Agent (KYA) facilitator
              </div>
            </div>

            {/* Right — Vera */}
            <div className="w-72 md:w-80 lg:w-96 shrink-0">
              <VeroFacilitator/>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: "0 bytes",    label: "Personal data ever transmitted" },
              { value: "< 10ms",     label: "Time to approve a compliant payment" },
              { value: "Groth16",    label: "Cryptographic proof system"     },
              { value: "OWS native", label: "Built on an open wallet standard" },
            ].map((s) => (
              <div key={s.label} className="bg-[#04040a] px-6 py-5 text-center">
                <p className="text-xl font-bold text-white mb-1 font-mono tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-600 uppercase tracking-[0.1em]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ BUILT WITH ═══════════════ */}
      <section id="built-with" className="py-16 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Ecosystem</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Where Vero fits in the agent payment stack.</h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              Vero&apos;s compliance layer is live today. The partner integrations below are labeled honestly — live, in progress, or planned — so you always know what&apos;s real.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sponsors.map((s) => (
              <div key={s.name} className={`rounded-2xl border p-6 md:p-7 transition-colors ${s.card}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-base font-black ${s.mark}`}>
                    {s.initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-white leading-tight">{s.name}</p>
                    <p className={`text-xs font-semibold uppercase tracking-[0.12em] mt-0.5 ${s.roleText}`}>{s.role}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          {/* OWS — deliberately smaller, listed last */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <span className="w-8 h-8 shrink-0 rounded-lg bg-white/[0.06] text-slate-300 text-[10px] font-black flex items-center justify-center">
              OWS
            </span>
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="text-slate-300 font-semibold">Open Wallet Standard</span> · Handles wallet key management. Vero adds a compliance layer on top of it, through a feature called{" "}
              <span className="font-mono text-purple-400">vero:kyc</span>.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ THE COMPLIANCE GAP ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">The Problem</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 max-w-2xl">
              OWS solved wallet key chaos.<br/>
              <span className="text-slate-500">The compliance gap remained.</span>
            </h2>
            <p className="text-slate-500 max-w-2xl text-sm leading-relaxed">
              The Open Wallet Standard solved how AI agents manage cryptographic keys: one secure vault, one interface,
              bank-grade encryption. But any agent wallet that touches the financial system still raises a compliance
              question — and traditional KYC solves it the wrong way, by forcing disclosure of the very identity
              a self-custody wallet exists to protect.
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
              <p className="text-xs font-semibold text-purple-400/70 uppercase tracking-[0.15em] mb-5">Vero Protocol · Zero-Knowledge Agent Compliance</p>
              <div className="space-y-3 font-mono text-xs">
                {[
                  ["Collects",  "nothing"],
                  ["Stores",    "a one-way cryptographic fingerprint only"],
                  ["Requires",  "a proof — generated on the customer's device"],
                  ["Exposes",   "no data — math is the anchor"],
                  ["Extends",   "works natively with OWS"],
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
              <p className="text-xs font-semibold text-purple-500/60 uppercase tracking-[0.15em] mb-3">Vero Protocol · Zero-Knowledge Agent Compliance</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                <span className="text-purple-500/50 font-mono">&ldquo;</span>Compliance never sees plaintext identity.
                Instead, verifiers receive cryptographic proofs.<span className="text-purple-500/50 font-mono">&rdquo;</span>
              </p>
            </div>
          </div>

          {/* Why now */}
          <div className="mt-5 grid grid-cols-3 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: "69,000+", label: "Active agents on x402" },
              { value: "165M+",   label: "Agent transactions" },
              { value: "$50M+",  label: "Cumulative volume" },
            ].map((s) => (
              <div key={s.label} className="bg-[#04040a] px-4 py-4 text-center">
                <p className="text-lg font-bold text-white font-mono tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-700 text-xs mt-3 text-center">
            x402 ecosystem totals as of April 2026, per Coinbase — since formalized as the Linux Foundation&apos;s
            x402 Foundation with Visa, Mastercard, Stripe, Google, and AWS as members. The gap isn&apos;t theoretical:
            agent-to-agent payments already move real volume with no Know-Your-Agent (KYA) standard and no AML framework attached.
          </p>
        </div>
      </section>

      {/* ═══════════════ SIX PRINCIPLES ═══════════════ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Design Principles</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Six principles that make Vero Protocol different.
            </h2>
            <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
              Built in the same spirit as the Open Wallet Standard: no new, unproven primitives — existing, audited standards, applied to compliance.
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
              Vero Protocol originated as a research project on zero-knowledge identity — extending prior work on civic digital credentials to autonomous agents and the Open Wallet Standard.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Founder card — expanded */}
            <div className="md:col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              {/* Header row */}
              <div className="flex items-start gap-4 mb-5">
                <img
                  src="/jorge-cortes.png"
                  alt="Jorge Cortes"
                  className="w-16 h-16 rounded-full object-cover object-top ring-2 ring-purple-500/30 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-semibold">Jorge Cortes</p>
                  <p className="text-slate-400 text-xs mt-0.5">Founder, Vero Protocol · Co-founder, MiamiDadeDAO</p>
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed">+15 years Innovation &amp; Tech Ecosystems · LinkedIn Top Voice Web3 &amp; Industry 4.0</p>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <a href="https://www.linkedin.com/in/jorgeandrescortes/" target="_blank" rel="noreferrer"
                       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">LinkedIn ↗</a>
                    <a href="https://x.com/realTechCortes" target="_blank" rel="noreferrer"
                       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">X ↗</a>
                    <a href="https://techcortes.substack.com" target="_blank" rel="noreferrer"
                       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Substack ↗</a>
                    <a href="https://github.com/TechCortes" target="_blank" rel="noreferrer"
                       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">GitHub ↗</a>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5 border-t border-white/[0.06] pt-5">
                {/* Roles & Affiliations */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-[0.12em] font-semibold mb-3">Roles &amp; Affiliations</p>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 text-xs mt-0.5 shrink-0">▸</span>
                      <span className="text-slate-400 text-xs leading-relaxed">
                        Co-founder,{" "}
                        <a href="https://linktr.ee/miamidadedao" target="_blank" rel="noreferrer"
                           className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">MiamiDadeDAO</a>
                        {" "}— civic digital credentials and community identity in South Florida
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 text-xs mt-0.5 shrink-0">▸</span>
                      <span className="text-slate-400 text-xs leading-relaxed">
                        Advisor,{" "}
                        <a href="https://www.ufblockchain.org/" target="_blank" rel="noreferrer"
                           className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">University of Florida Blockchain Lab</a>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 text-xs mt-0.5 shrink-0">▸</span>
                      <span className="text-slate-400 text-xs leading-relaxed">
                        <a href="https://www.nobeldao.com/" target="_blank" rel="noreferrer"
                           className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">Nobel DAO</a>
                        {" "}— decentralized coordination and regenerative finance
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 text-xs mt-0.5 shrink-0">▸</span>
                      <span className="text-slate-400 text-xs leading-relaxed">
                        <a href="https://ldacap.com/" target="_blank" rel="noreferrer"
                           className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">LDA Capital</a>
                        {" "}— Digital Assets Portfolio
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Prior work + Media */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.12em] font-semibold mb-2">Prior Work</p>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Founded the{" "}
                      <a href="https://miamiid.org/" target="_blank" rel="noreferrer"
                         className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">Miami-Dade Community ID</a>
                      {" "}— a zero-knowledge credential system for digital and civic identity in Miami. Vero Protocol extends that work into agentic finance and cross-chain compliance.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.12em] font-semibold mb-2">Media</p>
                    <ul className="space-y-1.5">
                      <li>
                        <a href="https://www.coindesk.com/tv/community-crypto/community-crypto-june-3-2021-20210528"
                           target="_blank" rel="noreferrer"
                           className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                          CoinDesk · Community Crypto ↗
                        </a>
                      </li>
                      <li>
                        <a href="https://www.cnbc.com/2021/06/24/why-titan-crypto-crash-that-burned-mark-cuban-may-not-signal-similar-bitcoin-plunge.html"
                           target="_blank" rel="noreferrer"
                           className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                          CNBC · Crypto Markets Commentary ↗
                        </a>
                      </li>
                      <li>
                        <a href="https://www.youtube.com/watch?v=pcQfAj55C10"
                           target="_blank" rel="noreferrer"
                           className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                          CNN en Español · Web3 &amp; Digital Assets ↗
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-white/[0.06]">
                {["Vero Protocol", "MiamiDadeDAO", "Community ID", "Groth16", "OWS", "FATF", "ReFi", "Web3"].map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded border border-white/[0.08] text-slate-500 font-mono">{t}</span>
                ))}
              </div>
            </div>

            {/* Research partners */}
            <div className="md:col-span-1 grid grid-cols-1 gap-4 content-start">
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

      {/* ═══════════════ COMPLETE STACK ═══════════════ */}
      <section id="stack" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Reference Architecture</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              The Compliant Agent Payment Stack
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              From an autonomous wallet to regulated settlement, Vero Protocol is the compliance layer in between.
              The middle layer is live today; the layers around it are integration targets, each labeled by its real status.
            </p>
          </div>

          <div className="bg-white/[0.015] border border-white/[0.06] rounded-3xl overflow-hidden mb-5">
            <div className="p-6 space-y-2">
              {stackLayers.map((row, i) => (
                <div key={row.name}>
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 px-4 py-3.5 rounded-xl border ${row.accent} ${row.bg}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600 shrink-0">{row.layer}</span>
                      <span className="text-sm font-semibold">{row.name}</span>
                      <StatusBadge status={row.status} />
                      {row.here && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200">
                          ← You are here
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 sm:text-right">{row.detail}</span>
                  </div>
                  {i < stackLayers.length - 1 && (
                    <div className="flex justify-center py-1">
                      <span className="text-slate-700 text-xs font-mono">↓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* vero:kyc feature registration */}
          <div className="bg-[#060610] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.04]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"/>
              <span className="text-xs text-slate-700 ml-2 font-mono">illustrative sketch · real types in src/wallet/ows-wallet.ts</span>
            </div>
            <div className="p-5 font-mono text-xs leading-7">
              <div className="text-slate-700">{"// Illustrative: how vero:kyc plugs into an OWS wallet"}</div>
              <div><span className="text-blue-400">const</span> wallet = <span className="text-yellow-400">await</span> ows.<span className="text-green-400">load</span>(<span className="text-orange-300">&apos;agent-treasury&apos;</span>);</div>
              <div className="mt-1"/>
              <div><span className="text-blue-400">wallet</span>.<span className="text-green-400">registerFeature</span>{"({"}</div>
              <div className="pl-6"><span className="text-purple-400">name</span>: <span className="text-orange-300">&apos;vero:kyc&apos;</span>,</div>
              <div className="pl-6"><span className="text-purple-400">version</span>: <span className="text-orange-300">&apos;1.0.0&apos;</span>,</div>
              <div className="pl-6"><span className="text-purple-400">commitment</span>: <span className="text-green-400">poseidon</span>([idHash, salt]),</div>
              <div className="pl-6"><span className="text-purple-400">threshold</span>: <span className="text-white">1000</span>, <span className="text-slate-700">{"// USD, FATF Rec. 16"}</span></div>
              <div className="pl-6"><span className="text-purple-400">circuit</span>: <span className="text-orange-300">&apos;kyc_credential.circom&apos;</span>,</div>
              <div>{"});"}</div>
              <div className="mt-2 text-slate-700">{"// vero:kyc is now enforced by the OWS policy engine"}</div>
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
            <h2 className="text-2xl font-bold text-white mb-2">One interface. Ten chains. Every agent framework.</h2>
            <p className="text-slate-600 text-sm max-w-xl leading-relaxed">
              OWS gives every agent secure key storage, multi-chain signing, and a policy engine that checks rules before a
              transaction is signed — available as a CLI, an SDK, <span className="text-slate-400">and a plug-in for AI agent frameworks</span>.
              Any agent framework (LangChain, AutoGPT, custom tool-callers) can attach an OWS wallet as a tool, with no custom
              wallet code required. Vero Protocol adds the compliance layer to that same stack — no new infrastructure to run, no new formats to learn.
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
              <div className="mx-5 mb-5 flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.04]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"/>
                <p className="text-blue-300 text-xs">Same wallet, exposed as an <span className="font-mono">MCP server</span> for agent frameworks</p>
              </div>
            </div>

            {/* Chain support */}
            <div className="flex flex-col gap-3">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden flex-1">
                <div className="px-5 py-3.5 border-b border-white/[0.04]">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em]">Supported Chains · OWS v1.4.2</p>
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
                  Agents pay for API access directly and automatically — no exchange account, no manual approval step.
                </p>
              </div>

              {/* APP / MPP callout */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"/>
                  <p className="text-slate-300 text-xs font-semibold">+ Agent Payments Protocol · MPP</p>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  OWS isn&apos;t locked to one payment rail — it also supports Google&apos;s Agent Payments Protocol and
                  Stripe/Tempo&apos;s Machine Payments Protocol for streaming micropayments. Vero Protocol&apos;s compliance check works in front of all three.
                </p>
              </div>
            </div>
          </div>

          {/* Backed by */}
          <div className="mt-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.15em] mb-3">
              OWS · originated by MoonPay, built with 15+ contributing organizations
            </p>
            <div className="flex flex-wrap gap-2">
              {owsContributors.map((org) => (
                <span key={org} className="text-xs px-2.5 py-1 rounded-md border border-white/[0.08] text-slate-500 font-mono">
                  {org}
                </span>
              ))}
              <span className="text-xs px-2.5 py-1 text-slate-700">+ more</span>
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
              Two tiers, one protocol, no personal data — ever. Below the FATF threshold, agents transact freely.
              Above it, they prove who they are without revealing who they are.
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
              Vero sits at the compliance checkpoint before a payment settles. Under the threshold, the decision
              takes milliseconds. Above it, generating and checking a proof takes about 2.5 seconds — still faster than a manual compliance review.
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
                Send transfers as an autonomous agent and watch what happens when you cross the $1,000 daily threshold — the proof flow triggers automatically. No personal data is collected at any point.
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
              A single proof establishes two facts at once — that the credential is valid, and that the holder meets the age requirement — without revealing the underlying data to anyone, anywhere.
              (Under the hood: the <span className="font-mono text-slate-400">kyc_credential</span> circuit.)
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
              Vero doesn&apos;t invent new cryptographic or compliance standards — it applies existing, published
              ones (BIP, CAIP, FATF) in a way that works natively for AI agents. Every component has a public spec your security team can review.
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
            The Open Wallet Standard unified wallet key management. Vero Protocol closes the compliance gap —
            adding identity verification to the stack without breaking the privacy-first principles
            that make agent wallets worth trusting.
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

      {/* ═══════════════ BUILD ON Vero Protocol ═══════════════ */}
      <section id="build" className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-[0.2em] mb-3">Open Source · MIT Licensed</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              This isn&apos;t a mockup. Fork it.
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm leading-relaxed">
              Everything described on this page is real and working in the repository — a completed cryptographic
              proof circuit, a live agent onboarding API, OWS wallet-standard integration, and the registration
              flow you just tried in the demo. Clone it and you have a working compliance stack on day one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {forkIdeas.map((idea) => (
              <div key={idea.title} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:border-purple-500/20 hover:bg-white/[0.04] transition-all">
                <h3 className="text-white font-semibold text-sm mb-2">{idea.title}</h3>
                <p className="text-slate-600 text-xs leading-relaxed">{idea.body}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#060610] rounded-2xl border border-white/[0.06] overflow-hidden mb-6">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.04]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"/>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40"/>
              <span className="text-xs text-slate-700 ml-2 font-mono">terminal</span>
            </div>
            <div className="p-5 font-mono text-xs leading-7">
              <div><span className="text-white/20 mr-2">$</span><span className="text-green-400">git clone</span> <span className="text-slate-300">https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking</span></div>
              <div><span className="text-white/20 mr-2">$</span><span className="text-green-400">cd</span> <span className="text-slate-300">ZKX-Zero-Knowledge-Proof-for-Agentic-Banking</span></div>
              <div><span className="text-white/20 mr-2">$</span><span className="text-green-400">npm install</span> <span className="text-slate-500">&amp;&amp;</span> <span className="text-green-400">npm run dev</span></div>
            </div>
          </div>

          <div className="flex justify-center">
            <a
              href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking/fork"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-purple-900/30"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              Fork on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="py-10 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={20} id="zkx-footer"/>
            <span>Vero Protocol · Zero-Knowledge Agent Compliance</span>
            <span className="text-slate-800">·</span>
            <span>vero:kyc for Open Wallet Standard</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://openwallet.sh/" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">OWS Spec ↗</a>
            <a href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking/fork" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">Fork</a>
            <a href="https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">Star ↗</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
