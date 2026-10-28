#!/usr/bin/env node
/**
 * convert.mjs — turn raw source documents into reviewed Markdown.
 *
 *   content/sources/**  (PDF, JPG, PNG, WEBP, TIFF, screenshots)
 *        ──►  content/markdown/<slug>.md   (one file per source, with frontmatter)
 *
 * Scanned pages and images are transcribed to Markdown by an OpenAI vision
 * model. Text-native PDFs use their embedded text layer (no vision call).
 * Results are cached by source-file hash in content/.cache/ so re-runs are cheap.
 *
 * This script never touches the database. After it runs:
 *   1. open each content/markdown/*.md
 *   2. fix any transcription errors (check tables and doses!)
 *   3. set `section:` to a value from content/sections.json
 *   4. run `npm run ingest`
 *
 * Usage:
 *   npm run convert                 # convert everything new/changed
 *   npm run convert -- --force      # re-convert even if unchanged
 *   npm run convert -- path/to/one.pdf
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import matter from "gray-matter";
import OpenAI from "openai";
import sharp from "sharp";
import { pdfToPng } from "pdf-to-png-converter";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
config({ path: path.join(ROOT, ".env.local") });

const SOURCES_DIR = path.join(ROOT, "content", "sources");
const MARKDOWN_DIR = path.join(ROOT, "content", "markdown");
const CACHE_DIR = path.join(ROOT, "content", ".cache");
const VISION_MODEL = process.env.VISION_MODEL ?? "gpt-4o";
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff", ".bmp"]);
const TEXT_PDF_MIN_CHARS_PER_PAGE = 180;

const TRANSCRIBE_PROMPT = `You are transcribing a page from a clinical reference document used in a neonatal intensive care unit.

Convert everything visible on this page to clean GitHub-Flavored Markdown:
- Preserve the heading hierarchy (#, ##, ###).
- Reproduce every table as a Markdown table. Keep column headers and every row. Do not summarize or drop rows.
- Transcribe all numbers, doses, concentrations, rates, weights and age cutoffs EXACTLY as written, including units.
- Keep bullet and numbered lists.
- For a figure, flowchart or image, write a short italic description in brackets, e.g. *[Flowchart: escalation of respiratory support]*, and transcribe any text/labels it contains.
- Do not add commentary, disclaimers, or content that is not on the page.
- If the page is blank or unreadable, output exactly: (no readable content)

Output only the Markdown.`;

const args = process.argv.slice(2);
const force = args.includes("--force");
const forceVisionAll = args.includes("--vision");
const explicitTargets = args.filter((a) => !a.startsWith("--"));

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY (set it in .env.local)");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function slugify(relPath) {
  return relPath
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/]+/g, "__")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function titleFromName(relPath) {
  const base = path.basename(relPath).replace(/\.[^.]+$/, "");
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function transcribeImage(pngBuffer) {
  const b64 = pngBuffer.toString("base64");
  const res = await openai.chat.completions.create({
    model: VISION_MODEL,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TRANSCRIBE_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${b64}`, detail: "high" },
          },
        ],
      },
    ],
  });
  let out = (res.choices[0]?.message?.content ?? "").trim();
  // The model sometimes wraps the whole page in a ```markdown fence — unwrap it.
  const fence = out.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  if (fence) out = fence[1].trim();
  if (/^\(no readable content\)$/i.test(out)) out = "";
  return out;
}

async function normalizeImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

/** Returns { pages: string[], mode: "text" | "vision" } */
async function extractSource(absPath, ext, { forceVision = false } = {}) {
  if (ext === ".pdf") {
    const data = await fs.readFile(absPath);
    let parsed;
    try {
      parsed = await pdfParse(data);
    } catch {
      parsed = null;
    }
    const numPages = parsed?.numpages ?? 1;
    const text = (parsed?.text ?? "").trim();
    if (!forceVision && text.length >= numPages * TEXT_PDF_MIN_CHARS_PER_PAGE) {
      // Solid embedded text layer. Keep it as one blob (form feeds are
      // unreliable) but report the real page count so multi-page docs are
      // obvious in review.
      return { pages: [text], pageCount: numPages, mode: "text" };
    }
    // Scanned / image-only PDF: render each page and transcribe.
    const rendered = await pdfToPng(data, { viewportScale: 2.0 });
    const pages = [];
    for (let i = 0; i < rendered.length; i++) {
      process.stdout.write(`    page ${i + 1}/${rendered.length}\r`);
      const png = await normalizeImage(rendered[i].content);
      pages.push(await transcribeImage(png));
    }
    process.stdout.write("\n");
    return { pages, mode: "vision" };
  }

  if (ext === ".docx") {
    const buffer = await fs.readFile(absPath);
    const { value } = await mammoth.convertToMarkdown({ buffer });
    // Strip inlined images — mammoth embeds them as huge base64 data URIs.
    // Screenshots pasted into a Word doc are NOT transcribed.
    const droppedImages = (value.match(/data:image|<img/g) ?? []).length;
    const md = value
      .replace(/!\[[^\]]*\]\(data:[^)]*\)/g, "")
      .replace(/<img[^>]*>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (droppedImages) {
      console.warn(
        `    note: this .docx contains image(s) that were NOT transcribed. ` +
          `If they carry clinical content (tables, flowcharts), export those ` +
          `pages as PDF/PNG and add them to content/sources/ separately.`,
      );
    }
    if (!md) throw new Error("no extractable text (image-only .docx?)");
    return { pages: [md], mode: "text" };
  }

  if (ext === ".doc") {
    throw new Error(
      "legacy .doc format is not supported — open it in Word and Save As .docx (or PDF), then re-run",
    );
  }

  if (IMAGE_EXT.has(ext)) {
    const buffer = await fs.readFile(absPath);
    const png = await normalizeImage(buffer);
    return { pages: [await transcribeImage(png)], mode: "vision" };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function buildMarkdown({ title, sourceFile, section, convertWith, pages, pageCount, mode }) {
  const body = pages
    .map((p, i) =>
      pages.length > 1 ? `<!-- page ${i + 1} -->\n\n${p}` : p,
    )
    .join("\n\n");

  const fm = {
    title,
    source_file: sourceFile,
    section,
    ...(convertWith ? { convert_with: convertWith } : {}),
    pages: pageCount ?? pages.length,
    conversion_mode: mode,
    converted_at: new Date().toISOString(),
  };
  return matter.stringify(`\n${body}\n`, fm);
}

async function main() {
  await fs.mkdir(MARKDOWN_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });

  let files = (await walk(SOURCES_DIR)).filter((f) =>
    [".pdf", ".docx", ".doc", ...IMAGE_EXT].includes(
      path.extname(f).toLowerCase(),
    ),
  );

  if (explicitTargets.length) {
    const wanted = explicitTargets.map((t) => path.resolve(t));
    files = files.filter((f) => wanted.includes(path.resolve(f)));
  }

  if (!files.length) {
    console.log(`No source files found in ${path.relative(ROOT, SOURCES_DIR)}/`);
    console.log("Drop PDFs / JPGs / screenshots there and re-run.");
    return;
  }

  console.log(`Found ${files.length} source file(s)\n`);
  const summary = [];

  for (const abs of files) {
    const rel = path.relative(SOURCES_DIR, abs);
    const ext = path.extname(abs).toLowerCase();
    const slug = slugify(rel);
    const outPath = path.join(MARKDOWN_DIR, `${slug}.md`);
    const cachePath = path.join(CACHE_DIR, `${slug}.json`);

    const bytes = await fs.readFile(abs);
    const hash = sha256(bytes);

    // Preserve a previously-set section (and any convert_with override)
    // across re-conversions.
    let existingSection = "UNSET";
    let convertWith = null;
    try {
      const prevFm = matter(await fs.readFile(outPath, "utf-8")).data;
      existingSection = prevFm.section ?? "UNSET";
      convertWith = prevFm.convert_with ?? null;
    } catch {}
    const forceVision =
      forceVisionAll || String(convertWith).toLowerCase() === "vision";

    let cache = null;
    try {
      cache = JSON.parse(await fs.readFile(cachePath, "utf-8"));
    } catch {}

    const staleMode = forceVision && cache?.mode && cache.mode !== "vision";
    if (!force && !staleMode && cache?.hash === hash) {
      const outExists = await fs
        .access(outPath)
        .then(() => true)
        .catch(() => false);
      if (outExists) {
        console.log(`= ${rel} (unchanged, skipped)`);
        summary.push({ rel, slug, section: existingSection, mode: cache.mode, pages: cache.pages });
        continue;
      }
    }

    console.log(`+ ${rel}`);
    try {
      const { pages, pageCount, mode } = await extractSource(abs, ext, {
        forceVision,
      });
      const nPages = pageCount ?? pages.length;
      const md = buildMarkdown({
        title: titleFromName(rel),
        sourceFile: rel,
        section: existingSection,
        convertWith,
        pages,
        pageCount: nPages,
        mode,
      });
      await fs.writeFile(outPath, md, "utf-8");
      await fs.writeFile(
        cachePath,
        JSON.stringify({ hash, mode, pages: nPages, sourceFile: rel }, null, 2),
      );
      console.log(`  -> content/markdown/${slug}.md  (${nPages} page(s), ${mode})`);
      summary.push({ rel, slug, section: existingSection, mode, pages: nPages });
    } catch (e) {
      console.error(`  !! failed: ${e.message}`);
      summary.push({ rel, slug, section: existingSection, mode: "error", pages: 0 });
    }
  }

  console.log("\n─── Summary ───");
  for (const s of summary) {
    console.log(
      `  ${s.section === "UNSET" ? "⚠︎" : "✓"}  ${s.slug}.md  [${s.section}]  ${s.pages}p ${s.mode}`,
    );
  }

  const unset = summary.filter((s) => s.section === "UNSET");
  if (unset.length) {
    console.log(
      `\n${unset.length} file(s) still need a section. Edit the frontmatter of:`,
    );
    for (const s of unset) console.log(`  content/markdown/${s.slug}.md`);
    console.log("\nValid sections are listed in content/sections.json");
  }
  console.log(
    "\nReview the Markdown (especially tables and doses), then run: npm run ingest",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
