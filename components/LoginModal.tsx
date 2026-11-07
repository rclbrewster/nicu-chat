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
  const [issuedCode, setIssuedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Something went wrong. Try again.");
      return;
    }
    setIssuedCode(json.code || "");
    setMode("requested");
  }

  async function continueWithIssuedCode() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: issuedCode }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Something went wrong signing you in. Try entering the code above manually.");
      return;
    }
    onUnlocked();
  }

  async function copyIssuedCode() {
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied -- the code is still shown on screen.
    }
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
                  "h-11 w-full rounded-[12px] text-[17px] tracking-[-0.374px] transition-colors " +
                  (canSubmitCode ? "bg-action text-white" : "bg-hairline text-ink-80")
                }
              >
                {busy ? "Signing in…" : "Enter"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => goTo("request")}
              className="mt-4 w-full text-center text-[14px] tracking-[-0.224px] text-ink-80 hover:text-ink"
            >
              Request access code
            </button>
          </>
        )}

        {mode === "request" && (
          <>
            <p className="mt-2 text-[17px] tracking-[-0.374px] text-ink-48">
              Enter your @stanford.edu email to get the access code instantly.
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
                  "h-11 w-full rounded-[12px] text-[17px] tracking-[-0.374px] transition-colors " +
                  (canSubmitEmail ? "bg-action text-white" : "bg-hairline text-ink-80")
                }
              >
                {busy ? "Checking…" : "Get access code"}
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
              Verified. This is your access code — it also signs you in to
              NICU Wayfinder on every future visit, so save it somewhere safe.
            </p>

            {error && (
              <p className="mt-4 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center gap-2 rounded-[12px] bg-parchment py-1.5 pl-5 pr-2">
              <span className="flex-1 truncate font-mono text-[18px] tracking-[-0.374px] text-ink">
                {issuedCode}
              </span>
              <button
                type="button"
                onClick={copyIssuedCode}
                className="shrink-0 rounded-[8px] px-3 py-2 text-[13px] font-medium tracking-[-0.12px] text-ink-80 hover:bg-hairline hover:text-ink"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <button
              type="button"
              onClick={continueWithIssuedCode}
              disabled={busy}
              className="mt-3 h-11 w-full rounded-[12px] bg-action text-[17px] tracking-[-0.374px] text-white disabled:opacity-40"
            >
              {busy ? "Signing in…" : "Continue"}
            </button>

            <button
              type="button"
              onClick={() => goTo("login")}
              className="mt-4 w-full text-center text-[14px] tracking-[-0.224px] text-ink-48 hover:text-ink-80"
            >
              Back to sign in
            </button>
          </>
        )}

        <hr className="mt-6 border-t border-hairline" />
        <Disclaimer />
      </div>
    </div>
  );
}
