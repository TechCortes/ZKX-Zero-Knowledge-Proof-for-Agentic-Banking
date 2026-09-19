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
      "Vero is built around the FATF Recommendation 16 idea of a threshold: payments under $1,000/day stay anonymous, and at or above it the agent must present a valid zero-knowledge proof of identity. " +
      "Every policy decision (anonymous approval, proof challenge, approval, rejection, denial) is written to an append-only audit log with no personal data in it, tagged with a hash of the policy version that was active. " +
      "For institutions, the roadmap adds a threshold-reveal design so a specific transaction can be unmasked under legal process by a designated multi-party group, never unilaterally and never in bulk.\n\n" +
      COMPLIANCE_CTA,
  },
  {
    test: /\b(how (does|do|is)|prove|proof|circuit|groth|snark|circom|poseidon|commitment|zero.?knowledge|zk)\b/,
    answer:
      "The agent generates a Groth16 proof in the browser (circom + snarkjs). The circuit proves two things: it knows a private ID hash and salt that hash, with Poseidon, to the public commitment registered for that agent, and that currentYear − birthYear ≥ 18. " +
      "The server verifies the proof against the verification key and pins the public inputs (current year, minimum age 18) so a prover cannot choose a weaker statement. The private inputs never leave the browser, so no personal data is transmitted.\n\n" +
      DEV_CTA,
  },
  {
    test: /\b(threshold|limit|\$?1,?000|spend|daily|anonymous|micropayment|policy)\b/,
    answer:
      "The policy is simple: under $1,000 of daily spend, payments are anonymous micropayments with no KYC and no data collected. At $1,000/day or more, a valid ZK proof of identity is required. " +
      "The threshold is a single constant in the policy engine, so you can point it at your own risk model.\n\n" +
      COMPLIANCE_CTA,
  },
  {
    test: /\b(ows|wallet|x402|agent|payment rail|chain|caip|open wallet)\b/,
    answer:
      "Vero extends the Open Wallet Standard by registering `vero:kyc` as a wallet-standard feature, so it composes with the existing OWS policy engine instead of adding a parallel one. " +
      "The compliance check sits in front of the payment rail, whether that is x402 or another protocol, and the wallet integration uses CAIP-2 chain identifiers.\n\n" +
      DEV_CTA,
  },
  {
    test: /\b(privacy|pii|personal|private|doxx|identity|secret)\b/,
    answer:
      "Vero proves you have a valid identity without revealing who you are. The private inputs (ID hash, birth year, salt) stay in the browser, and the server only ever sees the proof and three public values: the commitment, the current year and the minimum age. " +
      "The API response for a verified payment reports `piiTransmitted: 0`.\n\n" +
      COMPLIANCE_CTA,
  },
];

const OVERVIEW =
  "Vero Protocol is open-source zero-knowledge compliance for AI agent wallets. Small payments stay anonymous, and larger ones require a proof of a valid identity (age ≥ 18) without revealing any personal data. " +
  "It is MIT-licensed, built on the Open Wallet Standard, and aligned with the FATF R.16 threshold model. Ask me about how the proof works, the spending policy, compliance and audit, or how to fork it.\n\n" +
  DEV_CTA;

const OFFLINE_NOTE = "— Vera is in offline mode: this is a pre-written answer, not a live AI response.";

/** Pick a pre-written answer for the latest user message. Never throws. */
export function offlineVeraReply(latestUserMessage: string): string {
  const text = latestUserMessage.toLowerCase();
  const match = RULES.find((r) => r.test.test(text));
  return `${match ? match.answer : OVERVIEW}\n\n${OFFLINE_NOTE}`;
}
