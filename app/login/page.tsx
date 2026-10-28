"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

const ALLOWED_DOMAINS = (
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "stanford.edu"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function domainOk(email: string) {
  const d = email.split("@")[1]?.toLowerCase();
  return !!d && ALLOWED_DOMAINS.includes(d);
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "domain"
      ? `Only @${ALLOWED_DOMAINS[0]} addresses can sign in.`
      : params.get("error")
        ? "That sign-in link was invalid or expired. Request a new one."
        : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = getBrowserSupabase();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const addr = email.trim().toLowerCase();
    if (!domainOk(addr)) {
      setError(`Enter your @${ALLOWED_DOMAINS[0]} email address.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStage("code");
    setNotice(
      `We sent a sign-in link and a 6-digit code to ${addr}. Click the link, or enter the code below.`,
    );
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
          Sign in with your <span className="text-ink-80">@{ALLOWED_DOMAINS[0]}</span>{" "}
          email address.
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
          <form onSubmit={sendLink} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`you@${ALLOWED_DOMAINS[0]}`}
              className="h-11 w-full rounded-full border border-hairline bg-canvas px-5 text-[17px] tracking-[-0.374px] outline-none placeholder:text-ink-48 focus:border-action"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-full bg-action text-[17px] tracking-[-0.374px] text-white disabled:opacity-40"
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!domainOk(email.trim().toLowerCase())) {
                  setError(`Enter your @${ALLOWED_DOMAINS[0]} email address first.`);
                  return;
                }
                setError(null);
                setStage("code");
              }}
              className="w-full pt-1 text-[14px] tracking-[-0.224px] text-action hover:underline"
            >
              I already have a code
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
