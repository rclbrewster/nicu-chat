#!/usr/bin/env node
/**
 * One-time helper: apply an initial `section:` (and optional `convert_with:`)
 * to each file in content/markdown/. Edit the MAP below and re-run any time.
 * Safe to run repeatedly — it only rewrites frontmatter, never the body.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const DIR = path.join(ROOT, "content", "markdown");

// slug (filename without .md)  ->  [section, convertWith?]
const MAP = {
  "1-1-5-kg-feeding-pathway_2025": ["Feeding & Gastrointestinal", "vision"],
  "less-than-1-kg-feeding-pathway_2025": ["Feeding & Gastrointestinal", "vision"],
  "infant-feeding-1501-2000g": ["Feeding & Gastrointestinal", "vision"],
  "2018-procedures-guide_final-1": ["Procedures & Line Management"],
  "2018_nicu_guide_final-2": ["Admission & General Care"],
  "aortic-arch-watch-1": ["Cardiovascular", "vision"],
  "awd": ["Delivery Room & Resuscitation", "vision"],
  "cdh-1": ["Delivery Room & Resuscitation", "vision"],
  "hydrops": ["Delivery Room & Resuscitation", "vision"],
  "ntd": ["Delivery Room & Resuscitation", "vision"],
  "preemie": ["Delivery Room & Resuscitation", "vision"],
  "surfactant-pathway-2026-updated-1-1": ["Respiratory & Ventilation", "vision"],
  "neonatal-asymptomatic-hypoglycemia": ["Fluids, Electrolytes & Glucose", "vision"],
  "lisa-salsa-tip-sheet-1-3": ["Respiratory & Ventilation"],
  "lpch-neuronicu-seizure-management-guidelines-update-sept2021-v3": ["Neurology & Neuroprotection"],
  "therapeutic-hypothermia-criteria": ["Neurology & Neuroprotection"],
  "tip-sheet-for-hie-1": ["Neurology & Neuroprotection"],
};

for (const [slug, [section, convertWith]] of Object.entries(MAP)) {
  const file = path.join(DIR, `${slug}.md`);
  let raw;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch {
    console.warn(`skip (missing): ${slug}.md`);
    continue;
  }
  const parsed = matter(raw);
  parsed.data.section = section;
  if (convertWith) parsed.data.convert_with = convertWith;
  else delete parsed.data.convert_with;
  await fs.writeFile(file, matter.stringify(parsed.content, parsed.data), "utf-8");
  console.log(`${slug}.md -> ${section}${convertWith ? "  [vision]" : ""}`);
}
