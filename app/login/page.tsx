"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="mx-auto flex min-h-screen max-w-[400px] flex-col items-center justify-center px-6">
      <div className="w-full rounded-[18px] border border-hairline bg-canvas p-8">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.28px]">
          Stanford NICU Reference
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
            className="h-11 w-full rounded-full border border-hairline bg-canvas px-5 text-[17px] tracking-[-0.374px] outline-none placeholder:text-ink-48 focus:border-action"
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

      <p className="mt-6 max-w-sm text-center text-[12px] leading-relaxed tracking-[-0.12px] text-ink-48">
        Reference aid grounded in unit documents. Not a substitute for
        clinical judgment, unit protocols, or pharmacist review. Do not enter
        patient names, MRNs, or any other PHI.
      </p>
    </main>
  );
}
