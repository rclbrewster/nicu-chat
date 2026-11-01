"use client";

import { useState } from "react";
import BouncingDots from "./BouncingDots";

const VERBS = [
  "Intubating",
  "Reasoning",
  "Extubating",
  "Titrating",
  "Weaning",
  "Infusing",
  "Repleting",
  "Assessing",
  "Planning",
  "Escalating",
  "Admitting",
  "Discharging",
  "Transferring",
];

export default function LoadingVerb() {
  const [verb] = useState(() => VERBS[Math.floor(Math.random() * VERBS.length)]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[15px] tracking-[-0.224px] text-ink-48">
      {verb}
      <BouncingDots />
    </span>
  );
}
