"use client";

import { useState } from "react";
import FeedbackDialog from "./FeedbackDialog";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="relative flex items-center justify-between border-b border-hairline py-4">
      <span className="font-display text-[17px] font-semibold tracking-[-0.374px]">
        Stanford NICU Reference
      </span>

      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-80 hover:bg-hairline"
      >
        {menuOpen ? (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M4.5 4.5l11 11M15.5 4.5l-11 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 5.5h14M3 10h14M3 14.5h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {menuOpen && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-48 overflow-hidden rounded-[11px] border border-hairline bg-canvas py-1.5">
          <button
            onClick={() => {
              setMenuOpen(false);
              setFeedbackOpen(true);
            }}
            className="block w-full px-4 py-2 text-left text-[14px] tracking-[-0.224px] text-ink-80 hover:bg-parchment"
          >
            Feedback
          </button>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="block w-full px-4 py-2 text-left text-[14px] tracking-[-0.224px] text-ink-80 hover:bg-parchment disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
