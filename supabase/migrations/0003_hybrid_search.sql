-- Hybrid retrieval: vector similarity + a lightweight keyword boost, in one
-- round trip. Adapted from StanfordBDHG/ChatPPC.
create or replace function hybrid_search (
  query_embedding vector(1536),
  query_text text default '',
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
declare
  _match_count int := coalesce(match_count, 10);
  _filter jsonb := coalesce(filter, '{}'::jsonb);
  _query_text text := coalesce(query_text, '');
begin
  if query_embedding is null then
    raise exception 'query_embedding cannot be NULL';
  end if;
  if _match_count <= 0 then
    raise exception 'match_count must be positive, got: %', _match_count;
  end if;

  return query
  with vector_results as (
    select
      d.id,
      d.content,
      d.metadata,
      1 - (d.embedding <=> query_embedding) as vector_score
    from documents d
    where d.embedding is not null
      and d.metadata @> _filter
    order by d.embedding <=> query_embedding
    limit _match_count * 4
  ),
  keyword_boost as (
    select
      vr.id,
      case
        when _query_text = '' then 0.0
        when vr.content ilike '%' || _query_text || '%' then 0.15
        else (
          select coalesce(
            0.05 * count(*)::float
              / greatest(array_length(string_to_array(_query_text, ' '), 1), 1),
            0.0
          )
          from unnest(string_to_array(_query_text, ' ')) as word
          where length(word) > 2
            and vr.content ilike '%' || word || '%'
        )
      end as keyword_score
    from vector_results vr
  )
  select
    vr.id,
    vr.content,
    vr.metadata,
    (vr.vector_score + kb.keyword_score)::float as similarity
  from vector_results vr
  join keyword_boost kb on vr.id = kb.id
  order by (vr.vector_score + kb.keyword_score) desc
  limit _match_count;
end;
$$;
