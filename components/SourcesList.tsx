"use client";

import { useState } from "react";

export type Source = {
  title?: string;
  source_file?: string | null;
  section?: string | null;
};

export default function SourcesList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] tracking-[-0.12px] text-ink-48 hover:text-ink-80 hover:underline"
      >
        {open ? "Hide" : "Show"} sources ({sources.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 text-[14px] tracking-[-0.224px]">
          {sources.map((s, i) => (
            <li key={i} className="text-ink-80">
              <span className="font-semibold">{s.title || s.source_file}</span>
              {s.section && <span className="text-ink-48"> · {s.section}</span>}
              {s.source_file && s.source_file !== s.title && (
                <span className="block text-ink-48">{s.source_file}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
