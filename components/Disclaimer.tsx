export default function Disclaimer() {
  return (
    <div className="mt-4 rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-[12px] leading-relaxed tracking-[-0.12px]">
      <p className="text-ink-48">
        <span className="font-semibold text-ink-80">Reference aid only.</span>{" "}
        Answers are drawn from this unit&rsquo;s uploaded documents and may be
        incomplete or out of date. Not a substitute for clinical judgment,
        current unit protocols, or pharmacist review. Verify doses
        independently.
      </p>
      <p className="mt-1.5 font-semibold text-ink-80">
        Do not enter patient names, MRNs, dates of birth, or any other PHI in
        your questions.
      </p>
    </div>
  );
}
