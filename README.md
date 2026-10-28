# NICU Reference Assistant

A retrieval-augmented chat assistant for NICU clinicians, grounded **only** in a
curated set of unit documents. Modeled on
[StanfordBDHG/ChatPPC](https://github.com/StanfordBDHG/ChatPPC), rebuilt for the
NICU with a document-conversion pipeline that ingests **PDFs, JPGs, and
screenshots** (not just Markdown).

- **App**: Next.js 15 (App Router)
- **Vector store**: Supabase Postgres + `pgvector`
- **LLM + embeddings**: OpenAI (`gpt-4o-mini` chat, `text-embedding-3-small`, `gpt-4o` vision for OCR)
- **Auth**: Google sign-in via Supabase, restricted to `@stanford.edu`
- **Retrieval**: multi-query paraphrase → hybrid (vector + keyword) search → LLM reranker

> ⚠️ This is a reference aid. Answers come from uploaded documents and can be
> incomplete or stale. It does not replace clinical judgment, unit protocols, or
> pharmacist review. The system prompt forces the model to refuse when the
> answer isn't in the knowledge base and to never invent a dose.

---

## 1. Prerequisites

- Node.js 20+
- An OpenAI API key
- A Supabase project (free tier is fine) — https://supabase.com

## 2. Install

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

| var | where to get it |
| --- | --- |
| `OPENAI_API_KEY` | platform.openai.com |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_PRIVATE_KEY` | Supabase → Settings → API → `service_role` secret (server only) |
| `ALLOWED_EMAIL_DOMAINS` / `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` | `stanford.edu` |

## 3. Database

Open the Supabase **SQL Editor** and run the three files in
[`supabase/migrations/`](supabase/migrations) **in order**:

1. `0001_documents.sql` — `pgvector`, the `documents` table, indexes
2. `0002_match_documents.sql` — plain similarity search
3. `0003_hybrid_search.sql` — hybrid vector + keyword search

(If you use the Supabase CLI instead: `supabase link` then `supabase db push`.)

## 4. Sign-in (magic link, restricted to @stanford.edu)

Auth is passwordless email (a "magic link" + 6-digit code). It works with any
`@stanford.edu` mailbox regardless of whether that account is on Google or
Microsoft — no external identity provider to configure.

1. Supabase → **Authentication → Sign In / Providers → Email** → make sure it is
   **enabled**. Turn **Confirm email** off (magic link is itself the confirmation).
2. Supabase → **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs → add `http://localhost:3000/**`
3. Email delivery: Supabase's built-in email is rate-limited (a few messages per
   hour) — fine for testing. For real use, add **custom SMTP** under
   Authentication → Emails (SendGrid, SES, or a Stanford relay).
4. Domain enforcement lives in this app (`middleware.ts`, `lib/auth.ts`,
   `app/auth/callback/route.ts`): the login form refuses non-`stanford.edu`
   addresses, and any session whose email isn't in `ALLOWED_EMAIL_DOMAINS` is
   signed out on the next request. Change the allowed domain(s) via
   `ALLOWED_EMAIL_DOMAINS` / `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` in `.env.local`.

## 5. Build the knowledge base

```
content/
  sources/     ← put your raw source files here (git-ignored)
  markdown/    ← generated, reviewed Markdown (committed)
```

Supported source formats: **PDF**, **.docx**, and images (**.png .jpg .jpeg
.webp .gif .tiff .bmp**), including screenshots. Legacy **.doc** must be
re-saved as .docx or PDF first. Text in a .docx is extracted directly (no OCR
cost); images *pasted inside* a .docx are not transcribed — export those pages
as PDF/PNG and add them as their own files.

### a. Convert

```bash
npm run convert
```

- Text-native PDFs use their embedded text (no API cost).
- Scanned PDFs and images are transcribed to Markdown by `gpt-4o` vision, page by
  page (tables preserved as Markdown tables).
- Output is cached by file hash in `content/.cache/`, so re-runs are cheap.
- One `content/markdown/<slug>.md` per source, with frontmatter.

### b. Review (required)

Open each `content/markdown/*.md` and:

1. **Check tables and every dose / rate / threshold** against the original.
2. Set `section:` to one of the values in
   [`content/sections.json`](content/sections.json) (edit that list to match your
   unit). Files left at `section: UNSET` are skipped by the ingester.

### c. Ingest

```bash
npm run ingest
```

Chunks each file, prepends a `Section / Title / Source` header, embeds, and
inserts into `documents`. Unchanged files (by hash) are skipped; changed files
are replaced.

### d. Spot-check retrieval

```bash
npm run test-retrieval -- "indomethacin dosing for a symptomatic PDA"
```

## 6. Run

```bash
npm run dev
# http://localhost:3000  → sign in with a @stanford.edu Google account
```

Ask a question that's in your documents (expect a cited answer) and one that
isn't (expect *"I couldn't find this in the loaded NICU reference materials."*).

---

## Updating content later

Drop new/updated files in `content/sources/`, then:

```bash
npm run convert && npm run ingest
```

Re-run `convert` with `-- --force` to re-transcribe, `ingest` with `-- --force`
to re-embed.

## Deploy to Vercel (later)

1. Push this repo to GitHub, import it in Vercel.
2. Add all `.env.local` vars as Vercel environment variables. Set
   `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Add the production `/auth/callback` URL to Supabase redirect URLs and the
   Google OAuth client.
4. Run the SQL migrations against the same Supabase project (or a prod project).
5. `content/markdown/` is committed, so ingestion can be run from CI or locally
   against the prod database.

## Not built yet (possible later)

Admin/analytics dashboard, chat-history persistence, per-answer feedback,
multi-language, automated eval suite.

## Layout

```
app/
  api/chat/retrieval/route.ts   RAG chain (paraphrase → hybrid search → rerank → answer)
  api/health/route.ts
  login/page.tsx                Google sign-in
  auth/callback/route.ts        OAuth code exchange + domain check
  page.tsx                      chat page (auth-gated)
components/                     ChatWindow, ChatMessageBubble, SourcesList, Navbar, Disclaimer
lib/
  supabase.ts                   server + service-role clients
  supabase-browser.ts           browser client
  auth.ts                       @stanford.edu enforcement
middleware.ts                   route gate
content/
  sections.json                 allowed sections (source of truth)
  sources/                      raw input (git-ignored)
  markdown/                     reviewed Markdown
scripts/
  convert.mjs                   sources → markdown (vision OCR)
  ingest.mjs                    markdown → Supabase
  test-retrieval.mjs            query the vector store from the CLI
supabase/migrations/            SQL to run in order
```
