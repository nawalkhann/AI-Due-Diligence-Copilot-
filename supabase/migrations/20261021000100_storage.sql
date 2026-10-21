-- Private bucket for source documents. Objects are stored at
-- <workspace_id>/<document_id>/<file name>, and access follows workspace roles.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 104857600,
  array[
    'application/pdf',
    'text/html',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create function public.storage_workspace_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end
$$;

create policy documents_objects_select on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and public.has_workspace_role(public.storage_workspace_id(name)));

create policy documents_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and public.has_workspace_role(public.storage_workspace_id(name), 'analyst'));

create policy documents_objects_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'documents'
    and public.has_workspace_role(public.storage_workspace_id(name), 'admin'));
