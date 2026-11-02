"use client";

import type { ChatMessage } from "./ChatMessageBubble";

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path
        d="M4.5 4.5l11 11M15.5 4.5l-11 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HistorySidebar({
  history,
  activeId,
  onSelect,
  onDelete,
}: {
  history: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-hairline bg-parchment px-3 py-5 md:block">
      <p className="px-2 font-display text-[15px] font-semibold tracking-[-0.224px] text-ink">
        Stanford NICU Reference
      </p>
      <p className="mt-5 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-48">
        Recent
      </p>
      <nav className="mt-2 space-y-0.5">
        {history.map((c) => (
          <div key={c.id} className="group relative">
            <button
              onClick={() => onSelect(c.id)}
              title={c.title}
              className={
                "block w-full truncate rounded-[8px] px-2 py-1.5 pr-7 text-left text-[14px] tracking-[-0.224px] text-ink-80 " +
                (c.id === activeId ? "bg-hairline" : "hover:bg-divider")
              }
            >
              {c.title}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              aria-label="Delete conversation"
              className="absolute right-1 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-ink-48 hover:bg-hairline hover:text-ink-80 group-hover:flex"
            >
              <DeleteIcon />
            </button>
          </div>
        ))}
        {history.length === 0 && (
          <p className="px-2 py-1.5 text-[13px] text-ink-48">
            No conversations yet
          </p>
        )}
      </nav>
    </aside>
  );
}
