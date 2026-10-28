#!/usr/bin/env node
/**
 * ingest.mjs — load reviewed Markdown into the Supabase `documents` table.
 *
 *   content/markdown/*.md  ──►  documents (content, metadata, embedding)
 *
 * - Each file's frontmatter must set a `section:` from content/sections.json.
 * - Files are chunked, each chunk is prefixed with a Section/Title/Source header
 *   (so the chat route's section-aware reranker works), embedded with OpenAI,
 *   and inserted.
 * - A SHA-256 of the file is stored in metadata; unchanged files are skipped,
 *   changed files are deleted and re-inserted.
 *
 * Usage:  npm run ingest            (all files)
 *         npm run ingest -- --force (re-embed everything)
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MarkdownTextSplitter } from "@langchain/textsplitters";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
config({ path: path.join(ROOT, ".env.local") });

const MARKDOWN_DIR = path.join(ROOT, "content", "markdown");
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const force = process.argv.includes("--force");

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PRIVATE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, val] of [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_PRIVATE_KEY / SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY],
  ["OPENAI_API_KEY", process.env.OPENAI_API_KEY],
]) {
  if (!val) {
    console.error(`Missing ${name} (set it in .env.local)`);
    process.exit(1);
  }
}

const { sections: SECTIONS } = JSON.parse(
  await fs.readFile(path.join(ROOT, "content", "sections.json"), "utf-8"),
);

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const embeddings = new OpenAIEmbeddings({ model: EMBEDDING_MODEL });
const splitter = new MarkdownTextSplitter({ chunkSize: 4000, chunkOverlap: 200 });

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

async function withRetry(fn, label, tries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < tries) {
        const wait = 1000 * 2 ** (attempt - 1);
        console.warn(`  retry ${attempt}/${tries - 1} (${label}): ${e.message} — waiting ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

async function listMarkdown(dir) {
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
    if (e.isDirectory()) out.push(...(await listMarkdown(full)));
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

async function existingHash(source) {
  const { data, error } = await client
    .from("documents")
    .select("metadata")
    .eq("metadata->>source", source)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`  lookup error: ${error.message}`);
    return null;
  }
  return data?.metadata?.hash ?? null;
}

async function deleteSource(source) {
  const { error } = await client
    .from("documents")
    .delete()
    .eq("metadata->>source", source);
  if (error) throw new Error(`delete failed: ${error.message}`);
}

async function processFile(absPath) {
  const source = path
    .relative(ROOT, absPath)
    .split(path.sep)
    .join("/");
  const raw = await fs.readFile(absPath, "utf-8");
  const { data: fm, content: bodyRaw } = matter(raw);
  const body = bodyRaw.trim();

  const section = fm.section;
  if (!section || section === "UNSET") {
    console.log(`- ${source}  (skipped: section not set)`);
    return { skipped: true };
  }
  if (!SECTIONS.includes(section)) {
    console.log(`- ${source}  (skipped: unknown section "${section}")`);
    return { skipped: true };
  }
  if (!body) {
    console.log(`- ${source}  (skipped: empty body)`);
    return { skipped: true };
  }

  const hash = sha256(raw);
  const prev = await existingHash(source);

  if (!force && prev === hash) {
    console.log(`= ${source}  (unchanged)`);
    return { unchanged: true };
  }
  // Always clear any existing rows for this source first, so a re-run (or a
  // retry after a mid-insert crash) can't leave a mix of old and new chunks.
  await deleteSource(source);

  const title = fm.title ?? path.basename(absPath, ".md");
  const sourceFile = fm.source_file ?? null;
  // "reference" = a broad manual used only when no focused protocol answers.
  const priority = fm.priority === "reference" ? "reference" : "primary";

  const chunks = await splitter.splitText(body);
  const header =
    `Section: ${section}\nTitle: ${title}\n` +
    (sourceFile ? `Source: ${sourceFile}\n` : "") +
    `\n`;

  const contents = chunks.map((c) => `${header}${c}`);

  // Embed and insert in batches — a single call with hundreds of chunks
  // overflows OpenAI's per-request token cap and Supabase's payload limit.
  const EMBED_BATCH = 64;
  const INSERT_BATCH = 25;
  let inserted = 0;

  try {
    for (let start = 0; start < contents.length; start += EMBED_BATCH) {
      const slice = contents.slice(start, start + EMBED_BATCH);
      const vectors = await withRetry(
        () => embeddings.embedDocuments(slice),
        `embed ${source} @${start}`,
      );
      const rows = slice.map((content, j) => ({
        content,
        embedding: vectors[j],
        metadata: {
          source,
          source_file: sourceFile,
          title,
          section,
          priority,
          hash,
          chunk: start + j,
        },
      }));

      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        await withRetry(async () => {
          const { error } = await client
            .from("documents")
            .insert(rows.slice(i, i + INSERT_BATCH));
          if (error) throw new Error(error.message);
        }, `insert ${source} @${start + i}`);
        inserted += Math.min(INSERT_BATCH, rows.length - i);
      }
    }
  } catch (e) {
    await deleteSource(source).catch(() => {});
    throw e;
  }

  console.log(`+ ${source}  (${inserted} chunk(s), section: ${section}${priority === "reference" ? ", reference" : ""})`);
  return { inserted };
}

async function main() {
  const files = await listMarkdown(MARKDOWN_DIR);
  if (!files.length) {
    console.log("No Markdown files in content/markdown/. Run `npm run convert` first.");
    return;
  }
  console.log(`Ingesting ${files.length} file(s) into ${SUPABASE_URL}\n`);

  let inserted = 0,
    unchanged = 0,
    skipped = 0;
  for (const f of files) {
    try {
      const r = await processFile(f);
      if (r.inserted) inserted += r.inserted;
      if (r.unchanged) unchanged++;
      if (r.skipped) skipped++;
    } catch (e) {
      console.error(`! ${path.relative(ROOT, f)}: ${e.message}`);
    }
  }

  console.log(
    `\nDone. ${inserted} chunk(s) inserted, ${unchanged} file(s) unchanged, ${skipped} skipped.`,
  );
  if (skipped) {
    console.log("Skipped files need a valid `section:` — see content/sections.json");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
