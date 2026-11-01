"use client";

import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import ChatWindow from "./ChatWindow";
import HistorySidebar, { type Conversation } from "./HistorySidebar";
import type { ChatMessage } from "./ChatMessageBubble";

const STORAGE_KEY = "nicu-chat:history";
const MAX_HISTORY = 30;
const TITLE_MAX = 48;

function loadHistory(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(list: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage unavailable (private browsing, etc.) — history just won't persist.
  }
}

function titleFrom(messages: ChatMessage[]): string {
  const text = messages.find((m) => m.role === "user")?.content.trim() ?? "";
  if (!text) return "New chat";
  return text.length > TITLE_MAX ? text.slice(0, TITLE_MAX) + "…" : text;
}

export default function ChatShell() {
  const [history, setHistory] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    setActiveId(crypto.randomUUID());
  }, []);

  function handleMessagesChange(id: string, messages: ChatMessage[]) {
    if (messages.length === 0) return;
    setHistory((prev) => {
      const next = [
        { id, title: titleFrom(messages), messages, updatedAt: Date.now() },
        ...prev.filter((c) => c.id !== id),
      ];
      saveHistory(next);
      return next;
    });
  }

  function newChat() {
    setActiveId(crypto.randomUUID());
    setActiveMessages([]);
  }

  function selectConversation(id: string) {
    const conv = history.find((c) => c.id === id);
    if (!conv) return;
    setActiveId(id);
    setActiveMessages(conv.messages);
  }

  if (!activeId) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <HistorySidebar
        history={history}
        activeId={activeId}
        onSelect={selectConversation}
      />
      <div className="mx-auto flex h-screen w-full max-w-[760px] flex-1 flex-col overflow-hidden px-5">
        <Navbar onNewChat={newChat} />
        <ChatWindow
          key={activeId}
          initialMessages={activeMessages}
          onMessagesChange={(msgs) => handleMessagesChange(activeId, msgs)}
        />
      </div>
    </div>
  );
}
