-- Plain vector similarity search (kept for the test-retrieval script and as a
-- fallback). The chat route uses hybrid_search below.
create or replace function match_documents (
  query_embedding vector(1536),
  match_count int default 10,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where d.embedding is not null
    and d.metadata @> filter
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
end;
$$;
