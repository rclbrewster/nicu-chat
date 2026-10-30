"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SourcesList, { type Source } from "./SourcesList";
import FeedbackDialog from "./FeedbackDialog";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sources?: Source[];
};

export default function ChatMessageBubble({
  message,
  question,
}: {
  message: ChatMessage;
  question?: string;
}) {
  const isUser = message.role === "user";
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[18px] bg-action px-4 py-2.5 text-[17px] leading-snug tracking-[-0.374px] text-white">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] bg-canvas px-5 py-4">
      <div className="prose-answer">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content || "…"}
        </ReactMarkdown>
      </div>
      {message.sources && <SourcesList sources={message.sources} />}
      {message.content && (
        <button
          onClick={() => setFeedbackOpen(true)}
          className="mt-3 text-[12px] tracking-[-0.12px] text-ink-48 hover:text-action hover:underline"
        >
          Report an issue with this answer
        </button>
      )}
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        context={{ question, answer: message.content, sources: message.sources }}
      />
    </div>
  );
}
