# Stanford NICU Reference

A retrieval-augmented chat assistant for NICU clinicians, grounded **only** in a
curated set of unit documents. Modeled on
[StanfordBDHG/ChatPPC](https://github.com/StanfordBDHG/ChatPPC), rebuilt for the
NICU with a document-conversion pipeline that ingests **PDFs, JPGs, and
screenshots** (not just Markdown).

- **App**: Next.js 15 (App Router)
- **Vector store**: Supabase Postgres + `pgvector`
- **LLM + embeddings**: OpenAI (`gpt-4o-mini` chat, `text-embedding-3-small`, `gpt-4o` vision for OCR)
- **Auth**: passwordless email code via Supabase, gated by a shared access code (not tied to an institutional email domain)
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
| `ACCESS_CODE` | pick a long/random passphrase yourself; share it out of band |

## 3. Database

Open the Supabase **SQL Editor** and run the three files in
[`supabase/migrations/`](supabase/migrations) **in order**:

1. `0001_documents.sql` — `pgvector`, the `documents` table, indexes
2. `0002_match_documents.sql` — plain similarity search
3. `0003_hybrid_search.sql` — hybrid vector + keyword search

(If you use the Supabase CLI instead: `supabase link` then `supabase db push`.)

## 4. Sign-in (email code, gated by an access code)

Auth is passwordless email — enter an address and a shared access code, get a
6-digit code by email, enter it, done. **Any email address works** — Gmail,
Yahoo, whatever — access is controlled entirely by whoever knows `ACCESS_CODE`,
not by institutional domain. That trade-off (identity-by-passphrase instead of
identity-by-institution) is deliberate; see the note in `.env.local.example`.

1. Supabase → **Authentication → Sign In / Providers → Email** → make sure it is
   **enabled**. Turn **Confirm email** off (the code itself is the confirmation).
2. Supabase → **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs → add `http://localhost:3000/**`
3. Email delivery: Supabase's built-in email is rate-limited (a few messages per
   hour) — fine for testing. For real use, add **custom SMTP** under
   Authentication → Emails (SendGrid, SES, Resend, or similar).
4. Set `ACCESS_CODE` in `.env.local` to a long, hard-to-guess passphrase.
   It's checked server-side in `app/api/auth/request-otp/route.ts` and never
   sent to the browser. Anyone who has it can register any email address, so
   share it out of band and rotate it (telling everyone the new one) if it
   leaks. There's no per-person revocation — rotating the code is the only way
   to cut someone off.

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
# http://localhost:3000  → sign in with any email + the ACCESS_CODE
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
3. Add the production `/auth/callback` URL to Supabase's redirect URLs.
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
  api/auth/request-otp/route.ts access-code check + send sign-in email (server only)
  login/page.tsx                email + access code → code verification
  auth/callback/route.ts        link-based sign-in fallback
  page.tsx                      chat page (auth-gated)
components/                     ChatWindow, ChatMessageBubble, SourcesList, Navbar, Disclaimer
lib/
  supabase.ts                   server + service-role clients
  supabase-browser.ts           browser client
  auth.ts                       session lookup (access itself is gated at sign-up by ACCESS_CODE)
middleware.ts                   route gate (session required)
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
