import { NextRequest, NextResponse } from "next/server";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { isAuthorized } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cheap model for the internal paraphrase + rerank steps.
const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";
// Stronger model for the user-facing answer — it must copy doses/rates
// verbatim without paraphrasing numeric ranges.
const ANSWER_MODEL = process.env.ANSWER_MODEL ?? "gpt-4o";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const formatMessages = (history: ChatMessage[]) =>
  history
    .map((m) =>
      m.role === "user"
        ? `Human: ${m.content}`
        : m.role === "assistant"
          ? `Assistant: ${m.content}`
          : `${m.role}: ${m.content}`,
    )
    .join("\n");

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question that captures all relevant context.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;
const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE,
);

const PARAPHRASE_TEMPLATE = `You help search a NICU (neonatal intensive care) clinical reference library. Rewrite the user's question in exactly 2 alternative ways that might match how a unit guideline or protocol would describe the same topic. Expand ALL abbreviations to their full form (e.g. "PDA" -> "patent ductus arteriosus", "TPN" -> "total parenteral nutrition", "BPD" -> "bronchopulmonary dysplasia", "NEC" -> "necrotizing enterocolitis"). Vary the wording. One rewrite per line. Return ONLY the 2 rewrites — no numbering, no commentary.

Question: {question}`;
const paraphrasePrompt = PromptTemplate.fromTemplate(PARAPHRASE_TEMPLATE);

const ANSWER_TEMPLATE = `You are a reference assistant for clinicians working in a neonatal intensive care unit (NICU) — attendings, fellows, neonatal nurse practitioners, bedside nurses, respiratory therapists, and pharmacists. Write for that audience: precise, concise, professional. Do not address the reader as a patient or family member.

Answer ONLY using the information in the context below, which is retrieved from this unit's own uploaded reference documents. Rules:
- If the context does not contain the answer, say exactly: "I couldn't find this in the loaded NICU reference materials. Try using a different term or question." Do not fall back on general knowledge, and never invent a dose, rate, or threshold.
- If some context entries are about a different weight band, gestational age, or diagnosis than the question, base your answer on the entry that actually matches the case and ignore the others. Name the document you used.
- If two matching sources give DIFFERENT values, report both, attribute each to its document, and point out the more specific or more recently dated one — do not silently pick one.
- Feed volumes, fluid rates, and drug doses in these documents are almost always given PER KILOGRAM (e.g. "mL/kg/day", "mcg/kg/dose"). A per-kg value from a table that matches the case IS a complete answer — provide it. Do not reply that the information is missing just because an absolute (total) number is not tabulated.
- Quote per-kg rates exactly as written. Do NOT multiply a per-kg rate by the patient's weight to produce an absolute dose or volume — state the rate and let the clinician calculate.
- When you state a medication dose, infusion rate, or numeric threshold, quote it as written in the source and name the source document.
- Cite the source for every substantive statement, using the "Source:" and (when present) page shown in the context, e.g. "(Neonatal Antibiotic Guideline, p. 3)".
- Prefer tables when the source presents information as a table.
- Each context entry starts with a "Section:" line naming its clinical area. If an entry's Section is unrelated to the question, ignore it entirely — do not cite or mention it.

Context:
<context>
{context}
</context>

<chat_history>
{chat_history}
</chat_history>

Question: {question}
`;
const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

type HybridRow = {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

async function hybridSearch(
  client: ReturnType<typeof getServiceSupabase>,
  embeddings: OpenAIEmbeddings,
  query: string,
  matchCount = 8,
): Promise<Array<Document & { id: number; similarity: number }>> {
  const queryEmbedding = await embeddings.embedQuery(query);
  const { data, error } = await client.rpc("hybrid_search", {
    query_embedding: queryEmbedding,
    query_text: query,
    match_count: matchCount,
  });
  if (error) {
    console.error("hybrid_search RPC error:", error);
    return [];
  }
  return ((data ?? []) as HybridRow[]).map((row) =>
    Object.assign(
      new Document({ pageContent: row.content, metadata: row.metadata }),
      { id: row.id, similarity: row.similarity },
    ),
  );
}

async function multiQueryRetrieve(
  client: ReturnType<typeof getServiceSupabase>,
  embeddings: OpenAIEmbeddings,
  paraphraseChain: RunnableSequence,
  question: string,
  perQueryK = 20,
  finalK = 30,
  maxPerSource = 4,
): Promise<Document[]> {
  let paraphrases: string[] = [];
  try {
    const raw = (await paraphraseChain.invoke({ question })) as string;
    paraphrases = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length < 400)
      .slice(0, 2);
  } catch (e) {
    console.error("paraphrase generation failed:", e);
  }

  const queries = [question, ...paraphrases];
  const resultSets = await Promise.all(
    queries.map((q) => hybridSearch(client, embeddings, q, perQueryK)),
  );

  const bestById = new Map<number, Document & { similarity: number }>();
  for (const docs of resultSets) {
    for (const doc of docs) {
      const id = (doc as Document & { id: number }).id;
      const existing = bestById.get(id);
      if (!existing || existing.similarity < (doc as { similarity: number }).similarity) {
        bestById.set(id, doc as Document & { similarity: number });
      }
    }
  }

  // Cap chunks per source file so one long, verbose document can't crowd the
  // focused single-page pathways/checklists out of the candidate pool.
  const perSource = new Map<string, number>();
  const diversified: Document[] = [];
  for (const doc of Array.from(bestById.values()).sort(
    (a, b) => b.similarity - a.similarity,
  )) {
    const key = String(
      (doc.metadata as Record<string, unknown>).source_file ??
        (doc.metadata as Record<string, unknown>).source ??
        "",
    );
    const n = perSource.get(key) ?? 0;
    if (n >= maxPerSource) continue;
    perSource.set(key, n + 1);
    diversified.push(doc);
    if (diversified.length >= finalK) break;
  }
  return diversified;
}

async function rerankWithLLM(
  model: ChatOpenAI,
  question: string,
  docs: Document[],
  keep: number,
): Promise<Document[]> {
  if (docs.length <= keep) return docs;

  const numbered = docs
    .map((d, i) => `[${i}] ${d.pageContent.replace(/\n+/g, " ").slice(0, 1000)}`)
    .join("\n");

  const prompt = `Score how relevant each retrieved document is to the clinician's question. Output one line per document, "INDEX: SCORE", SCORE 0-10.

Scoring guidance:
- 10 = this document directly and specifically answers the question.
- Strongly favour a document whose scope MATCHES the case in the question — the right birth-weight band, gestational age, diagnosis, or scenario. A dedicated single-topic protocol/pathway that fits the case beats a general reference manual that merely mentions the topic.
- Penalise a document written for a DIFFERENT weight band / GA / diagnosis than the question, even if it is about the same general subject (e.g. a "1501–2000 g" feeding guide scores low for a 900 g infant).
- A document from an unrelated clinical "Section:" scores 0–2 even if it shares keywords.

Question: ${question}

Documents:
${numbered}

Output only the scores, one per line:`;

  let raw = "";
  try {
    const res = await model.invoke(prompt);
    raw =
      typeof res.content === "string"
        ? res.content
        : String((res as { content?: unknown }).content ?? "");
  } catch (e) {
    console.error("rerank failed, using retrieval order:", e);
    return docs.slice(0, keep);
  }

  const scores = new Map<number, number>();
  for (const line of raw.split("\n")) {
    const m = line.match(/\[?(\d+)\]?\s*[:\-]?\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const idx = parseInt(m[1], 10);
      const score = parseFloat(m[2]);
      if (idx >= 0 && idx < docs.length && !isNaN(score)) scores.set(idx, score);
    }
  }
  if (scores.size === 0) return docs.slice(0, keep);

  const isReference = (d: Document) =>
    (d.metadata as Record<string, unknown>).priority === "reference";

  const ranked = docs
    .map((doc, i) => ({ doc, score: scores.get(i) ?? 0, idx: i }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  // Focused, current protocols ("primary") are few and their terse tables score
  // erratically on the reranker. If any primary doc was retrieved and isn't
  // clearly off-topic (score > 1), prefer primary docs — ordered by the
  // reranker — and don't mix in the broad reference guides at all.
  const primaryRanked = ranked.filter(
    (x) => !isReference(x.doc) && x.score > 1,
  );
  if (primaryRanked.length > 0) {
    return primaryRanked.slice(0, keep).map((x) => x.doc);
  }

  // No usable primary protocol — fall back to the reference guides, keeping
  // only clearly-relevant chunks (score >= 5), or the top 3 if nothing scores.
  const strong = ranked.filter((x) => x.score >= 5).slice(0, keep);
  const chosen = strong.length > 0 ? strong : ranked.slice(0, 3);
  return chosen.map((x) => x.doc);
}

const combineDocuments = (docs: Document[]) =>
  docs.map((d) => d.pageContent).join("\n\n---\n\n");

function sourcesHeader(docs: Document[]): string {
  const seen = new Set<string>();
  const sources = [];
  for (const d of docs) {
    const md = d.metadata as Record<string, unknown>;
    const key = String(md.source_file ?? md.source ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sources.push({
      title: md.title ?? key,
      source_file: md.source_file ?? null,
      section: md.section ?? null,
    });
  }
  return Buffer.from(JSON.stringify(sources)).toString("base64");
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];
    const previousMessages = messages.slice(0, -1);
    const currentMessageContent = messages[messages.length - 1]?.content;
    if (!currentMessageContent) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const model = new ChatOpenAI({ model: CHAT_MODEL, temperature: 0.1 });
    const answerModel = new ChatOpenAI({ model: ANSWER_MODEL, temperature: 0 });
    const embeddings = new OpenAIEmbeddings({ model: EMBEDDING_MODEL });
    const client = getServiceSupabase();
    const chatHistory = formatMessages(previousMessages);

    // 1. On follow-up turns, condense the exchange into a standalone question.
    //    On the first turn keep the user's exact wording (best retrieval signal).
    let question = currentMessageContent;
    if (previousMessages.length > 0) {
      const condense = RunnableSequence.from([
        condenseQuestionPrompt,
        model,
        new StringOutputParser(),
      ]);
      question = await condense.invoke({
        question: currentMessageContent,
        chat_history: chatHistory,
      });
    }

    // 2. Retrieve: multi-query hybrid search, then LLM rerank.
    const paraphraseChain = RunnableSequence.from([
      paraphrasePrompt,
      model,
      new StringOutputParser(),
    ]);
    const candidates = await multiQueryRetrieve(
      client,
      embeddings,
      paraphraseChain,
      question,
    );
    const docs = await rerankWithLLM(answerModel, question, candidates, 8);

    // 3. Answer, streamed.
    const answerChain = RunnableSequence.from([
      answerPrompt,
      answerModel,
      new StringOutputParser(),
    ]);
    const langchainStream = await answerChain.stream({
      context: combineDocuments(docs),
      chat_history: chatHistory,
      question,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of langchainStream) {
            controller.enqueue(encoder.encode(chunk as string));
          }
        } catch (e) {
          console.error("stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-sources": sourcesHeader(docs),
      },
    });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: err.status ?? 500 },
    );
  }
}
