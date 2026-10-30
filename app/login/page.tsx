"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMEMBERED_CODE_KEY = "nicu-chat:access-code";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [rememberedCode, setRememberedCode] = useState(false);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link"
      ? "That sign-in link was invalid or expired — use the code instead."
      : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = getBrowserSupabase();

  // This device has already proven it knows the access code — don't ask again.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_CODE_KEY);
      if (saved) {
        setAccessCode(saved);
        setRememberedCode(true);
      }
    } catch {
      // localStorage unavailable (private browsing, etc.) — just ask every time.
    }
  }, []);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!accessCode.trim()) {
      setError("Enter the access code you were given.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addr, code: accessCode.trim() }),
    });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Wrong/rotated code — forget whatever this device had saved and ask again.
      try {
        localStorage.removeItem(REMEMBERED_CODE_KEY);
      } catch {}
      setRememberedCode(false);
      setError(json.error || "Could not send a code. Try again.");
      return;
    }
    try {
      localStorage.setItem(REMEMBERED_CODE_KEY, accessCode.trim());
    } catch {}
    setStage("code");
    setNotice(`Enter the code we just emailed to ${addr}.`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[400px] flex-col items-center justify-center px-6">
      <div className="w-full rounded-[18px] border border-hairline bg-canvas p-8">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.28px]">
          NICU Reference
        </h1>
        <p className="mt-2 text-[17px] tracking-[-0.374px] text-ink-48">
          {rememberedCode
            ? "Enter your email to get a sign-in code."
            : "Enter your email and the access code you were given."}
        </p>

        {error && (
          <p className="mt-4 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-md bg-parchment px-3 py-2 text-[14px] leading-relaxed tracking-[-0.224px] text-ink-80">
            {notice}
          </p>
        )}

        {stage === "email" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full rounded-full border border-hairline bg-canvas px-5 text-[17px] tracking-[-0.374px] outline-none placeholder:text-ink-48 focus:border-action"
            />
            {!rememberedCode && (
              <input
                type="password"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Access code"
                className="h-11 w-full rounded-full border border-hairline bg-canvas px-5 text-[17px] tracking-[-0.374px] outline-none placeholder:text-ink-48 focus:border-action"
              />
            )}
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-full bg-action text-[17px] tracking-[-0.374px] text-white disabled:opacity-40"
            >
              {busy ? "Sending…" : "Email me a code"}
            </button>
            {rememberedCode && (
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(REMEMBERED_CODE_KEY);
                  } catch {}
                  setAccessCode("");
                  setRememberedCode(false);
                }}
                className="w-full pt-1 text-[14px] tracking-[-0.224px] text-ink-48 hover:underline"
              >
                Not your device? Clear saved access code
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!EMAIL_RE.test(email.trim().toLowerCase())) {
                  setError("Enter your email address first.");
                  return;
                }
                setError(null);
                setStage("code");
              }}
              className="w-full pt-1 text-[14px] tracking-[-0.224px] text-action hover:underline"
            >
              I already have a sign-in code
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-3">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code from the email"
              className="h-11 w-full rounded-full border border-hairline bg-canvas px-5 text-center text-[17px] tracking-[0.2em] outline-none placeholder:tracking-[-0.374px] placeholder:text-ink-48 focus:border-action"
            />
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="h-11 w-full rounded-full bg-action text-[17px] tracking-[-0.374px] text-white disabled:opacity-40"
            >
              {busy ? "Verifying…" : "Verify code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setNotice(null);
                setError(null);
              }}
              className="w-full pt-1 text-[14px] tracking-[-0.224px] text-action hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 max-w-sm text-center text-[12px] leading-relaxed tracking-[-0.12px] text-ink-48">
        Reference aid grounded in unit documents. Not a substitute for clinical
        judgment, unit protocols, or pharmacist review.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
