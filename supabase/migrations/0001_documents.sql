-- Knowledge base: one row per chunk of a reviewed Markdown document.
create extension if not exists vector;

create table if not exists documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536)
);

-- Approximate nearest-neighbour index for cosine similarity search.
create index if not exists documents_embedding_hnsw
  on documents using hnsw (embedding vector_cosine_ops);

-- Supports metadata filtering (e.g. by source or section).
create index if not exists documents_metadata_gin
  on documents using gin (metadata);

-- Fast lookup / delete by source path during re-ingestion.
create index if not exists documents_source_idx
  on documents ((metadata->>'source'));

-- Lock the table down: no policies means only the server's secret key
-- (service_role, which bypasses RLS) can read or write it. The browser's
-- publishable key gets nothing.
alter table documents enable row level security;
