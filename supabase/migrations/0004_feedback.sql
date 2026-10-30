-- User-submitted feedback / error reports. Written by the server
-- (service-role key) only; no client-side access. View rows directly in the
-- Supabase Table Editor, or query from the SQL editor:
--   select * from feedback order by created_at desc;
create table if not exists feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_email text,
  category text not null,
  comment text not null,
  question text,
  answer text,
  sources jsonb
);

create index if not exists feedback_created_at_idx
  on feedback (created_at desc);

-- Locked down: no policies means only the server's secret key can read or
-- write it, same pattern as the documents table.
alter table feedback enable row level security;
