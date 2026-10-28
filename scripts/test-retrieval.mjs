#!/usr/bin/env node
/**
 * test-retrieval.mjs — inspect what the knowledge base returns for a query,
 * without the chat model in the loop.
 *
 *   npm run test-retrieval -- "indomethacin dosing for a symptomatic PDA"
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
config({ path: path.join(ROOT, ".env.local") });

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error('Usage: npm run test-retrieval -- "your question here"');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PRIVATE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
});

const queryEmbedding = await embeddings.embedQuery(query);
const { data, error } = await client.rpc("hybrid_search", {
  query_embedding: queryEmbedding,
  query_text: query,
  match_count: 10,
});

if (error) {
  console.error("hybrid_search error:", error.message);
  process.exit(1);
}

if (!data?.length) {
  console.log("No results. Is anything ingested? Run `npm run ingest`.");
  process.exit(0);
}

console.log(`\nQuery: ${query}\n${"─".repeat(60)}`);
for (const row of data) {
  const md = row.metadata ?? {};
  console.log(
    `\n[${row.similarity.toFixed(3)}]  ${md.title ?? "?"}  —  ${md.section ?? "?"}`,
  );
  console.log(`  source: ${md.source_file ?? md.source ?? "?"}`);
  console.log(
    "  " +
      String(row.content)
        .replace(/\s+/g, " ")
        .slice(0, 240) +
      "…",
  );
}
console.log();
