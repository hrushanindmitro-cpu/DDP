-- DPP Tessile 0009: who compiles and who approves passports (organization policy).
-- same_person: one responsible person compiles and approves.
-- separate:    a compiler and a different approver; the compiler's account can never approve a passport it created or submitted.
-- Names are internal records. They are not shown on the public passport page.

alter table public.organizations
  add column approval_mode    text not null default 'same_person' check (approval_mode in ('same_person', 'separate')),
  add column responsible_name text check (responsible_name is null or char_length(btrim(responsible_name)) between 2 and 200),
  add column compiler_name    text check (compiler_name is null or char_length(btrim(compiler_name)) between 2 and 200),
  add column approver_name    text check (approver_name is null or char_length(btrim(approver_name)) between 2 and 200);

-- existing organizations: responsible person = the owner's name (or a placeholder to be edited in Settings)
update public.organizations o set responsible_name = coalesce(
  (select nullif(btrim(p.full_name), '') from public.organization_members m join public.profiles p on p.id = m.user_id
    where m.org_id = o.id and m.role_key = 'owner' order by m.created_at limit 1), 'Ответственный')
where responsible_name is null;

alter table public.organizations add constraint organizations_approval_names check (
  (approval_mode = 'same_person' and responsible_name is not null)
  or (approval_mode = 'separate' and compiler_name is not null and approver_name is not null
      and lower(btrim(compiler_name)) <> lower(btrim(approver_name)))
);

-- the policy can only be changed through set_approval_policy(); direct updates are limited to name and country
revoke update on public.organizations from authenticated;
grant update (name, country) on public.organizations to authenticated;

create function public.set_approval_policy(p_org uuid, p_mode text, p_responsible text, p_compiler text, p_approver text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
begin
  if not public.has_permission(p_org, 'org.manage') then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_mode not in ('same_person', 'separate') then raise exception 'invalid mode' using errcode = '22023'; end if;
  select approval_mode into v_old from public.organizations where id = p_org and deleted_at is null;
  if not found then raise exception 'organization not found' using errcode = '23503'; end if;
  update public.organizations set
    approval_mode = p_mode,
    responsible_name = case when p_mode = 'same_person' then nullif(btrim(p_responsible), '') else null end,
    compiler_name    = case when p_mode = 'separate' then nullif(btrim(p_compiler), '') else null end,
    approver_name    = case when p_mode = 'separate' then nullif(btrim(p_approver), '') else null end
  where id = p_org;   -- the table check constraint rejects missing or identical names
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (p_org, (select auth.uid()), 'organization.approval_policy_changed', 'organization', p_org::text,
          jsonb_build_object('from', v_old, 'to', p_mode));
end $$;

-- create_organization now also stores the policy chosen at registration
drop function public.create_organization(text, text);
create function public.create_organization(
  org_name text, org_country text default null,
  p_mode text default 'same_person', p_responsible text default null, p_compiler text default null, p_approver text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_country text := nullif(upper(btrim(coalesce(org_country, ''))), '');
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(org_name, ''))) not between 2 and 120 then
    raise exception 'invalid organization name' using errcode = '22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then raise exception 'invalid country' using errcode = '22023'; end if;
  if p_mode not in ('same_person', 'separate') then raise exception 'invalid mode' using errcode = '22023'; end if;

  insert into public.organizations (name, created_by, country, approval_mode, responsible_name, compiler_name, approver_name)
  values (btrim(org_name), v_uid, v_country, p_mode,
          case when p_mode = 'same_person' then nullif(btrim(p_responsible), '') end,
          case when p_mode = 'separate' then nullif(btrim(p_compiler), '') end,
          case when p_mode = 'separate' then nullif(btrim(p_approver), '') end)
  returning id into v_org;                      -- the check constraint rejects missing or identical names
  insert into public.organization_members (org_id, user_id, role_key) values (v_org, v_uid, 'owner');
  insert into public.organization_subscriptions (org_id, plan_key, status) values (v_org, 'free', 'manual');
  insert into public.organization_promotions (org_id, promo_code, applied_via)
    select v_org, code, 'country' from public.promotions where active and country = v_country order by code limit 1;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (v_org, v_uid, 'organization.created', 'organization', v_org::text, jsonb_build_object('approval_mode', p_mode));
  return v_org;
end $$;

-- Used by the approval step (next task): may the current user approve this passport?
-- Requires the approve permission and, in "separate" mode, a user who neither created nor submitted the passport.
create function public.can_approve_passport(p_org uuid, p_passport uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_permission(p_org, 'passport.approve')
    and exists (
      select 1 from public.passports pa join public.organizations o on o.id = pa.org_id
      where pa.id = p_passport and pa.org_id = p_org and pa.status = 'in_review' and pa.deleted_at is null
        and (o.approval_mode = 'same_person'
             or (pa.created_by is distinct from (select auth.uid()) and pa.submitted_by is distinct from (select auth.uid())))
    );
$$;

revoke all on function public.set_approval_policy(uuid, text, text, text, text), public.create_organization(text, text, text, text, text, text),
  public.can_approve_passport(uuid, uuid) from public, anon;
grant execute on function public.set_approval_policy(uuid, text, text, text, text), public.create_organization(text, text, text, text, text, text),
  public.can_approve_passport(uuid, uuid) to authenticated;
