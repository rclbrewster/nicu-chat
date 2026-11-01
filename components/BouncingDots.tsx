export default function BouncingDots({ size = 5 }: { size?: number }) {
  const dot = { width: size, height: size };
  return (
    <span className="inline-flex items-center gap-[3px]">
      <span className="dot-bounce dot-bounce-1 rounded-full bg-current" style={dot} />
      <span className="dot-bounce dot-bounce-2 rounded-full bg-current" style={dot} />
      <span className="dot-bounce dot-bounce-3 rounded-full bg-current" style={dot} />
    </span>
  );
}
