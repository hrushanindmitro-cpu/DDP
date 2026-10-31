-- DPP Tessile 0010: employee invitations by link (no e-mail provider needed yet).
-- The owner or an administrator creates an invitation and sends the link by any channel. Only a hash of the secret
-- token is stored. The invited person must sign in with the SAME e-mail address to accept it.
-- Keep e-mail confirmation ON in Supabase Auth in production, otherwise someone could register with a foreign address.

create table public.organization_invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null check (char_length(email) <= 200 and email = lower(email)),
  role_key    text not null references public.roles(key) check (role_key <> 'owner'),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at  timestamptz
);
create unique index invitations_pending_uq on public.organization_invitations (org_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.organization_invitations enable row level security;
create policy invitations_select on public.organization_invitations for select to authenticated
  using (public.has_permission(org_id, 'member.manage'));
-- no write policies: everything goes through the functions below
revoke all on public.organization_invitations from anon;
revoke insert, update, delete, truncate on public.organization_invitations from authenticated;

create function public.create_invitation(p_org uuid, p_email text, p_role text, p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_count bigint;
  v_id    uuid;
begin
  if not public.has_permission(p_org, 'member.manage') then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 200 then raise exception 'invalid email' using errcode = '22023'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid token' using errcode = '22023'; end if;
  if p_role = 'owner' or not exists (select 1 from public.roles where key = p_role) then raise exception 'invalid role' using errcode = '22023'; end if;
  if p_role = 'admin' and not public.is_owner(p_org) then raise exception 'only the owner can invite administrators' using errcode = '42501'; end if;

  -- an expired invitation to the same address must not block a new one
  update public.organization_invitations set revoked_at = now()
    where org_id = p_org and email = v_email and accepted_at is null and revoked_at is null and expires_at <= now();

  -- plan limit: members plus open invitations
  select (select count(*) from public.organization_members where org_id = p_org)
       + (select count(*) from public.organization_invitations where org_id = p_org and accepted_at is null and revoked_at is null and expires_at > now())
    into v_count;
  if not public.within_limit(p_org, 'users', v_count) then raise exception 'user limit reached' using errcode = 'DPP04'; end if;

  insert into public.organization_invitations (org_id, email, role_key, token_hash)
  values (p_org, v_email, p_role, p_token_hash) returning id into v_id;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (p_org, (select auth.uid()), 'member.invited', 'invitation', v_id::text, jsonb_build_object('role', p_role));
  return v_id;
end $$;

create function public.revoke_invitation(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission(p_org, 'member.manage') then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.organization_invitations set revoked_at = now()
    where id = p_id and org_id = p_org and accepted_at is null and revoked_at is null;
  if found then
    insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
    values (p_org, (select auth.uid()), 'member.invite_revoked', 'invitation', p_id::text);
  end if;
end $$;

-- DPP02 = invitation invalid, expired or used; DPP03 = signed in with a different e-mail address
create function public.accept_invitation(p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_inv   public.organization_invitations;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invitation is not valid' using errcode = 'DPP02'; end if;
  select * into v_inv from public.organization_invitations where token_hash = p_token_hash for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at <= now()
     or not exists (select 1 from public.organizations where id = v_inv.org_id and deleted_at is null) then
    raise exception 'invitation is not valid' using errcode = 'DPP02';
  end if;
  if v_email = '' or v_email <> v_inv.email then raise exception 'wrong e-mail address' using errcode = 'DPP03'; end if;

  insert into public.organization_members (org_id, user_id, role_key) values (v_inv.org_id, v_uid, v_inv.role_key)
    on conflict (org_id, user_id) do nothing;
  update public.organization_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (v_inv.org_id, v_uid, 'member.invite_accepted', 'invitation', v_inv.id::text, jsonb_build_object('role', v_inv.role_key));
  return v_inv.org_id;
end $$;

revoke all on function public.create_invitation(uuid, text, text, text), public.revoke_invitation(uuid, uuid),
  public.accept_invitation(text) from public, anon;
grant execute on function public.create_invitation(uuid, text, text, text), public.revoke_invitation(uuid, uuid),
  public.accept_invitation(text) to authenticated;
