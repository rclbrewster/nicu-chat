"use client";

import { useRef, useState } from "react";
import ChatMessageBubble, { type ChatMessage } from "./ChatMessageBubble";
import type { Source } from "./SourcesList";

const SOURCE_SENTINEL = "\n\n__SOURCES__";

const STARTERS = [
  "Empiric antibiotics for suspected early-onset sepsis",
  "Starting parenteral nutrition on day 1",
  "Indomethacin dosing for a symptomatic PDA",
  "Phototherapy thresholds for a 34-week infant",
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

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });

        const sentinelAt = acc.indexOf(SOURCE_SENTINEL);
        const visible = sentinelAt >= 0 ? acc.slice(0, sentinelAt) : acc;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: visible } : m,
          ),
        );
        scrollToBottom();
      }

      const sentinelAt = acc.indexOf(SOURCE_SENTINEL);
      if (sentinelAt >= 0) {
        const sources = parseSources(
          acc.slice(sentinelAt + SOURCE_SENTINEL.length).trim(),
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: acc.slice(0, sentinelAt), sources }
              : m,
          ),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  return (
    <div className="flex flex-1 flex-col py-6">
      <div
        ref={scrollRef}
        className="flex-1 space-y-5 overflow-y-auto pb-6"
        style={{ minHeight: "52vh" }}
      >
        {messages.length === 0 && (
          <div className="mt-10">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.28px]">
              What do you need to look up?
            </h1>
            <p className="mt-2 text-[17px] tracking-[-0.374px] text-ink-48">
              Answers come only from this unit&rsquo;s loaded documents.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-hairline bg-canvas px-4 py-2 text-[14px] tracking-[-0.224px] text-ink-80 hover:border-ink-48"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <ChatMessageBubble key={m.id} message={m} />
        ))}
      </div>

      {error && (
        <p className="mb-3 text-[14px] tracking-[-0.224px] text-[color:var(--danger)]">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 flex gap-2.5 border-t border-hairline bg-parchment py-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a NICU reference question…"
          className="h-11 flex-1 rounded-full border border-hairline bg-canvas px-5 text-[17px] tracking-[-0.374px] text-ink outline-none placeholder:text-ink-48 focus:border-action"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="h-11 shrink-0 rounded-full bg-action px-6 text-[17px] tracking-[-0.374px] text-white disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
