"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SourcesList, { type Source } from "./SourcesList";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sources?: Source[];
};

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

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
    </div>
  );
}
