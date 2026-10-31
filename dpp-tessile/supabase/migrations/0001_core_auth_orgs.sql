-- DPP Tessile 0001: profiles, organizations, members, roles, permissions, audit log, RLS.
-- Safe to run on a new Supabase project. Does not touch existing data (there is none yet).

-- ---------- profiles ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- roles and permissions (data, so the list can grow without code changes) ----------
create table public.roles (
  key        text primary key,
  sort_order int  not null
);
create table public.permissions (
  key text primary key
);
create table public.role_permissions (
  role_key       text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

insert into public.roles (key, sort_order) values
  ('owner', 1), ('admin', 2), ('employee', 3), ('passport_author', 4),
  ('document_specialist', 5), ('approver', 6), ('supplier', 7), ('auditor', 8);

insert into public.permissions (key) values
  ('org.manage'), ('member.manage'), ('audit.read'), ('report.export'),
  ('passport.read'), ('passport.edit'), ('passport.approve'), ('passport.publish'),
  ('document.read'), ('document.edit'), ('supplier.read'), ('supplier.manage');

-- owner and admin: everything
insert into public.role_permissions (role_key, permission_key)
  select r.key, p.key from public.roles r cross join public.permissions p where r.key in ('owner', 'admin');
insert into public.role_permissions (role_key, permission_key) values
  ('employee', 'passport.read'), ('employee', 'passport.edit'), ('employee', 'document.read'),
  ('employee', 'document.edit'), ('employee', 'supplier.read'), ('employee', 'report.export'),
  ('passport_author', 'passport.read'), ('passport_author', 'passport.edit'), ('passport_author', 'document.read'),
  ('passport_author', 'document.edit'), ('passport_author', 'supplier.read'), ('passport_author', 'report.export'),
  ('document_specialist', 'passport.read'), ('document_specialist', 'document.read'),
  ('document_specialist', 'document.edit'), ('document_specialist', 'supplier.read'),
  ('approver', 'passport.read'), ('approver', 'passport.approve'), ('approver', 'passport.publish'),
  ('approver', 'document.read'), ('approver', 'supplier.read'), ('approver', 'audit.read'),
  ('auditor', 'passport.read'), ('auditor', 'document.read'), ('auditor', 'supplier.read'), ('auditor', 'audit.read');
-- 'supplier' gets no organization-wide permission. Supplier access is scoped per record in a later task.

-- ---------- organizations and members ----------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role_key   text not null references public.roles(key),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- ---------- audit log (append-only) ----------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid references public.organizations(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);

-- ---------- helper functions used by RLS ----------
create function public.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.org_id and o.deleted_at is null
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function public.is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.org_id and o.deleted_at is null
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role_key = 'owner'
  );
$$;

create function public.has_permission(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.org_id and o.deleted_at is null
    join public.role_permissions rp on rp.role_key = m.role_key
    where m.org_id = p_org and m.user_id = (select auth.uid()) and rp.permission_key = p_perm
  );
$$;

-- Audit helper for application code. Writes the acting user from the session, never from input.
create function public.log_audit(p_org uuid, p_action text, p_entity_type text default null,
                                 p_entity_id text default null, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.is_member(p_org) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (p_org, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end $$;

-- Creates an organization and makes the caller its owner, in one transaction.
create function public.create_organization(org_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(org_name, ''))) not between 2 and 120 then
    raise exception 'invalid organization name' using errcode = '22023';
  end if;
  insert into public.organizations (name, created_by) values (btrim(org_name), v_uid) returning id into v_org;
  insert into public.organization_members (org_id, user_id, role_key) values (v_org, v_uid, 'owner');
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
  values (v_org, v_uid, 'organization.created', 'organization', v_org::text);
  return v_org;
end $$;

-- ---------- triggers on members: keep one owner, log changes ----------
create function public.guard_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role_key = 'owner' and (tg_op = 'DELETE' or new.role_key <> 'owner') then
    if not exists (
      select 1 from public.organization_members m
      where m.org_id = old.org_id and m.role_key = 'owner' and m.user_id <> old.user_id
    ) then
      raise exception 'an organization must keep at least one owner' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger organization_members_guard_owner
  before update or delete on public.organization_members
  for each row execute function public.guard_last_owner();

create function public.audit_member_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
    values (new.org_id, (select auth.uid()), 'member.added', 'user', new.user_id::text, jsonb_build_object('role', new.role_key));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.role_key <> old.role_key then
      insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
      values (new.org_id, (select auth.uid()), 'member.role_changed', 'user', new.user_id::text,
              jsonb_build_object('from', old.role_key, 'to', new.role_key));
    end if;
    return new;
  else
    insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
    values (old.org_id, (select auth.uid()), 'member.removed', 'user', old.user_id::text, jsonb_build_object('role', old.role_key));
    return old;
  end if;
end $$;

create trigger organization_members_audit
  after insert or update or delete on public.organization_members
  for each row execute function public.audit_member_change();

-- ---------- Row Level Security ----------
alter table public.profiles             enable row level security;
alter table public.roles                enable row level security;
alter table public.permissions          enable row level security;
alter table public.role_permissions     enable row level security;
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_log            enable row level security;

create policy profiles_select_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_select_comembers on public.profiles for select to authenticated
  using (exists (
    select 1 from public.organization_members a
    where a.user_id = profiles.id and public.is_member(a.org_id)
  ));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

create policy organizations_select on public.organizations for select to authenticated
  using (deleted_at is null and public.is_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_permission(id, 'org.manage')) with check (public.has_permission(id, 'org.manage'));
-- No insert policy: organizations are created through create_organization().

create policy members_select on public.organization_members for select to authenticated
  using (public.is_member(org_id));
create policy members_insert on public.organization_members for insert to authenticated
  with check (public.has_permission(org_id, 'member.manage') and (role_key <> 'owner' or public.is_owner(org_id)));
create policy members_update on public.organization_members for update to authenticated
  using (public.has_permission(org_id, 'member.manage') and (role_key <> 'owner' or public.is_owner(org_id)))
  with check (public.has_permission(org_id, 'member.manage') and (role_key <> 'owner' or public.is_owner(org_id)));
create policy members_delete on public.organization_members for delete to authenticated
  using ((public.has_permission(org_id, 'member.manage') and (role_key <> 'owner' or public.is_owner(org_id)))
         or user_id = (select auth.uid()));

create policy audit_select on public.audit_log for select to authenticated
  using (org_id is not null and public.has_permission(org_id, 'audit.read'));
-- No insert/update/delete policies: the log is written only by the functions and triggers above.

-- ---------- grants ----------
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke insert, update, delete, truncate on public.roles, public.permissions, public.role_permissions from authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke insert, delete, truncate on public.organizations from authenticated;

revoke all on function public.is_member(uuid), public.is_owner(uuid), public.has_permission(uuid, text),
  public.log_audit(uuid, text, text, text, jsonb), public.create_organization(text) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.has_permission(uuid, text),
  public.log_audit(uuid, text, text, text, jsonb), public.create_organization(text) to authenticated;
