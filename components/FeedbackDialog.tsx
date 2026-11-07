"use client";

import { useState } from "react";
import type { Source } from "./SourcesList";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "outdated", label: "Outdated" },
  { value: "missing_info", label: "Missing info" },
  { value: "bug", label: "Something's broken" },
  { value: "other", label: "Other" },
];

export type FeedbackContext = {
  question?: string;
  answer?: string;
  sources?: Source[];
};

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M4.5 4.5l11 11M15.5 4.5l-11 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function FeedbackDialog({
  open,
  onClose,
  context,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  context?: FeedbackContext;
  onSubmitted?: () => void;
}) {
  const [categories, setCategories] = useState<string[]>(
    context?.question ? ["wrong_answer"] : [],
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
    setCategories(context?.question ? ["wrong_answer"] : []);
  }

  function close() {
    reset();
    onClose();
  }

  function toggleCategory(value: string) {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (categories.length === 0) {
      setError("Select at least one category.");
      return;
    }
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
        categories,
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
    onSubmitted?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={close}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[18px] border border-hairline bg-canvas p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-48 hover:bg-parchment hover:text-ink"
        >
          <CloseIcon />
        </button>

        {done ? (
          <>
            <h2 className="font-display text-[21px] font-semibold tracking-[-0.374px]">
              Thanks
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed tracking-[-0.224px] text-ink-48">
              Your feedback was sent.
            </p>
            <button
              onClick={close}
              className="mt-5 h-11 w-full rounded-[12px] bg-action text-[17px] tracking-[-0.374px] text-white"
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
              <p className="mt-2 line-clamp-2 pr-6 text-[12px] leading-relaxed tracking-[-0.12px] text-ink-48">
                About: &ldquo;{context.question}&rdquo;
              </p>
            )}

            <label className="mt-4 block text-[12px] font-semibold tracking-[-0.12px] text-ink-80">
              What&rsquo;s wrong?
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const selected = categories.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCategory(c.value)}
                    aria-pressed={selected}
                    className={
                      "rounded-full px-4 py-2 text-[14px] tracking-[-0.224px] transition-colors " +
                      (selected ? "bg-action text-white" : "bg-parchment text-ink-80")
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block text-[12px] font-semibold tracking-[-0.12px] text-ink-80">
              Details
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What happened, and what did you expect instead?"
              rows={4}
              className="mt-1.5 w-full rounded-lg bg-parchment p-3 text-[15px] leading-relaxed tracking-[-0.224px] outline-none placeholder:text-ink-48 focus:border focus:border-ink"
            />

            {error && (
              <p className="mt-2 text-[13px] tracking-[-0.224px] text-[color:var(--danger)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 h-11 w-full rounded-[12px] bg-action text-[15px] tracking-[-0.224px] text-white disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
