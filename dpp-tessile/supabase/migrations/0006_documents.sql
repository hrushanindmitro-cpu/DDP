-- DPP Tessile 0006: documents, file versions, links to catalog records, private storage bucket.
-- Files live in a PRIVATE Storage bucket "documents", path: <org_id>/<document_id>/<random>.<ext>.
-- Reads need document.read, writes need document.edit, uploads need the plan feature 'document_upload'.

-- ---------- helpers ----------
create function public.safe_uuid(p text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end;
$$;

-- audit helper also understands "title"
create or replace function public.audit_entity_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_entity text := tg_argv[0];
  v_action text;
  v_json   jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then v_action := v_entity || '.created';
  elsif new.deleted_at is not null and old.deleted_at is null then v_action := v_entity || '.deleted';
  else v_action := v_entity || '.updated';
  end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (new.org_id, (select auth.uid()), v_action, v_entity, new.id::text,
          jsonb_build_object('name', coalesce(v_json->>'name', v_json->>'lot_number', v_json->>'title')));
  return new;
end $$;

-- ---------- tables ----------
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 200),
  doc_type    text not null default 'other' check (doc_type in ('certificate', 'lab_report', 'invoice', 'contract', 'declaration', 'other')),
  issuer      text check (issuer is null or char_length(issuer) <= 200),
  issued_date date,
  valid_until date,
  -- A document is never trusted just because a file was read: a human sets the review status.
  review_status text not null default 'unverified' check (review_status in ('unverified', 'verified', 'rejected')),
  review_note   text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, id),
  check (valid_until is null or issued_date is null or valid_until >= issued_date)
);
create index documents_org_updated_idx on public.documents (org_id, updated_at desc) where deleted_at is null;
create index documents_org_valid_idx   on public.documents (org_id, valid_until) where deleted_at is null and valid_until is not null;

create table public.document_versions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  document_id  uuid not null,
  version_no   int  not null check (version_no >= 1),
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (document_id, version_no),
  foreign key (org_id, document_id) references public.documents (org_id, id)
);

create table public.document_links (
  org_id      uuid not null,
  document_id uuid not null,
  entity_type text not null check (entity_type in ('product', 'supplier', 'lot', 'site', 'material')),
  entity_id   uuid not null,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (document_id, entity_type, entity_id),
  foreign key (org_id, document_id) references public.documents (org_id, id)
);
create index document_links_entity_idx on public.document_links (org_id, entity_type, entity_id);

-- ---------- triggers ----------
create trigger documents_protect before update on public.documents for each row execute function public.protect_row();
create trigger documents_audit after insert or update on public.documents
  for each row execute function public.audit_entity_change('document');

-- reviewed_by / reviewed_at are set here, never taken from the client; "verified" needs a file.
create function public.documents_review_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.review_status is distinct from old.review_status then
    if new.review_status = 'verified' and not exists (select 1 from public.document_versions v where v.document_id = new.id) then
      raise exception 'a document without a file cannot be verified' using errcode = '23514';
    end if;
    if new.review_status = 'unverified' then
      new.reviewed_by := null; new.reviewed_at := null;
    else
      new.reviewed_by := (select auth.uid()); new.reviewed_at := now();
    end if;
  else
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end $$;
create trigger documents_review before update on public.documents for each row execute function public.documents_review_guard();

-- a new file version resets the review: the checked file is no longer the current one
create function public.document_version_added() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.version_no > 1 then
    update public.documents set review_status = 'unverified', review_note = null
      where id = new.document_id and review_status <> 'unverified';
  end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (new.org_id, (select auth.uid()), 'document.version_added', 'document', new.document_id::text,
          jsonb_build_object('version', new.version_no, 'file', new.file_name, 'sha256', new.sha256));
  return new;
end $$;
create trigger document_versions_added after insert on public.document_versions
  for each row execute function public.document_version_added();

-- a link must point to an existing record of the same organization
create function public.document_link_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_table text;
  v_ok boolean;
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
    values (old.org_id, (select auth.uid()), 'document.unlinked', 'document', old.document_id::text,
            jsonb_build_object('type', old.entity_type, 'id', old.entity_id));
    return old;
  end if;
  v_table := case new.entity_type when 'product' then 'products' when 'supplier' then 'suppliers' when 'lot' then 'lots'
                                  when 'site' then 'production_sites' when 'material' then 'materials' end;
  execute format('select exists (select 1 from public.%I where id = $1 and org_id = $2 and deleted_at is null)', v_table)
    into v_ok using new.entity_id, new.org_id;
  if not v_ok then raise exception 'linked record not found' using errcode = '23503'; end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (new.org_id, (select auth.uid()), 'document.linked', 'document', new.document_id::text,
          jsonb_build_object('type', new.entity_type, 'id', new.entity_id));
  return new;
end $$;
create trigger document_links_guard before insert or delete on public.document_links
  for each row execute function public.document_link_guard();

-- ---------- storage usage (for the plan limit) ----------
create function public.org_storage_bytes(p_org uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select case when public.is_member(p_org)
    then coalesce((select sum(size_bytes) from public.document_versions where org_id = p_org), 0)
    else 0 end;
$$;

-- ---------- RLS ----------
alter table public.documents         enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_links    enable row level security;

create policy documents_select on public.documents for select to authenticated using (public.has_permission(org_id, 'document.read'));
create policy documents_insert on public.documents for insert to authenticated
  with check (public.has_permission(org_id, 'document.edit') and public.has_feature(org_id, 'document_upload') and created_by = (select auth.uid()));
create policy documents_update on public.documents for update to authenticated
  using (public.has_permission(org_id, 'document.edit')) with check (public.has_permission(org_id, 'document.edit'));

create policy versions_select on public.document_versions for select to authenticated using (public.has_permission(org_id, 'document.read'));
create policy versions_insert on public.document_versions for insert to authenticated
  with check (public.has_permission(org_id, 'document.edit') and public.has_feature(org_id, 'document_upload') and uploaded_by = (select auth.uid()));
-- versions are never updated or deleted

create policy links_select on public.document_links for select to authenticated using (public.has_permission(org_id, 'document.read'));
create policy links_insert on public.document_links for insert to authenticated
  with check (public.has_permission(org_id, 'document.edit') and created_by = (select auth.uid()));
create policy links_delete on public.document_links for delete to authenticated using (public.has_permission(org_id, 'document.edit'));

-- ---------- private Storage bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 20971520, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- folder 1 = organization id. No update policy: stored files cannot be overwritten.
create policy documents_files_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'document.read'));
create policy documents_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
    and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'document.edit')
    and public.has_feature(public.safe_uuid((storage.foldername(name))[1]), 'document_upload'));
-- delete is allowed only so the server can remove a file that failed the content check
create policy documents_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'document.edit'));

revoke all on all tables in schema public from anon;
revoke delete, truncate on public.documents from authenticated;
revoke update, delete, truncate on public.document_versions from authenticated;
revoke update, truncate on public.document_links from authenticated;
revoke all on function public.org_storage_bytes(uuid), public.safe_uuid(text) from public, anon;
grant execute on function public.org_storage_bytes(uuid), public.safe_uuid(text) to authenticated;
