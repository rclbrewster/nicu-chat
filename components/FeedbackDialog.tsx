"use client";

import { useState } from "react";
import type { Source } from "./SourcesList";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "wrong_answer", label: "Answer seems wrong" },
  { value: "outdated", label: "Answer seems outdated" },
  { value: "missing_info", label: "Missing information" },
  { value: "bug", label: "Something's broken" },
  { value: "other", label: "Other" },
];

export type FeedbackContext = {
  question?: string;
  answer?: string;
  sources?: Source[];
};

export default function FeedbackDialog({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context?: FeedbackContext;
}) {
  const [category, setCategory] = useState(
    context?.question ? "wrong_answer" : "other",
  );
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  function reset() {
    setComment("");
    setError(null);
    setDone(false);
    setCategory(context?.question ? "wrong_answer" : "other");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Add a short description.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        comment: comment.trim(),
        question: context?.question,
        answer: context?.answer,
        sources: context?.sources,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not send feedback. Try again.");
      return;
    }
    setDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => {
        reset();
        onClose();
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-[18px] border border-hairline bg-canvas p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 className="font-display text-[21px] font-semibold tracking-[-0.374px]">
              Thanks
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed tracking-[-0.224px] text-ink-48">
              Your feedback was sent.
            </p>
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              className="mt-5 h-11 w-full rounded-full bg-action text-[17px] tracking-[-0.374px] text-white"
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="font-display text-[21px] font-semibold tracking-[-0.374px]">
              Report an issue
            </h2>
            {context?.question && (
              <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed tracking-[-0.12px] text-ink-48">
                About: &ldquo;{context.question}&rdquo;
              </p>
            )}

            <label className="mt-4 block text-[12px] font-semibold tracking-[-0.12px] text-ink-80">
              What&rsquo;s wrong?
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-full border border-hairline bg-canvas px-5 text-[15px] tracking-[-0.224px] outline-none focus:border-action"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-[12px] font-semibold tracking-[-0.12px] text-ink-80">
              Details
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What happened, and what did you expect instead?"
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-hairline bg-canvas p-3 text-[15px] leading-relaxed tracking-[-0.224px] outline-none placeholder:text-ink-48 focus:border-action"
            />

            {error && (
              <p className="mt-2 text-[13px] tracking-[-0.224px] text-[color:var(--danger)]">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="h-11 flex-1 rounded-full border border-hairline text-[15px] tracking-[-0.224px] text-ink-80"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-11 flex-1 rounded-full bg-action text-[15px] tracking-[-0.224px] text-white disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
