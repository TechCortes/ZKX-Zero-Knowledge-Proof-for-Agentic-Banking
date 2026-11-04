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
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-zq-muted mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-2 text-zq-accent">
              <span className="w-1.5 h-1.5 bg-zq-accent" aria-hidden="true"/>
              OWS agent registration
            </span>
            <span className="text-zq-faint">/</span>
            zquent:kyc · FATF-compatible
          </p>

          {/* Privacy callout */}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zq-line border border-zq-line rounded-md overflow-hidden">
            {[
              { label: "0 bytes PII",   sub: "nothing transmitted" },
              { label: "Local compute", sub: "runs entirely in your browser" },
              { label: "Shown once",    sub: "store your ows_key_" },
            ].map((s) => (
              <div key={s.label} className="bg-zq-surface px-4 py-4">
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
