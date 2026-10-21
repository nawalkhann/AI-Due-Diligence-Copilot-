-- Core schema for the Due Diligence Copilot.
--
-- Tenancy model: every row of customer data belongs to exactly one workspace.
-- Row level security restricts authenticated users to the workspaces they are
-- members of. Derived data (pages, chunks, embeddings) is written only by the
-- ingestion worker using the service role.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Workspaces and membership
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'analyst'
               check (role in ('owner', 'admin', 'analyst', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- Role ranks let policies express "at least analyst" etc.
create function public.role_rank(role text)
returns int
language sql
immutable
as $$
  select case role
    when 'owner'   then 4
    when 'admin'   then 3
    when 'analyst' then 2
    when 'viewer'  then 1
    else 0
  end
$$;

-- security definer so policies on workspace_members can call it without
-- recursing into workspace_members' own policies.
create function public.has_workspace_role(ws uuid, min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and public.role_rank(m.role) >= public.role_rank(min_role)
  )
$$;

-- The creator of a workspace becomes its owner.
create function public.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end
$$;

create trigger workspaces_add_owner
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner();

-- Workspaces are created through this function rather than a direct insert,
-- because the creator is not yet a member (and so cannot read the new row
-- back) until the trigger above has run.
create function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.workspaces (name, created_by)
  values (workspace_name, auth.uid())
  returning id into new_id;
  return new_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Companies and documents
-- ---------------------------------------------------------------------------

create table public.companies (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 200),
  ticker       text,
  cik          text,
  sector       text,
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id   uuid references public.companies (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 300),
  doc_type     text not null default 'other' check (doc_type in (
                 'annual_report', 'quarterly_report', 'filing_other',
                 'financial_statement', 'investor_presentation',
                 'market_report', 'other')),
  period_end   date,
  file_name    text not null,
  storage_path text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0),
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status       text not null default 'uploaded' check (status in (
                 'uploaded', 'queued', 'processing', 'ready', 'failed')),
  error        text,
  page_count   int,
  chunk_count  int,
  warnings     jsonb not null default '[]'::jsonb,
  uploaded_by  uuid not null default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, sha256),
  -- Files must live under the workspace's folder in storage.
  check (storage_path like workspace_id::text || '/%')
);

create index documents_workspace_idx on public.documents (workspace_id, created_at desc);
create index documents_company_idx on public.documents (company_id);

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger documents_touch
  before update on public.documents
  for each row execute function public.touch_updated_at();

-- Extracted page text, used to show the exact source behind a citation.
create table public.document_pages (
  document_id  uuid not null references public.documents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  page_number  int not null check (page_number >= 1),
  content      text not null,
  primary key (document_id, page_number)
);

create index document_pages_workspace_idx on public.document_pages (workspace_id);

-- Retrieval units. workspace_id is denormalised so that search can filter and
-- RLS can check without a join.
create table public.chunks (
  id             bigint generated always as identity primary key,
  document_id    uuid not null references public.documents (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  chunk_index    int not null,
  chunk_type     text not null check (chunk_type in ('text', 'table')),
  section        text,
  page_start     int not null,
  page_end       int not null,
  content        text not null,
  token_count    int not null,
  embedding      extensions.vector(1024) not null,
  fts            tsvector generated always as (to_tsvector('english', coalesce(section, '') || ' ' || content)) stored,
  metadata       jsonb not null default '{}'::jsonb,
  unique (document_id, chunk_index),
  check (page_end >= page_start)
);

create index chunks_workspace_doc_idx on public.chunks (workspace_id, document_id);
create index chunks_fts_idx on public.chunks using gin (fts);
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------------------
-- Ingestion queue
-- ---------------------------------------------------------------------------

create table public.ingestion_jobs (
  id            bigint generated always as identity primary key,
  document_id   uuid not null references public.documents (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts      int not null default 0,
  max_attempts  int not null default 3,
  run_after     timestamptz not null default now(),
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

-- At most one live job per document.
create unique index ingestion_jobs_one_active_idx on public.ingestion_jobs (document_id)
  where status in ('queued', 'running');
create index ingestion_jobs_ready_idx on public.ingestion_jobs (run_after)
  where status = 'queued';

-- Called by the web app once the file is in storage, and to retry a failure.
create function public.queue_document(doc_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.documents;
begin
  select * into doc from public.documents where id = doc_id for update;
  if not found or not public.has_workspace_role(doc.workspace_id, 'analyst') then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if doc.status not in ('uploaded', 'failed', 'ready') then
    raise exception 'document is already %', doc.status using errcode = '55000';
  end if;

  update public.documents set status = 'queued', error = null where id = doc_id;
  insert into public.ingestion_jobs (document_id, workspace_id)
  values (doc.id, doc.workspace_id);
  perform pg_notify('ingestion_jobs', doc.id::text);
end
$$;

-- Worker side: claim the next runnable job. Jobs whose worker died (lock older
-- than the lease) are picked up again.
create function public.claim_ingestion_job(worker text, lease interval default interval '15 minutes')
returns setof public.ingestion_jobs
language plpgsql
set search_path = ''
as $$
begin
  return query
  with next_job as (
    select j.id
    from public.ingestion_jobs j
    where (j.status = 'queued' and j.run_after <= now())
       or (j.status = 'running' and j.locked_at < now() - lease)
    order by j.run_after
    limit 1
    for update skip locked
  )
  update public.ingestion_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_at = now(),
         locked_by = worker
    from next_job
   where j.id = next_job.id
  returning j.*;
end
$$;

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.companies         enable row level security;
alter table public.documents         enable row level security;
alter table public.document_pages    enable row level security;
alter table public.chunks            enable row level security;
alter table public.ingestion_jobs    enable row level security;

revoke all on public.workspaces, public.workspace_members, public.companies,
              public.documents, public.document_pages, public.chunks,
              public.ingestion_jobs
  from anon, authenticated;

grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant delete on public.workspaces to authenticated;
grant select, insert, delete on public.workspace_members to authenticated;
grant update (role) on public.workspace_members to authenticated;
grant select, insert, delete on public.companies to authenticated;
grant update (name, ticker, cik, sector) on public.companies to authenticated;
grant select, delete on public.documents to authenticated;
grant insert (id, workspace_id, company_id, title, doc_type, period_end, file_name,
              storage_path, mime_type, size_bytes, sha256)
  on public.documents to authenticated;
grant update (company_id, title, doc_type, period_end) on public.documents to authenticated;
grant select on public.document_pages, public.chunks, public.ingestion_jobs to authenticated;

revoke execute on function public.claim_ingestion_job(text, interval) from public, anon, authenticated;
revoke execute on function public.queue_document(uuid) from public, anon;
grant execute on function public.queue_document(uuid) to authenticated;
revoke execute on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- workspaces
create policy workspaces_select on public.workspaces
  for select to authenticated using (public.has_workspace_role(id));
create policy workspaces_update on public.workspaces
  for update to authenticated using (public.has_workspace_role(id, 'admin'));
create policy workspaces_delete on public.workspaces
  for delete to authenticated using (public.has_workspace_role(id, 'owner'));

-- workspace_members: admins manage members, but only owners grant owner.
create policy members_select on public.workspace_members
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy members_insert on public.workspace_members
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id, 'admin')
    and (role <> 'owner' or public.has_workspace_role(workspace_id, 'owner')));
create policy members_update on public.workspace_members
  for update to authenticated
  using (public.has_workspace_role(workspace_id, 'admin'))
  with check (role <> 'owner' or public.has_workspace_role(workspace_id, 'owner'));
create policy members_delete on public.workspace_members
  for delete to authenticated using (
    public.has_workspace_role(workspace_id, 'admin') or user_id = auth.uid());

-- companies
create policy companies_select on public.companies
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy companies_insert on public.companies
  for insert to authenticated with check (public.has_workspace_role(workspace_id, 'analyst'));
create policy companies_update on public.companies
  for update to authenticated using (public.has_workspace_role(workspace_id, 'analyst'));
create policy companies_delete on public.companies
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));

-- documents
create policy documents_select on public.documents
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy documents_insert on public.documents
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id, 'analyst') and uploaded_by = auth.uid());
create policy documents_update on public.documents
  for update to authenticated using (public.has_workspace_role(workspace_id, 'analyst'));
create policy documents_delete on public.documents
  for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));

-- derived data: read-only for members
create policy pages_select on public.document_pages
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy chunks_select on public.chunks
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy jobs_select on public.ingestion_jobs
  for select to authenticated using (public.has_workspace_role(workspace_id));

-- A company referenced by a document must be in the same workspace.
create function public.check_document_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.company_id is not null and not exists (
    select 1 from public.companies c
    where c.id = new.company_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'company does not belong to this workspace' using errcode = '23503';
  end if;
  return new;
end
$$;

create trigger documents_check_company
  before insert or update of company_id on public.documents
  for each row execute function public.check_document_company();
