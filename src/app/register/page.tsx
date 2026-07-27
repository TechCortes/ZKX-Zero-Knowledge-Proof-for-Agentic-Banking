import type { Metadata } from "next";
import { LogoWordmark } from "@/components/Logo";
import AgentRegistrationWizard from "@/components/AgentRegistrationWizard";

export const metadata: Metadata = {
  title: "Register Agent — ZKX",
  description:
    "Register an OWS-compatible agent with ZKX zkx:kyc compliance. KYC commitment derived locally — no PII transmitted.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#04040a] text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.04] bg-[#04040a]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <LogoWordmark />
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/#demo"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Live Demo
            </a>
            <a
              href="/"
              className="text-xs font-semibold text-slate-300 hover:text-white transition-colors border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg"
            >
              ← Back
            </a>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="pt-28 pb-24 px-6">

        {/* Header */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-300 font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"/>
            OWS Agent Registration · zkx:kyc · FATF-Compatible
          </div>

          {/* Privacy callout */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "0 bytes PII",    sub: "nothing transmitted"    },
              { label: "Local compute",  sub: "Poseidon runs in-browser"},
              { label: "Shown once",     sub: "store your ows_key_"    },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-3 text-center">
                <p className="text-sm font-bold text-white font-mono">{s.label}</p>
                <p className="text-xs text-slate-700 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard */}
        <AgentRegistrationWizard />
      </main>
    </div>
  );
}
