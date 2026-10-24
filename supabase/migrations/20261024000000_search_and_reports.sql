-- Hybrid retrieval and saved reports.

-- Hybrid search: semantic (vector) and keyword (full text) rankings merged with
-- reciprocal rank fusion. Runs with the caller's rights, so row level security
-- limits results to workspaces the caller belongs to.
create function public.match_chunks(
  ws uuid,
  query_embedding extensions.vector(1024),
  query_text text,
  match_count int default 12,
  document_ids uuid[] default null
)
returns table (
  id bigint,
  document_id uuid,
  document_title text,
  doc_type text,
  company_name text,
  period_end date,
  section text,
  chunk_type text,
  page_start int,
  page_end int,
  content text,
  score double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with semantic as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rank
    from public.chunks c
    where c.workspace_id = ws
      and (document_ids is null or c.document_id = any(document_ids))
    order by c.embedding <=> query_embedding
    limit 50
  ),
  keyword as (
    select c.id,
           row_number() over (
             order by ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) desc
           ) as rank
    from public.chunks c
    where c.workspace_id = ws
      and (document_ids is null or c.document_id = any(document_ids))
      and c.fts @@ websearch_to_tsquery('english', query_text)
    order by ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) desc
    limit 50
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + k.rank), 0) as score
    from semantic s
    full outer join keyword k on k.id = s.id
  )
  select c.id, c.document_id, d.title, d.doc_type, co.name, d.period_end, c.section,
         c.chunk_type, c.page_start, c.page_end, c.content, f.score
  from fused f
  join public.chunks c on c.id = f.id
  join public.documents d on d.id = c.document_id
  left join public.companies co on co.id = d.company_id
  order by f.score desc
  limit least(match_count, 50)
$$;

revoke execute on function public.match_chunks(uuid, extensions.vector, text, int, uuid[]) from public, anon;
grant execute on function public.match_chunks(uuid, extensions.vector, text, int, uuid[]) to authenticated;

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id   uuid references public.companies (id) on delete set null,
  kind         text not null check (kind in ('risk', 'growth', 'summary')),
  title        text not null,
  content      text not null,
  sources      jsonb not null default '[]'::jsonb,
  model        text not null,
  created_by   uuid not null default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now()
);

create index reports_workspace_idx on public.reports (workspace_id, created_at desc);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, delete on public.reports to authenticated;
grant insert (workspace_id, company_id, kind, title, content, sources, model)
  on public.reports to authenticated;

create policy reports_select on public.reports
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy reports_insert on public.reports
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id, 'analyst') and created_by = auth.uid());
create policy reports_delete on public.reports
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));

-- Audit trail for questions and report generation.
create table public.audit_events (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id),
  action       text not null check (action in ('ask', 'report', 'upload', 'delete')),
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index audit_events_workspace_idx on public.audit_events (workspace_id, created_at desc);

alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant insert (workspace_id, action, detail) on public.audit_events to authenticated;
grant select on public.audit_events to authenticated;

create policy audit_insert on public.audit_events
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id) and user_id = auth.uid());
create policy audit_select on public.audit_events
  for select to authenticated using (public.has_workspace_role(workspace_id, 'admin'));
