#!/usr/bin/env node
// Mirror the API retrieval chain step by step to see where an answer is lost.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
config({ path: path.join(ROOT, ".env.local") });

const q = process.argv.slice(2).join(" ") || "What's the feeding volume on day 5 for an infant born at 900 grams?";
const client = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_PRIVATE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const model = new ChatOpenAI({ model: process.env.CHAT_MODEL ?? "gpt-4o-mini", temperature: 0.1 });
const embeddings = new OpenAIEmbeddings({ model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small" });

async function hybrid(query, k = 8) {
  const emb = await embeddings.embedQuery(query);
  const { data, error } = await client.rpc("hybrid_search", { query_embedding: emb, query_text: query, match_count: k });
  if (error) { console.error(error); return []; }
  return data;
}

console.log("QUESTION:", q, "\n" + "=".repeat(70));

// 1. paraphrases
const para = await model.invoke(
  `You help search a NICU reference library. Rewrite the question in exactly 2 alternative ways, expanding abbreviations. One per line, no numbering.\n\nQuestion: ${q}`,
);
const paraphrases = String(para.content).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 2);
console.log("PARAPHRASES:", paraphrases);

// 2. multi-query retrieve (wide) + per-source diversity cap
const queries = [q, ...paraphrases];
const sets = await Promise.all(queries.map((x) => hybrid(x, 20)));
const byId = new Map();
for (const s of sets) for (const r of s) {
  const e = byId.get(r.id);
  if (!e || e.similarity < r.similarity) byId.set(r.id, r);
}
const perSource = new Map();
const cands = [];
for (const r of [...byId.values()].sort((a, b) => b.similarity - a.similarity)) {
  const k = r.metadata.source_file ?? r.metadata.source ?? "";
  const n = perSource.get(k) ?? 0;
  if (n >= 4) continue;
  perSource.set(k, n + 1);
  cands.push(r);
  if (cands.length >= 30) break;
}
console.log("\nCANDIDATES (" + cands.length + "):");
for (const c of cands) console.log(`  [${c.similarity.toFixed(3)}] ${c.metadata.title} — ${c.metadata.section}`);

// 3. rerank (uses the answer model, faithfully mirrors route.ts)
const answerModel = new ChatOpenAI({ model: process.env.ANSWER_MODEL ?? "gpt-4o", temperature: 0 });
const numbered = cands.map((d, i) => `[${i}] ${d.content.replace(/\n+/g, " ").slice(0, 1000)}`).join("\n");
const rr = await answerModel.invoke(
  `Score how relevant each retrieved document is to the clinician's question. Output one line per document, "INDEX: SCORE", SCORE 0-10.

Scoring guidance:
- 10 = this document directly and specifically answers the question.
- Strongly favour a document whose scope MATCHES the case in the question — the right birth-weight band, gestational age, diagnosis, or scenario. A dedicated single-topic protocol/pathway that fits the case beats a general reference manual that merely mentions the topic.
- Penalise a document written for a DIFFERENT weight band / GA / diagnosis than the question, even if it is about the same general subject (e.g. a "1501-2000 g" feeding guide scores low for a 900 g infant).
- A document from an unrelated clinical "Section:" scores 0-2 even if it shares keywords.

Question: ${q}

Documents:
${numbered}

Output only the scores, one per line:`,
);
console.log("\nRERANK RAW:\n" + String(rr.content));
const scores = new Map();
for (const line of String(rr.content).split("\n")) {
  const m = line.match(/\[?(\d+)\]?\s*[:\-]?\s*(\d+(?:\.\d+)?)/);
  if (m) scores.set(+m[1], +m[2]);
}
const rankedAll = cands.map((d, i) => ({ d, s: scores.get(i) ?? 0, i })).sort((a, b) => b.s - a.s || a.i - b.i);
const primaryRanked = rankedAll.filter((x) => x.d.metadata.priority !== "reference" && x.s > 1);
let kept;
if (primaryRanked.length > 0) kept = primaryRanked.slice(0, 8);
else { const strong = rankedAll.filter((x) => x.s >= 5).slice(0, 8); kept = strong.length > 0 ? strong : rankedAll.slice(0, 3); }
console.log("\nKEPT AFTER RERANK:");
for (const k of kept) console.log(`  score ${k.s}  ${k.d.metadata.title} — ${k.d.metadata.section}`);

// 4. answer
const ctx = kept.map((k) => k.d.content).join("\n\n---\n\n");
const ANSWER = `You are a reference assistant for NICU clinicians. Answer ONLY using the context below. If the context does not contain the answer, say exactly: "I couldn't find this in the loaded NICU reference materials." Never invent a dose. Cite the source. End with: "Verify against your current unit protocol and pharmacy before acting."
- Feed volumes / fluid rates / drug doses here are almost always PER KILOGRAM. A per-kg value from a table matching the case IS a complete answer — provide it; do not say info is missing because an absolute number isn't tabulated.
- Quote per-kg rates exactly; do NOT multiply by the patient weight.

Context:
<context>
${ctx}
</context>

Question: ${q}`;
const ans = await answerModel.invoke(ANSWER);
console.log("\n" + "=".repeat(70) + "\nANSWER:\n" + String(ans.content));
console.log("\n\n--- FULL CONTEXT SENT TO MODEL ---\n" + ctx.slice(0, 4000));
