"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import FeedbackDialog from "./FeedbackDialog";

export default function Navbar({ email }: { email: string }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="flex items-center justify-between border-b border-hairline py-4">
      <span className="font-display text-[17px] font-semibold tracking-[-0.374px]">
        Stanford NICU Reference
      </span>
      <div className="flex items-center gap-4 text-[14px] tracking-[-0.224px] text-ink-48">
        <span className="hidden sm:inline">{email}</span>
        <button onClick={() => setFeedbackOpen(true)} className="text-action hover:underline">
          Feedback
        </button>
        <button onClick={signOut} className="text-action hover:underline">
          Sign out
        </button>
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
