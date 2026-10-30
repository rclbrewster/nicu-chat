"use client";

import { useState } from "react";
import FeedbackDialog from "./FeedbackDialog";

export default function Navbar() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="flex items-center justify-between border-b border-hairline py-4">
      <span className="font-display text-[17px] font-semibold tracking-[-0.374px]">
        Stanford NICU Reference
      </span>
      <div className="flex items-center gap-4 text-[14px] tracking-[-0.224px] text-ink-48">
        <button onClick={() => setFeedbackOpen(true)} className="text-action hover:underline">
          Feedback
        </button>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="text-action hover:underline disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
