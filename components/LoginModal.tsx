"use client";

import { useState } from "react";
import Disclaimer from "./Disclaimer";

type Mode = "login" | "request" | "requested";

export default function LoginModal({
  open,
  onUnlocked,
}: {
  open: boolean;
  onUnlocked: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canSubmitCode = !busy && code.trim().length > 0;
  const canSubmitEmail = !busy && email.trim().length > 0;

  function goTo(next: Mode) {
    setError(null);
    setMode(next);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Something went wrong. Try again.");
      return;
    }
    onUnlocked();
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Something went wrong. Try again.");
      return;
    }
    setMode("requested");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/40 px-6">
      <div className="w-full max-w-[400px] rounded-[18px] bg-canvas p-8">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.28px]">
          NICU Wayfinder
        </h1>

        {mode === "login" && (
          <>
            <p className="mt-2 text-[17px] tracking-[-0.374px] text-ink-48">
              Enter the access code you were given.
            </p>

            {error && (
              <p className="mt-4 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
                {error}
              </p>
            )}

            <form onSubmit={submitCode} className="mt-6 space-y-3">
              <input
                type="password"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Access code"
                className="h-11 w-full rounded-[12px] bg-parchment px-5 text-[17px] tracking-[-0.374px] outline-none placeholder:text-ink-48"
              />
              <button
                type="submit"
                disabled={!canSubmitCode}
                className={
                  "h-11 w-full rounded-full text-[17px] tracking-[-0.374px] transition-colors " +
                  (canSubmitCode ? "bg-action text-white" : "bg-hairline text-ink-80")
                }
              >
                {busy ? "Signing in…" : "Enter"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => goTo("request")}
              className="mt-4 w-full text-center text-[14px] tracking-[-0.224px] text-ink-48 hover:text-ink-80"
            >
              Request access code
            </button>
          </>
        )}

        {mode === "request" && (
          <>
            <p className="mt-2 text-[17px] tracking-[-0.374px] text-ink-48">
              Enter your email. It&rsquo;ll be reviewed and a code sent back to you.
            </p>

            {error && (
              <p className="mt-4 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
                {error}
              </p>
            )}

            <form onSubmit={submitRequest} className="mt-6 space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@stanford.edu"
                className="h-11 w-full rounded-[12px] bg-parchment px-5 text-[17px] tracking-[-0.374px] outline-none placeholder:text-ink-48"
              />
              <button
                type="submit"
                disabled={!canSubmitEmail}
                className={
                  "h-11 w-full rounded-full text-[17px] tracking-[-0.374px] transition-colors " +
                  (canSubmitEmail ? "bg-action text-white" : "bg-hairline text-ink-80")
                }
              >
                {busy ? "Sending…" : "Send request"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => goTo("login")}
              className="mt-4 w-full text-center text-[14px] tracking-[-0.224px] text-ink-48 hover:text-ink-80"
            >
              Back to sign in
            </button>
          </>
        )}

        {mode === "requested" && (
          <>
            <p className="mt-2 text-[17px] tracking-[-0.374px] text-ink-48">
              Request sent. We&rsquo;ll review it and send you an access code.
            </p>
            <button
              type="button"
              onClick={() => goTo("login")}
              className="mt-6 h-11 w-full rounded-full border border-hairline text-[15px] tracking-[-0.224px] text-ink-80"
            >
              Back to sign in
            </button>
          </>
        )}

        <Disclaimer />
      </div>
    </div>
  );
}
