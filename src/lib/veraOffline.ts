/**
 * Vera offline mode — pre-written answers used when the Claude API is unavailable
 * (no credits, bad key, outage). Not generated: every answer here is a fixed statement
 * of what the repo actually does, matched by keyword. Replies are labelled as offline.
 */

const DEV_CTA = "Fork Vero on GitHub — deploy in 2 minutes.";
const COMPLIANCE_CTA = "Ask us about the Vero enterprise SLA.";

interface Rule {
  test: RegExp;
  answer: string;
}

// Order matters: first match wins, so more specific topics come first.
const RULES: Rule[] = [
  {
    test: /\b(fork|install|get started|getting started|setup|set up|run it|clone|deploy|npm|github|open.?source|license)\b/,
    answer:
      "Vero Protocol is MIT-licensed. Fork the GitHub repo, run `npm install` and `npm run dev`, and you are live in about two minutes. " +
      "The repo includes a working Groth16 setup, the agent onboarding API (`/api/v1/agents/register`, `/api/v1/payment`, `/api/v1/verify-proof`) and a registration UI at `/register`.\n\n" +
      DEV_CTA,
  },
  {
    test: /\b(fatf|r\.?16|travel rule|regulat|complian|audit|lawful|disclos|subpoena|eidas|aml|kya|kyc)\b/,
    answer:
      "Vero uses a simple, regulator-aligned threshold: payments under $1,000/day stay anonymous, with no identity data collected. At or above that threshold — the FATF Recommendation 16 travel-rule benchmark — the agent must present a valid cryptographic proof of identity before the payment settles. " +
      "Every decision (approved, proof required, rejected) is written to an audit log that contains zero personal data, tagged to the policy version active at the time. " +
      "For institutions, the roadmap adds a threshold-reveal capability so a specific transaction can be unmasked under legal process by a designated multi-party group — never unilaterally, never in bulk.\n\n" +
      COMPLIANCE_CTA,
  },
  {
    test: /\b(how (does|do|is)|prove|proof|circuit|groth|snark|circom|poseidon|commitment|zero.?knowledge|zk)\b/,
    answer:
      "Short version: the agent proves it holds a valid, age-verified credential without ever sending the underlying personal data anywhere — not to Vero, not to the merchant, not to anyone. The proof is generated entirely on the agent's own device. " +
      "Technical detail: it's a Groth16 zero-knowledge proof (circom + snarkjs). The circuit proves two things — that a private ID hash and salt hash, via Poseidon, to the public commitment registered for that agent, and that currentYear − birthYear ≥ 18. The server verifies the proof against the verification key and pins the public inputs so a prover can't substitute a weaker claim. Private inputs never leave the device, so zero bytes of personal data are transmitted.\n\n" +
      DEV_CTA,
  },
  {
    test: /\b(threshold|limit|\$?1,?000|spend|daily|anonymous|micropayment|policy)\b/,
    answer:
      "The policy is simple: under $1,000 of daily spend, payments go through as anonymous micropayments — no KYC, no data collected. At $1,000/day or more, a valid proof of identity is required before the payment settles. " +
      "That $1,000 figure follows FATF Recommendation 16, and it's a single configurable constant, so you can point it at your own institution's risk model.\n\n" +
      COMPLIANCE_CTA,
  },
  {
    test: /\b(ows|wallet|x402|agent|payment rail|chain|caip|open wallet)\b/,
    answer:
      "Vero plugs directly into the Open Wallet Standard (OWS), the emerging standard for how AI agents hold and use wallets. It registers as a compliance feature called `vero:kyc`, so it works with the wallet's existing policy engine instead of running a separate one alongside it. " +
      "The compliance check sits in front of whatever payment rail you use — x402 or otherwise — and works across chains via the CAIP-2 standard.\n\n" +
      DEV_CTA,
  },
  {
    test: /\b(privacy|pii|personal|private|doxx|identity|secret)\b/,
    answer:
      "Vero proves an agent has a valid, age-verified identity — without ever revealing who that identity belongs to. The private details (ID hash, birth year, salt) never leave the agent's own device. Your server only ever receives the proof itself and three public values: the commitment, the current year, and the minimum age. " +
      "Every verified payment response reports zero bytes of personal data transmitted (`piiTransmitted: 0`).\n\n" +
      COMPLIANCE_CTA,
  },
];

const OVERVIEW =
  "Vero Protocol is open-source zero-knowledge compliance for AI agent wallets. Small payments stay anonymous; larger ones require proof of a valid identity (age 18+) without revealing any personal data. " +
  "It's open source (MIT-licensed), built on the Open Wallet Standard, and aligned with the FATF Recommendation 16 threshold model used in banking today. Ask me how the proof works, how the spending policy works, how compliance and audit work, or how to fork it.\n\n" +
  DEV_CTA;

const OFFLINE_NOTE = "— Vera is in offline mode: this is a pre-written answer, not a live AI response.";

/** Pick a pre-written answer for the latest user message. Never throws. */
export function offlineVeraReply(latestUserMessage: string): string {
  const text = latestUserMessage.toLowerCase();
  const match = RULES.find((r) => r.test.test(text));
  return `${match ? match.answer : OVERVIEW}\n\n${OFFLINE_NOTE}`;
}
