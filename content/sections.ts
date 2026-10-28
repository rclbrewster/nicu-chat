/**
 * NICU knowledge-base sections. The source of truth is sections.json so that
 * the plain-Node ingest/convert scripts and the Next.js app agree.
 *
 * Every Markdown file in content/markdown/ must declare a `section:` in its
 * frontmatter that exactly matches one of these strings.
 */
import sectionsData from "./sections.json";

export const SECTIONS = sectionsData.sections as readonly string[];
export type Section = string;
export const UNSET_SECTION = "UNSET";

export function isValidSection(value: unknown): value is Section {
  return typeof value === "string" && SECTIONS.includes(value);
}
