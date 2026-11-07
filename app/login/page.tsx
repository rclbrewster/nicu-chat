"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Disclaimer from "@/components/Disclaimer";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
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
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-parchment px-6">
      <div className="mx-auto w-full max-w-[400px] rounded-[18px] bg-canvas p-8">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.28px]">
          NICU Wayfinder
        </h1>
        <p className="mt-2 text-[17px] tracking-[-0.374px] text-ink-48">
          Enter the access code you were given.
        </p>

        {error && (
          <p className="mt-4 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-3">
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
            disabled={busy || !code.trim()}
            className="h-11 w-full rounded-full bg-action text-[17px] tracking-[-0.374px] text-white disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Enter"}
          </button>
        </form>
      </div>

      <div className="mt-6 max-w-sm">
        <Disclaimer />
      </div>
    </main>
  );
}
