import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import AgentRegistrationWizard from "@/components/AgentRegistrationWizard";

export const metadata: Metadata = {
  title: "Register an agent — ZQUENT",
  description:
    "Register an OWS-compatible agent with ZQUENT zquent:kyc compliance. KYC commitment derived locally — no PII transmitted.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zq-bg text-zq-text overflow-x-hidden">
      <SiteNav base="/" />

      <main className="pt-28 md:pt-32 pb-24 px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-xl mx-auto mb-10">
          <p className="inline-flex items-center gap-2.5 px-3 py-1.5 mb-6 rounded-full border border-zq-line-strong bg-zq-surface text-sm text-zq-muted">
            <span className="w-2 h-2 rounded-full bg-zq-success" aria-hidden="true"/>
            OWS agent registration · zquent:kyc · FATF-compatible
          </p>

          {/* Privacy callout */}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "0 bytes PII",   sub: "nothing transmitted" },
              { label: "Local compute", sub: "runs entirely in your browser" },
              { label: "Shown once",    sub: "store your ows_key_" },
            ].map((s) => (
              <div key={s.label} className="bg-zq-surface border border-zq-line rounded-md px-4 py-4">
                <dt className="font-mono text-sm text-zq-text">{s.label}</dt>
                <dd className="text-xs text-zq-muted mt-1">{s.sub}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Wizard */}
        <AgentRegistrationWizard />
      </main>
    </div>
  );
}
