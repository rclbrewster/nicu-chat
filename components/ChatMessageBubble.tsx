"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SourcesList, { type Source } from "./SourcesList";
import FeedbackDialog from "./FeedbackDialog";
import LoadingVerb from "./LoadingVerb";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sources?: Source[];
};

function ThumbUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4.5-7a2 2 0 0 1 3.5 1.5L14 9h5a2 2 0 0 1 2 2.3l-1.5 7A2 2 0 0 1 17.5 20H10a3 3 0 0 1-3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 14V3H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3Zm0 0 4.5 7a2 2 0 0 0 3.5-1.5L14 15h5a2 2 0 0 0 2-2.3l-1.5-7A2 2 0 0 0 17.5 4H10a3 3 0 0 0-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ChatMessageBubble({
  message,
  question,
}: {
  message: ChatMessage;
  question?: string;
}) {
  const isUser = message.role === "user";
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [sendingUp, setSendingUp] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[18px] bg-action px-4 py-2.5 text-[17px] leading-snug tracking-[-0.374px] text-white">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  async function thumbsUp() {
    if (vote || sendingUp) return;
    setSendingUp(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "positive",
        comment: "Helpful",
        question,
        answer: message.content,
        sources: message.sources,
      }),
    });
    setSendingUp(false);
    if (res.ok) setVote("up");
  }

  return (
    <div className="rounded-[18px] bg-canvas px-5 py-4">
      {message.content ? (
        <div className="prose-answer">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      ) : (
        <LoadingVerb />
      )}
      {message.sources && <SourcesList sources={message.sources} />}
      {message.content && (
        <div className="mt-3 flex justify-end gap-1">
          <button
            onClick={thumbsUp}
            disabled={!!vote}
            aria-label="Helpful"
            className={
              "flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-100 " +
              (vote === "up"
                ? "text-action"
                : "text-ink-48 hover:bg-parchment hover:text-ink-80")
            }
          >
            <ThumbUpIcon />
          </button>
          <button
            onClick={() => {
              setVote("down");
              setFeedbackOpen(true);
            }}
            disabled={!!vote}
            aria-label="Report an issue"
            className={
              "flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-100 " +
              (vote === "down"
                ? "text-action"
                : "text-ink-48 hover:bg-parchment hover:text-ink-80")
            }
          >
            <ThumbDownIcon />
          </button>
        </div>
      )}
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        context={{ question, answer: message.content, sources: message.sources }}
      />
    </div>
  );
}
