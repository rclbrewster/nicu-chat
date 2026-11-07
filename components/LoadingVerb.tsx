"use client";

import { useEffect, useState } from "react";
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
  const [index, setIndex] = useState(() => Math.floor(Math.random() * VERBS.length));

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % VERBS.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 text-[15px] tracking-[-0.224px] text-ink-48">
      {VERBS[index]}
      <BouncingDots />
    </span>
  );
}
