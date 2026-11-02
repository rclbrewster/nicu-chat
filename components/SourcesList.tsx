export type Source = {
  title?: string;
  source_file?: string | null;
  section?: string | null;
};

export default function SourcesList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <p className="text-[12px] leading-snug tracking-[-0.12px] text-ink-48">
      Sources:{" "}
      {sources.map((s, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {s.title || s.source_file}
        </span>
      ))}
    </p>
  );
}
