"use client";

import { useEffect, useRef, useState } from "react";
import { LogoIcon } from "@/components/Logo";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How does ZQUENT handle FATF R.16 compliance?",
  "What in ZQUENT is post-quantum today?",
  "How do I fork and deploy ZQUENT?",
];

const MAX_INPUT = 2000;

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_INPUT);
    if (!content || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        setError(data.error ?? "The assistant hit a problem. Please try again.");
        return;
      }
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="Ask ZQUENT"
          className="w-[24rem] max-w-[calc(100vw-2rem)] h-[34rem] max-h-[calc(100dvh-6.5rem)] flex flex-col rounded-md border border-zq-line-strong bg-zq-bg shadow-2xl shadow-black/60 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zq-line bg-zq-surface">
            <LogoIcon size={28}/>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zq-text leading-none">ZQUENT Assistant</p>
              <p className="font-mono text-xs text-zq-muted mt-1.5 leading-none">Protocol &amp; compliance questions</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-zq-muted hover:text-zq-text transition-colors w-11 h-11 -mr-2 inline-flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-zq-soft leading-relaxed mb-3">
                  Ask about FATF R.16 compliance, why zero-knowledge proofs beat traditional KYC for AI agents, what is post-quantum today, or how to deploy ZQUENT yourself.
                </p>
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="block w-full text-left text-sm text-zq-soft hover:text-zq-text px-3 py-2.5 min-h-[44px] rounded border border-zq-line hover:border-zq-line-strong bg-zq-surface transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-zq-raise border border-zq-line-strong text-zq-text"
                      : "bg-zq-surface border border-zq-line text-zq-soft"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-3.5 py-3 rounded bg-zq-surface border border-zq-line flex items-center gap-1" aria-label="The assistant is typing">
                  <span className="w-1.5 h-1.5 bg-zq-muted animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-zq-muted animate-pulse [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-zq-muted animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs text-zq-danger bg-zq-danger/10 border border-zq-danger/30 rounded px-3 py-2">
                {error}
              </p>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 px-3 py-3 border-t border-zq-line"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_INPUT}
              placeholder="Ask ZQUENT…"
              aria-label="Message the ZQUENT Assistant"
              className="flex-1 min-w-0 min-h-[44px] bg-zq-surface border border-zq-line focus:border-zq-accent/60 outline-none rounded px-3.5 py-2.5 text-base sm:text-sm text-zq-text placeholder:text-zq-faint"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="min-h-[44px] px-4 rounded bg-zq-accent hover:bg-zq-accent-strong disabled:opacity-40 disabled:hover:bg-zq-accent text-zq-bg text-sm font-medium transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close the ZQUENT Assistant" : "Ask ZQUENT"}
        aria-expanded={open}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2.5 p-2 sm:pr-4 rounded border border-zq-line-strong bg-zq-surface hover:border-zq-soft shadow-lg shadow-black/50 text-sm text-zq-text transition-colors"
      >
        <LogoIcon size={26}/>
        <span className="hidden sm:inline">{open ? "Close" : "Ask ZQUENT"}</span>
      </button>
    </div>
  );
}
