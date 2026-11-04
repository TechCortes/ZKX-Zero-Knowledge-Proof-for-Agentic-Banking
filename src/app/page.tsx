import ClientDemoWidget from "@/components/ClientDemoWidget";
import { LogoIcon } from "@/components/Logo";
import SiteNav from "@/components/SiteNav";
import {
  ButtonLink, Card, Check, Cross, GITHUB_URL, Label, OWS_URL, PanelHeader, Section, SectionHeader, StatusBadge,
  type Status,
} from "@/components/ui";

const FORK_URL = `${GITHUB_URL}/fork`;

const principles = [
  {
    num: "01",
    title: "Proof-first",
    body: "Agents don't reveal who they are — they prove what's true about them. A zero-knowledge proof confirms a credential is valid without transmitting any of the underlying data, to you or anyone else.",
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
    body: "Integrates natively with the Open Wallet Standard (OWS) policy engine through a compliance extension called zquent:kyc. Same wallet infrastructure, same security model — compliance comes with it, not bolted on after.",
  },
  {
    num: "05",
    title: "Built for the quantum decade",
    body: "Escrowed identity data and the audit trail are the records an attacker would harvest today and decrypt later. ZQUENT seals the first with ML-KEM-768 and signs the second with ML-DSA-65.",
  },
  {
    num: "06",
    title: "Regulator-shaped thresholds",
    body: "The $1,000 daily limit is modelled on the threshold in FATF Recommendation 16, the travel-rule standard banks report against today. It's one setting, so you can match your own jurisdiction. A design basis, not a compliance certification.",
  },
];

const steps = [
  {
    step: "01",
    title: "Agent submits payment",
    description: "An autonomous agent initiates a payment using its wallet's secure token. No identity information is sent at this stage — just the transaction request itself.",
    tag: "API call",
  },
  {
    step: "02",
    title: "Policy evaluation",
    description: "ZQUENT checks the agent's cumulative spend for the day against your compliance threshold — instantly, with no network call and no third-party lookup.",
    tag: "< 10 ms",
  },
  {
    step: "03",
    title: "Proof generated on-device",
    description: "If the payment crosses the threshold, the agent generates a zero-knowledge proof of identity locally, on its own device. The underlying personal data never leaves that device — zero bytes of PII are transmitted.",
    tag: "Groth16",
  },
  {
    step: "04",
    title: "Settlement — no identity required",
    description: "Your system checks that the proof is valid without ever learning who the customer is. The payment settles, the decision is written to a tamper-evident audit log, and no personal data is stored anywhere in the stack.",
    tag: "Settled",
  },
];

const protocolStack = [
  { name: "circom 2.0",              description: "ZK circuit compiler — defines the kyc_credential constraint system",                    tag: "Circuit"     },
  { name: "snarkjs",                 description: "Groth16 prover and verifier — generates and checks the proof",                           tag: "Proving"     },
  { name: "Poseidon",                description: "ZK-friendly hash — binds idHash + salt into a verifiable commitment",                   tag: "Hash"        },
  { name: "BN128",                   description: "Barreto-Naehrig elliptic curve — pairing-based proving system",                         tag: "Curve"       },
  { name: "X-Wing",                  description: "ML-KEM-768 + X25519 hybrid KEM — seals escrowed identity ciphertexts k-of-n",            tag: "Post-quantum"},
  { name: "ML-DSA-65",               description: "FIPS 204 signatures, paired with Ed25519 — signs daily audit checkpoints",               tag: "Post-quantum"},
  { name: "Open Wallet Standard",    description: "zquent:kyc feature extension — OWS policy engine integration point",                   tag: "Standard"    },
  { name: "CAIP-2",                  description: "Chain-agnostic identifiers — multi-chain wallet address resolution",                    tag: "Chains"      },
  { name: "x402",                    description: "HTTP payment protocol (Coinbase/Cloudflare) — ows pay request for API-native agentic payments", tag: "Payments" },
  { name: "Agent Payments Protocol", description: "Google's agent-to-agent payment spec — OWS speaks it natively alongside x402",           tag: "Payments"    },
  { name: "MPP",                     description: "Machine Payments Protocol (Stripe/Tempo) — streaming micropayments for agent workloads", tag: "Payments"    },
  { name: "MCP",                     description: "Model Context Protocol — OWS ships an MCP server, wallets attach as a native agent tool", tag: "Integration" },
  { name: "Next.js 16",              description: "App Router with Turbopack — edge-ready API runtime",                                    tag: "Runtime"     },
  { name: "FATF Rec. 16",            description: "Travel Rule compliance framework — $1,000 threshold design basis",                     tag: "Regulatory"  },
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

const neverLearnedItems = [
  "Name", "Date of birth", "Government ID", "Address",
  "Tax ID", "Account number", "IP address", "Agent wallet",
];

const forkIdeas = [
  {
    title: "Swap the threshold",
    body: "The $1,000 cutoff, modelled on FATF Rec. 16, is one constant in the policy engine. Point it at your own risk model — per-jurisdiction limits, velocity checks, whatever your compliance team needs.",
  },
  {
    title: "Extend the circuit",
    body: "kyc_credential.circom proves two facts today: commitment validity and age. Add a new private input — jurisdiction, accreditation status, sanctions-list exclusion — and re-run the trusted setup.",
  },
  {
    title: "Bring your own chain",
    body: "The OWS wallet integration already speaks CAIP-2 across ten chain families. Point zquent:kyc at the chain your agents actually settle on — no new primitives required.",
  },
  {
    title: "Replace the registry",
    body: "The /api/v1/agents onboarding API is a working reference, not a requirement. Swap it for your own agent identity system and keep the ZK verification boundary as-is.",
  },
];

const sponsors: { name: string; role: string; body: string; status: Status }[] = [
  {
    name: "Dynamic",
    role: "Agent wallets · testnet",
    body: "Live on testnet: a Dynamic server wallet signs a Base Sepolia transaction only after ZQUENT's compliance check approves the proof. No valid proof, no signature, above the reporting threshold. Testnet only, with fixed demo amounts.",
    status: "building",
  },
  {
    name: "x402 + Base",
    role: "Micropayments · target rail",
    body: "Target payment rail: instant, low-cost USDC micropayments on Base using the x402 standard. ZQUENT's compliance check works in front of this rail, or any other. Not yet integrated.",
    status: "planned",
  },
  {
    name: "Filecoin",
    role: "Audit trail",
    body: "Planned: store proof receipts on decentralized storage for a PII-free audit trail your regulators can independently verify. Today the audit log is hash-chained and signed, but not yet decentralized.",
    status: "planned",
  },
  {
    name: "Anchorage Digital",
    role: "Institutional settlement",
    body: "Planned: a settlement path through regulated, bank-grade custody. Not built yet.",
    status: "planned",
  },
];

const stackLayers: { layer: string; name: string; detail: string; status: Status; here: boolean }[] = [
  { layer: "L1", name: "Dynamic",      detail: "Agent wallets and payment signing — live on Base Sepolia testnet",          status: "building", here: false },
  { layer: "L2", name: "x402 on Base", detail: "Low-cost USDC micropayments — target rail",                                status: "planned",  here: false },
  { layer: "L3", name: "ZQUENT",       detail: "ZK compliance proof, threshold reveal and post-quantum escrow — testnet", status: "live",     here: true  },
  { layer: "L4", name: "Filecoin",     detail: "Decentralized, PII-free audit trail — planned",                           status: "planned",  here: false },
  { layer: "L5", name: "Anchorage",    detail: "Regulated institutional custody and settlement — planned",                status: "planned",  here: false },
];

const postQuantum: { title: string; status: Status; body: string; spec: string }[] = [
  {
    title: "Sealed identity escrow",
    status: "optin",
    body: "Each threshold-reveal ciphertext is sealed before storage. A fresh AES-256-GCM key is split k-of-n, and each share is sealed to one consortium member's key. A stolen copy of the store stays unreadable, even to a future quantum computer.",
    spec: "X-Wing · ML-KEM-768 + X25519",
  },
  {
    title: "Tamper-evident audit chain",
    status: "optin",
    body: "Every audit record is sequenced and hashed. Daily checkpoints chain them and are signed twice, so forging one means breaking a classical and a post-quantum scheme at once.",
    spec: "Ed25519 + ML-DSA-65 (FIPS 204)",
  },
  {
    title: "Zero-knowledge proofs",
    status: "classical",
    body: "The proofs themselves use Groth16 on BN128. They keep personal data private today, but they are not post-quantum. We say so plainly, so your security team doesn't have to find out.",
    spec: "Groth16 · BN128",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zq-bg text-zq-text overflow-x-hidden">
      <SiteNav />

      {/* ═══════════════ HERO ═══════════════ */}
      <header className="pt-28 md:pt-36 pb-16 md:pb-20 px-4 sm:px-6">
        <div className="max-w-page mx-auto">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-10 items-start">
            <div className="lg:col-span-7">
              <p className="inline-flex items-center gap-2.5 px-3 py-1.5 mb-8 rounded-full border border-zq-line-strong bg-zq-surface text-sm text-zq-muted">
                <span className="w-2 h-2 rounded-full bg-zq-success" aria-hidden="true"/>
                Live on testnet · Open source, MIT
              </p>

              <h1 className="font-display text-[36px] leading-[1.08] sm:text-5xl md:text-[64px] md:leading-[1.04] font-semibold tracking-[-0.03em] text-zq-text">
                Every agent payment, <span className="text-zq-accent">proven.</span>
              </h1>

              <p className="mt-6 text-lg md:text-[19px] text-zq-muted leading-relaxed max-w-xl">
                ZQUENT lets AI agents prove they are verified and allowed to pay — without sharing who is behind them.
                Built for banks, payment providers and compliance teams.
              </p>
              <p className="mt-4 text-[15px] text-zq-faint leading-relaxed max-w-xl">
                The zero-knowledge, post-quantum trust protocol for agentic banking and micropayments. Open source, so
                your security team can review the circuit, verifier and wallet integration line by line.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <ButtonLink href="#demo">Run the live demo</ButtonLink>
                <ButtonLink href="/register" variant="secondary">Register an agent</ButtonLink>
              </div>

              <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zq-muted">
                {["No personal data collected", "FATF R.16 threshold", "Post-quantum escrow"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check className="text-zq-success"/>{t}</li>
                ))}
              </ul>
            </div>

            {/* Payment check — what a bank actually receives */}
            <div className="lg:col-span-5">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zq-line">
                  <span className="text-[15px] font-semibold text-zq-text">Payment check</span>
                  <span className="px-2.5 py-1 rounded-full bg-zq-success-bg text-zq-success text-sm font-medium">Approved</span>
                </div>
                <div className="px-6 py-5 border-b border-zq-line">
                  <p className="text-sm text-zq-faint">Amount</p>
                  <p className="mt-1 font-mono text-3xl font-medium text-zq-text">$1,200.00</p>
                  <p className="mt-1 text-sm text-zq-faint">Above $1,000/day — proof required</p>
                </div>
                <div className="px-6 py-5 border-b border-zq-line">
                  <p className="text-sm text-zq-faint mb-3">What the bank learns</p>
                  <ul className="space-y-2.5 text-[15px] text-zq-text">
                    {["The agent's credential is valid", "Its owner is over 18", "The proof is for this payment only"].map((t) => (
                      <li key={t} className="flex items-center gap-2.5"><Check className="text-zq-success"/>{t}</li>
                    ))}
                  </ul>
                </div>
                <p className="px-6 py-4 bg-zq-bg text-sm text-zq-muted">
                  Name, date of birth and ID never leave the customer&apos;s device. Illustrative — the live demo below makes a real proof.
                </p>
              </Card>
            </div>
          </div>

          {/* Key numbers */}
          <dl className="mt-14 md:mt-20 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { value: "0 bytes",    label: "of personal data sent" },
              { value: "< 10 ms",    label: "to approve a small payment" },
              { value: "~2.5 s",     label: "to prove a large one" },
              { value: "ML-KEM-768", label: "quantum-safe identity escrow" },
            ].map((s) => (
              <div key={s.label} className="px-5 py-5 rounded-md border border-zq-line bg-zq-surface">
                <dd className="font-mono text-xl md:text-[26px] font-medium text-zq-text tracking-tight">{s.value}</dd>
                <dt className="mt-1.5 text-sm text-zq-faint">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ═══════════════ ECOSYSTEM ═══════════════ */}
      <Section id="built-with">
        <SectionHeader
          index="01"
          label="Ecosystem"
          title="Where ZQUENT fits in the agent payment stack."
          lead="ZQUENT's compliance layer is live on testnet today. Each partner integration is labelled by its real status — live, in progress or planned — so you always know what's real."
        />
        <div className="grid sm:grid-cols-2 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          {sponsors.map((s) => (
            <div key={s.name} className="bg-zq-surface p-6 md:p-7">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-display text-lg font-semibold text-zq-text">{s.name}</p>
                  <Label className="mt-1">{s.role}</Label>
                </div>
                <StatusBadge status={s.status}/>
              </div>
              <p className="text-sm text-zq-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-zq-muted leading-relaxed">
          <span className="text-zq-soft">Open Wallet Standard</span> handles wallet key management. ZQUENT adds the
          compliance layer on top of it, through a feature called <span className="font-mono text-zq-accent">zquent:kyc</span>.
        </p>
      </Section>

      {/* ═══════════════ THE COMPLIANCE GAP ═══════════════ */}
      <Section>
        <SectionHeader
          index="02"
          label="The problem"
          title={<>OWS solved wallet key chaos.<br/><span className="text-zq-muted">The compliance gap remained.</span></>}
          lead="The Open Wallet Standard solved how AI agents manage cryptographic keys: one secure vault, one interface, bank-grade encryption. But any agent wallet that touches the financial system still raises a compliance question — and traditional KYC answers it the wrong way, by forcing disclosure of the very identity a self-custody wallet exists to protect."
        />

        <div className="grid md:grid-cols-2 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          <div className="bg-zq-surface p-6">
            <Label className="mb-5 text-zq-danger">Traditional KYC for agents</Label>
            <dl className="space-y-3 font-mono text-sm">
              {[
                ["Collects", "name, DOB, government ID"],
                ["Stores",   "PII in vendor database"],
                ["Requires", "third-party identity broker"],
                ["Exposes",  "single point of breach"],
                ["Violates", "self-custody principles"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6rem,1fr] gap-3">
                  <dt className="text-zq-faint">{k}</dt>
                  <dd className="text-zq-muted line-through decoration-zq-danger/40">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-zq-surface p-6">
            <Label className="mb-5 text-zq-success">ZQUENT · zero-knowledge agent compliance</Label>
            <dl className="space-y-3 font-mono text-sm">
              {[
                ["Collects", "nothing"],
                ["Stores",   "a one-way cryptographic fingerprint only"],
                ["Requires", "a proof — generated on the customer's device"],
                ["Exposes",  "no data — math is the anchor"],
                ["Extends",  "works natively with OWS"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6rem,1fr] gap-3">
                  <dt className="text-zq-faint">{k}</dt>
                  <dd className="text-zq-text">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          <blockquote className="bg-zq-surface p-6">
            <Label className="mb-3">Open Wallet Standard</Label>
            <p className="text-zq-soft leading-relaxed">&ldquo;Agents never see plaintext keys. Instead, they authenticate with scoped API tokens.&rdquo;</p>
          </blockquote>
          <blockquote className="bg-zq-surface p-6">
            <Label className="mb-3 text-zq-accent">ZQUENT</Label>
            <p className="text-zq-text leading-relaxed">&ldquo;Compliance never sees plaintext identity. Instead, verifiers receive cryptographic proofs.&rdquo;</p>
          </blockquote>
        </div>

        {/* Why now */}
        <dl className="mt-10 grid grid-cols-1 sm:grid-cols-3 border-y border-zq-line">
          {[
            { value: "69,000+", label: "Active agents on x402" },
            { value: "165M+",   label: "Agent transactions" },
            { value: "$50M+",   label: "Cumulative volume" },
          ].map((s, i) => (
            <div key={s.label} className={`px-4 sm:px-6 py-6 ${i > 0 ? "border-t sm:border-t-0 sm:border-l border-zq-line" : ""}`}>
              <dd className="font-mono text-2xl md:text-3xl text-zq-text tracking-tight">{s.value}</dd>
              <dt className="mt-1.5 text-xs uppercase tracking-[0.1em] text-zq-muted">{s.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-zq-faint leading-relaxed max-w-3xl">
          x402 ecosystem totals as of April 2026, per Coinbase — since formalized as the Linux Foundation&apos;s x402
          Foundation with Visa, Mastercard, Stripe, Google and AWS as members. Agent-to-agent payments already move
          volume, and Know-Your-Agent (KYA) and AML standards for them are still being written.
        </p>
      </Section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <Section id="how-it-works">
        <SectionHeader
          index="03"
          label="Protocol"
          title="Every payment, one of two paths."
          lead="ZQUENT sits at the compliance checkpoint before a payment settles. Under the threshold, the decision takes milliseconds. Above it, generating and checking a proof takes about 2.5 seconds — still faster than a manual compliance review."
        />
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          {steps.map((s) => (
            <li key={s.step} className="bg-zq-surface p-6 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-sm text-zq-accent">{s.step}</span>
                <span className="font-mono text-xs uppercase tracking-[0.08em] text-zq-muted border border-zq-line-strong rounded px-2 py-0.5">{s.tag}</span>
              </div>
              <h3 className="font-display text-base font-semibold text-zq-text mb-2">{s.title}</h3>
              <p className="text-sm text-zq-muted leading-relaxed">{s.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ═══════════════ LIVE DEMO ═══════════════ */}
      <Section id="demo">
        <SectionHeader
          index="04"
          label="Live demo"
          title="Watch a proof clear."
          lead="Send transfers as an autonomous agent and cross the $1,000 daily threshold. The proof flow triggers automatically and runs in your browser. No personal data is collected at any point."
          aside={
            <span className="inline-flex items-center gap-2 text-sm font-medium text-zq-success bg-zq-success-bg rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-zq-success" aria-hidden="true"/>
              Demo mode · no real funds
            </span>
          }
        />
        <div className="border border-zq-line rounded-md bg-zq-bg p-4 sm:p-6">
          <ClientDemoWidget/>
        </div>
      </Section>

      {/* ═══════════════ COMPLIANCE POLICY ═══════════════ */}
      <Section>
        <SectionHeader
          index="05"
          label="Compliance policy"
          title="Risk-tiered by design."
          lead="Two tiers, one protocol, no personal data. Below the FATF threshold, agents transact freely. Above it, they prove who they are without revealing who they are."
        />
        <div className="grid md:grid-cols-2 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          {[
            {
              tier: "Tier 1 — Anonymous",
              amount: "< $1,000",
              items: [
                "No KYC — no identity data collected",
                "No AML exposure — no reporting obligation",
                "Sub-100 ms approval — pure policy evaluation",
                "OWS bearer token sufficient for auth",
              ],
            },
            {
              tier: "Tier 2 — ZK verified",
              amount: "≥ $1,000",
              items: [
                "Zero-knowledge proof of identity (Groth16) — generated locally",
                "Zero personal data transmitted — math only",
                "Verifier learns: credential valid",
                "Verifier learns: age ≥ 18",
                "Verifier learns: nothing else",
              ],
            },
          ].map((t, i) => (
            <div key={t.tier} className="bg-zq-surface p-6 md:p-8">
              <Label className={i === 1 ? "text-zq-accent" : ""}>{t.tier}</Label>
              <p className="mt-4 font-mono text-4xl text-zq-text tracking-tight">{t.amount}</p>
              <p className="mt-1 text-sm text-zq-muted">cumulative per calendar day · FATF Rec. 16</p>
              <ul className="mt-6 space-y-2.5">
                {t.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-zq-soft">
                    <Check className="mt-0.5 text-zq-success"/>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 border border-zq-line rounded-md p-6">
          <Label className="mb-4">What the verifier never learns — in either tier</Label>
          <ul className="flex flex-wrap gap-2">
            {neverLearnedItems.map((item) => (
              <li key={item} className="font-mono text-xs px-2.5 py-1 rounded border border-zq-line text-zq-faint line-through decoration-zq-danger/40">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ═══════════════ POST-QUANTUM ═══════════════ */}
      <Section id="post-quantum">
        <SectionHeader
          index="06"
          label="Post-quantum"
          title="Built for records that must stay secret for decades."
          lead="Escrowed identity data and the audit trail are what an attacker would harvest today and decrypt later. ZQUENT protects both with NIST post-quantum algorithms, in hybrid with classical ones, so an attacker has to break both."
        />
        <div className="grid md:grid-cols-3 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          {postQuantum.map((p) => (
            <div key={p.title} className="bg-zq-surface p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="font-display text-base font-semibold text-zq-text">{p.title}</h3>
                <StatusBadge status={p.status}/>
              </div>
              <p className="text-sm text-zq-muted leading-relaxed flex-1">{p.body}</p>
              <p className="mt-6 pt-4 border-t border-zq-line font-mono text-xs text-zq-soft">{p.spec}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-zq-faint leading-relaxed max-w-3xl">
          Opt-in: escrow sealing and checkpoint signing turn on when their keys are configured. The post-quantum
          library (@noble/post-quantum) is pure JavaScript — not independently audited, not constant-time and not
          FIPS-validated. An institution would run these operations in an HSM.
        </p>
      </Section>

      {/* ═══════════════ ARCHITECTURE ═══════════════ */}
      <Section id="architecture">
        <SectionHeader
          index="07"
          label="ZK architecture"
          title="Cryptographic proof, not disclosure."
          lead={<>A single proof establishes two facts at once — that the credential is valid, and that the holder meets the age requirement — without revealing the underlying data to anyone, anywhere. Under the hood: the <span className="font-mono text-zq-soft">kyc_credential</span> circuit.</>}
        />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card className="p-6">
              <Label className="mb-5">What the verifier learns</Label>
              <div className="space-y-4">
                {[
                  { label: "Credential validity", detail: "Poseidon(idHash, salt) == commitment" },
                  { label: "Age requirement met", detail: "currentYear − birthYear ≥ minAge" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <Check className="mt-1 text-zq-success"/>
                    <div>
                      <p className="text-sm text-zq-text">{item.label}</p>
                      <p className="font-mono text-xs text-zq-muted mt-1">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <Label className="mb-5">What stays private — always</Label>
              <div className="space-y-4">
                {[
                  { label: "Identity hash", detail: "idHash — private input, never leaves device" },
                  { label: "Date of birth", detail: "birthYear — private input, never leaves device" },
                  { label: "Salt / nonce",  detail: "salt — private input, never leaves device" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <Cross className="mt-1 text-zq-danger"/>
                    <div>
                      <p className="text-sm text-zq-soft">{item.label}</p>
                      <p className="font-mono text-xs text-zq-faint mt-1">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden bg-zq-bg">
            <PanelHeader>circuits/kyc_credential.circom</PanelHeader>
            <pre className="p-5 font-mono text-xs leading-7 overflow-x-auto text-zq-soft"><code>
<span className="text-zq-faint">{"// private inputs"}</span>{"\n"}
<span className="text-zq-muted">signal private input</span> idHash;{"\n"}
<span className="text-zq-muted">signal private input</span> birthYear;{"\n"}
<span className="text-zq-muted">signal private input</span> salt;{"\n\n"}
<span className="text-zq-faint">{"// public inputs"}</span>{"\n"}
<span className="text-zq-muted">signal input</span> <span className="text-zq-accent">commitment</span>;{"\n"}
<span className="text-zq-muted">signal input</span> <span className="text-zq-accent">currentYear</span>;{"\n"}
<span className="text-zq-muted">signal input</span> <span className="text-zq-accent">minAge</span>;{"\n\n"}
<span className="text-zq-faint">{"// constraints — math is the anchor"}</span>{"\n"}
Poseidon([idHash, salt]) === <span className="text-zq-accent">commitment</span>;{"\n"}
<span className="text-zq-accent">currentYear</span> - birthYear &gt;= <span className="text-zq-accent">minAge</span>;{"\n\n"}
<span className="text-zq-faint">{"// what crosses the boundary"}</span>{"\n"}
<span className="text-zq-accent">{"// ✓ proof · publicSignals · commitment"}</span>{"\n"}
<span className="text-zq-danger">{"// ✗ idHash · birthYear · salt"}</span>
            </code></pre>
          </Card>
        </div>
      </Section>

      {/* ═══════════════ PRINCIPLES ═══════════════ */}
      <Section>
        <SectionHeader
          index="08"
          label="Design principles"
          title="Six principles behind ZQUENT."
          lead="Built in the same spirit as the Open Wallet Standard: no new cryptographic primitives — well-studied building blocks (Groth16, Poseidon, ElGamal, ML-KEM, ML-DSA), applied to compliance. The circuits have not been independently audited yet."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          {principles.map((p) => (
            <div key={p.num} className="bg-zq-surface p-6">
              <p className="font-mono text-sm text-zq-accent mb-4">{p.num}</p>
              <h3 className="font-display text-base font-semibold text-zq-text mb-2">{p.title}</h3>
              <p className="text-sm text-zq-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══════════════ REFERENCE ARCHITECTURE ═══════════════ */}
      <Section id="stack">
        <SectionHeader
          index="09"
          label="Reference architecture"
          title="The compliant agent payment stack."
          lead="From an autonomous wallet to regulated settlement, ZQUENT is the compliance layer in between. The middle layer is live on testnet; the layers around it are integration targets, each labelled by its real status."
        />
        <ol className="border border-zq-line rounded-md overflow-hidden divide-y divide-zq-line">
          {stackLayers.map((row) => (
            <li
              key={row.name}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6 px-5 py-4 ${row.here ? "bg-zq-raise" : "bg-zq-surface"}`}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-mono text-xs text-zq-faint w-6">{row.layer}</span>
                <span className={`text-sm font-semibold ${row.here ? "text-zq-accent" : "text-zq-text"}`}>{row.name}</span>
                <StatusBadge status={row.status}/>
                {row.here && <span className="font-mono text-xs uppercase tracking-[0.08em] text-zq-accent">← You are here</span>}
              </div>
              <span className="text-sm text-zq-muted sm:text-right">{row.detail}</span>
            </li>
          ))}
        </ol>

        <Card className="mt-4 overflow-hidden bg-zq-bg">
          <PanelHeader>illustrative sketch · real types in src/wallet/ows-wallet.ts</PanelHeader>
          <pre className="p-5 font-mono text-xs leading-7 overflow-x-auto text-zq-soft"><code>
<span className="text-zq-faint">{"// Illustrative: how zquent:kyc plugs into an OWS wallet"}</span>{"\n"}
<span className="text-zq-muted">const</span> wallet = <span className="text-zq-muted">await</span> ows.load(<span className="text-zq-text">&apos;agent-treasury&apos;</span>);{"\n\n"}
wallet.registerFeature({"({"}{"\n"}
{"  "}name: <span className="text-zq-accent">&apos;zquent:kyc&apos;</span>,{"\n"}
{"  "}version: <span className="text-zq-text">&apos;1.0.0&apos;</span>,{"\n"}
{"  "}commitment: poseidon([idHash, salt]),{"\n"}
{"  "}threshold: <span className="text-zq-text">1000</span>, <span className="text-zq-faint">{"// USD, FATF Rec. 16"}</span>{"\n"}
{"  "}circuit: <span className="text-zq-text">&apos;kyc_credential.circom&apos;</span>,{"\n"}
{"});"}{"\n\n"}
<span className="text-zq-faint">{"// zquent:kyc is now enforced by the OWS policy engine"}</span>{"\n"}
<span className="text-zq-accent">{"// ✓ Compliant by default. Private by design."}</span>
          </code></pre>
        </Card>
      </Section>

      {/* ═══════════════ OWS ECOSYSTEM ═══════════════ */}
      <Section>
        <SectionHeader
          index="10"
          label="OWS ecosystem"
          title="One interface. Ten chains. Every agent framework."
          lead="OWS gives every agent secure key storage, multi-chain signing, and a policy engine that checks rules before a transaction is signed — as a CLI, an SDK and a plug-in for AI agent frameworks. Any framework (LangChain, AutoGPT, custom tool-callers) can attach an OWS wallet as a tool with no custom wallet code. ZQUENT adds the compliance layer to that same stack: no new infrastructure to run, no new formats to learn."
        />
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="overflow-hidden bg-zq-bg">
            <PanelHeader>ows — CLI reference</PanelHeader>
            <div className="p-5 space-y-4">
              {owsCliCommands.map((c) => (
                <div key={c.cmd} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-zq-faint select-none mt-0.5">$</span>
                  <div>
                    <p className="font-mono text-sm text-zq-accent">{c.cmd}</p>
                    <p className="text-xs text-zq-muted mt-1 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mx-5 mb-5 px-3 py-2 rounded border border-zq-line text-xs text-zq-soft">
              Same wallet, exposed as an <span className="font-mono">MCP server</span> for agent frameworks
            </p>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden">
              <div className="px-5 py-3 border-b border-zq-line"><Label>Supported chains · OWS v1.4.2</Label></div>
              <ul className="divide-y divide-zq-line">
                {owsChains.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm text-zq-text">{c.name}</p>
                      <p className="font-mono text-xs text-zq-muted mt-0.5">{c.networks}</p>
                    </div>
                    <span className="font-mono text-xs text-zq-muted border border-zq-line rounded px-2 py-0.5 shrink-0">{c.curve}</span>
                  </li>
                ))}
                <li className="px-5 py-3 font-mono text-xs text-zq-faint">+ Tron · XRPL · Filecoin · Spark</li>
              </ul>
            </Card>
            <Card className="p-5">
              <Label className="mb-2 text-zq-soft">x402 · HTTP payments</Label>
              <p className="font-mono text-xs text-zq-muted">ows pay request</p>
              <p className="text-sm text-zq-muted mt-1 leading-relaxed">Agents pay for API access directly and automatically — no exchange account, no manual approval step.</p>
            </Card>
            <Card className="p-5">
              <Label className="mb-2 text-zq-soft">+ Agent Payments Protocol · MPP</Label>
              <p className="text-sm text-zq-muted leading-relaxed">
                OWS isn&apos;t locked to one payment rail — it also supports Google&apos;s Agent Payments Protocol and
                Stripe/Tempo&apos;s Machine Payments Protocol for streaming micropayments. ZQUENT&apos;s compliance check works in front of all three.
              </p>
            </Card>
          </div>
        </div>

        <div className="mt-4 border border-zq-line rounded-md p-5">
          <Label className="mb-3">OWS · originated by MoonPay, built with 15+ contributing organizations</Label>
          <ul className="flex flex-wrap gap-2">
            {owsContributors.map((org) => (
              <li key={org} className="font-mono text-xs px-2.5 py-1 rounded border border-zq-line text-zq-muted">{org}</li>
            ))}
            <li className="text-xs px-2.5 py-1 text-zq-faint">+ more</li>
          </ul>
        </div>
      </Section>

      {/* ═══════════════ PROTOCOL STACK ═══════════════ */}
      <Section>
        <SectionHeader
          index="11"
          label="Protocol stack"
          title="No new primitives."
          lead="ZQUENT doesn't invent new cryptographic or compliance standards — it applies existing, published ones (BIP, CAIP, FATF, NIST FIPS 203/204) in a way that works natively for AI agents. Every component has a public spec your security team can review."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
          {protocolStack.map((t) => (
            <div key={t.name} className="bg-zq-surface p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-mono text-sm text-zq-text">{t.name}</p>
                <span className={`font-mono text-xs shrink-0 ${t.tag === "Post-quantum" ? "text-zq-accent" : "text-zq-faint"}`}>{t.tag}</span>
              </div>
              <p className="text-sm text-zq-muted leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══════════════ FOUNDER ═══════════════ */}
      <Section id="founder">
        <SectionHeader
          index="12"
          label="Founder & research"
          title="Built at the intersection of civic identity and agentic finance."
          lead="ZQUENT grew directly out of two prior projects — MiamiDadeDAO and the Miami-Dade Community ID — extending that civic zero-knowledge identity work into autonomous agents, the Open Wallet Standard and agentic banking."
        />
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-start gap-4 mb-6">
              <img
                src="/jorge-cortes.png"
                alt="Jorge Cortes"
                className="w-16 h-16 rounded object-cover object-top border border-zq-line shrink-0"
              />
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-zq-text">Jorge Cortes</p>
                <p className="text-sm text-zq-soft mt-0.5">Founder · Educator · Investor · Top Voice in Web3 &amp; Industry 4.0</p>
                <p className="text-sm text-zq-muted mt-1">+15 years Innovation &amp; Tech Ecosystems · Founder, ZQUENT</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-sm">
                  <a href="https://www.linkedin.com/in/jorgeandrescortes/" target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">LinkedIn ↗</a>
                  <a href="https://x.com/realTechCortes" target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">X ↗</a>
                  <a href="https://techcortes.substack.com" target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">Substack ↗</a>
                  <a href="https://github.com/TechCortes" target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">GitHub ↗</a>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 border-t border-zq-line pt-6">
              <div>
                <Label className="mb-3">Roles &amp; affiliations</Label>
                <ul className="space-y-3 text-sm text-zq-muted leading-relaxed">
                  <li>
                    Co-founder,{" "}
                    <a href="https://bitbasel.com" target="_blank" rel="noreferrer" className="text-zq-text underline decoration-zq-line-strong underline-offset-4 hover:decoration-zq-accent">BitBasel Inc</a>
                    {" "}— the future of the arts on Web3 infrastructure
                  </li>
                  <li>
                    Co-founder,{" "}
                    <a href="https://linktr.ee/miamidadedao" target="_blank" rel="noreferrer" className="text-zq-text underline decoration-zq-line-strong underline-offset-4 hover:decoration-zq-accent">MiamiDadeDAO</a>
                    {" "}— civic digital credentials and community identity in South Florida; the groundwork behind ZQUENT&apos;s zero-knowledge approach to agentic banking
                  </li>
                  <li>
                    Advisor,{" "}
                    <a href="https://www.ufblockchain.org/" target="_blank" rel="noreferrer" className="text-zq-text underline decoration-zq-line-strong underline-offset-4 hover:decoration-zq-accent">University of Florida Blockchain Lab</a>
                  </li>
                  <li>
                    <a href="https://www.nobeldao.com/" target="_blank" rel="noreferrer" className="text-zq-text underline decoration-zq-line-strong underline-offset-4 hover:decoration-zq-accent">Nobel DAO</a>
                    {" "}— decentralized coordination and regenerative finance
                  </li>
                  <li>
                    <a href="https://ldacap.com/" target="_blank" rel="noreferrer" className="text-zq-text underline decoration-zq-line-strong underline-offset-4 hover:decoration-zq-accent">LDA Capital</a>
                    {" "}— Digital Assets Portfolio
                  </li>
                </ul>
              </div>
              <div className="space-y-6">
                <div>
                  <Label className="mb-3">Prior work</Label>
                  <p className="text-sm text-zq-muted leading-relaxed">
                    Founded the{" "}
                    <a href="https://miamiid.org/" target="_blank" rel="noreferrer" className="text-zq-text underline decoration-zq-line-strong underline-offset-4 hover:decoration-zq-accent">Miami-Dade Community ID</a>
                    {" "}— a zero-knowledge credential system for digital and civic identity in Miami. ZQUENT is the direct extension of that work: the same zero-knowledge approach, applied to agentic banking.
                  </p>
                </div>
                <div>
                  <Label className="mb-3">Media</Label>
                  <ul className="space-y-2 text-sm">
                    <li><a href="https://www.coindesk.com/tv/community-crypto/community-crypto-june-3-2021-20210528" target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">CoinDesk · Community Crypto ↗</a></li>
                    <li><a href="https://www.cnbc.com/2021/06/24/why-titan-crypto-crash-that-burned-mark-cuban-may-not-signal-similar-bitcoin-plunge.html" target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">CNBC · Crypto Markets Commentary ↗</a></li>
                    <li><a href="https://www.youtube.com/watch?v=pcQfAj55C10" target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">CNN en Español · Web3 &amp; Digital Assets ↗</a></li>
                  </ul>
                </div>
              </div>
            </div>

            <ul className="flex flex-wrap gap-1.5 mt-6 pt-5 border-t border-zq-line">
              {["ZQUENT", "MiamiDadeDAO", "Community ID", "Groth16", "ML-KEM", "OWS", "FATF", "ReFi", "Web3"].map((t) => (
                <li key={t} className="font-mono text-xs px-2 py-0.5 rounded border border-zq-line text-zq-muted">{t}</li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 self-start">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="font-display text-base font-semibold text-zq-text">Open Wallet Standard</p>
              <span className="font-mono text-xs text-zq-muted border border-zq-line rounded px-1.5 py-0.5 shrink-0">v1.4.2</span>
            </div>
            <Label className="mb-3">Wallet infrastructure</Label>
            <p className="text-sm text-zq-muted leading-relaxed">
              The foundation — local key custody, AES-256-GCM encryption, CAIP-2 multi-chain support, and a pre-signing policy engine across 10 chain families.
            </p>
          </Card>
        </div>
      </Section>

      {/* ═══════════════ MISSION ═══════════════ */}
      <Section>
        <div className="max-w-3xl">
          <Label className="mb-8"><span className="font-mono text-zq-accent">13</span><span className="mx-2 text-zq-line-strong">/</span>The mission</Label>
          <blockquote className="font-display text-2xl md:text-4xl leading-tight font-semibold tracking-[-0.02em] text-zq-text">
            Every agent deserves a wallet.<br/>
            Every wallet deserves a standard.<br/>
            <span className="text-zq-accent">Every standard deserves compliance.</span>
          </blockquote>
          <p className="mt-6 text-base text-zq-muted leading-relaxed max-w-xl">
            The Open Wallet Standard unified wallet key management. ZQUENT closes the compliance gap — adding identity
            verification to the stack without breaking the privacy-first principles that make agent wallets worth trusting.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <ButtonLink href="#demo">Run the live demo</ButtonLink>
            <ButtonLink href={OWS_URL} variant="secondary" external>Read the OWS spec ↗</ButtonLink>
          </div>
        </div>
      </Section>

      {/* ═══════════════ BUILD ON ZQUENT ═══════════════ */}
      <Section id="build">
        <SectionHeader
          index="14"
          label="Open source · MIT licensed"
          title="This isn't a mockup. Fork it."
          lead="Everything on this page is real and working in the repository — a completed proof circuit, a live agent onboarding API, OWS wallet-standard integration, post-quantum escrow and audit signing, and the registration flow you just tried in the demo. Clone it and you have a working compliance stack on day one."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden mb-4">
          {forkIdeas.map((idea) => (
            <div key={idea.title} className="bg-zq-surface p-6">
              <h3 className="font-display text-base font-semibold text-zq-text mb-2">{idea.title}</h3>
              <p className="text-sm text-zq-muted leading-relaxed">{idea.body}</p>
            </div>
          ))}
        </div>
        <Card className="overflow-hidden bg-zq-bg mb-8">
          <PanelHeader>terminal</PanelHeader>
          <pre className="p-5 font-mono text-xs leading-7 overflow-x-auto text-zq-soft"><code>
<span className="text-zq-faint select-none">$ </span><span className="text-zq-accent">git clone</span> {GITHUB_URL}{"\n"}
<span className="text-zq-faint select-none">$ </span><span className="text-zq-accent">cd</span> ZKX-Zero-Knowledge-Proof-for-Agentic-Banking{"\n"}
<span className="text-zq-faint select-none">$ </span><span className="text-zq-accent">npm install</span> &amp;&amp; <span className="text-zq-accent">npm run dev</span>
          </code></pre>
        </Card>
        <ButtonLink href={FORK_URL} external>Fork on GitHub ↗</ButtonLink>
      </Section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-zq-line px-4 sm:px-6 py-10">
        <div className="max-w-page mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            <LogoIcon size={22}/>
            <div className="text-sm">
              <p className="text-zq-text">ZQUENT · Zero-knowledge, post-quantum trust protocol for agentic banking</p>
              <p className="text-zq-faint mt-1 font-mono text-xs">zquent:kyc for the Open Wallet Standard · formerly Vero Protocol</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a href="/register" className="text-zq-muted hover:text-zq-text transition-colors">Register an agent</a>
            <a href={OWS_URL} target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">OWS spec ↗</a>
            <a href={FORK_URL} target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">Fork</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-zq-muted hover:text-zq-text transition-colors">Star ↗</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
