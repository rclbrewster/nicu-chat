-- Emails submitted through the "Request access code" flow on the login
-- popup. Written by the server (service-role key) only. Review pending
-- requests directly in the Supabase Table Editor, or query from the SQL
-- editor:
--   select * from access_requests order by created_at desc;
create table if not exists access_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  email text not null
);

create index if not exists access_requests_created_at_idx
  on access_requests (created_at desc);

-- Locked down: no policies means only the server's secret key can read or
-- write it, same pattern as the feedback and documents tables.
alter table access_requests enable row level security;
