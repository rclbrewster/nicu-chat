"use client";

import { useEffect, useRef, useState } from "react";
import ChatMessageBubble, { type ChatMessage } from "./ChatMessageBubble";
import Disclaimer from "./Disclaimer";
import type { Source } from "./SourcesList";

const STARTERS = [
  "What is the delivery room checklist for an abdominal wall defect?",
  "How do you correct hyponatremia?",
  "What are the steps to performing a lumbar puncture?",
  "What is the feeding pathway for a 1 kg infant?",
];

function parseSources(raw: string): Source[] {
  try {
    const bin = atob(raw.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Source[];
  } catch {
    return [];
  }
}

function SendArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ChatWindow({
  initialMessages,
  onMessagesChange,
}: {
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => {
    onMessagesChange?.(messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Jump to the bottom immediately when mounting with an existing
  // conversation (e.g. selected from history).
  useEffect(() => {
    if ((initialMessages?.length ?? 0) > 0) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () =>
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
    );

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };
    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setBusy(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat/retrieval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }

      const sources = parseSources(res.headers.get("x-sources") ?? "");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: acc } : m,
          ),
        );
        scrollToBottom();
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, sources } : m)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
    } finally {
      setBusy(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  }

  const canSend = !busy && input.trim().length > 0;

  const inputForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
      className="flex w-full items-center gap-2 rounded-[12px] border border-hairline bg-parchment py-1.5 pl-5 pr-1.5 focus-within:border-action"
    >
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a NICU reference question…"
        autoFocus={isEmpty}
        className="h-9 flex-1 bg-transparent text-[17px] tracking-[-0.374px] text-ink outline-none placeholder:text-ink-48"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send"
        className={
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] " +
          (canSend ? "bg-action text-white" : "bg-hairline text-ink-80")
        }
      >
        <SendArrowIcon />
      </button>
    </form>
  );

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.28px]">
          How can I help?
        </h1>
        <p className="mt-2 text-[15px] tracking-[-0.224px] text-ink-48">
          Answers come only from the Stanford NICU protocols and guidelines.
        </p>

        <div className="mt-8 w-full max-w-xl">{inputForm}</div>

        <div className="mt-6 w-full max-w-xl divide-y divide-hairline text-left">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="flex w-full items-center gap-3 py-3 text-left hover:bg-parchment"
            >
              <span className="shrink-0 text-ink-48">
                <SearchIcon />
              </span>
              <span className="text-[15px] tracking-[-0.224px] text-ink">{s}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
            {error}
          </p>
        )}

        <div className="mt-8 w-full max-w-xl">
          <Disclaimer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto py-6">
        {messages.map((m, i) => (
          <ChatMessageBubble
            key={m.id}
            message={m}
            question={m.role === "assistant" ? messages[i - 1]?.content : undefined}
          />
        ))}
      </div>

      {error && (
        <p className="mb-2 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 bg-canvas pb-4 pt-4">
        {inputForm}
        <Disclaimer />
      </div>
    </div>
  );
}
