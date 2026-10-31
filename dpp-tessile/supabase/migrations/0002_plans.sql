-- DPP Tessile 0002: plans, features, limits, organization subscriptions.
-- Plan data lives in the database so prices, features and limits are configurable without code changes.
-- Billing is NOT connected: plans are assigned manually (see docs/backend-setup.md). No data is ever deleted on downgrade.

create table public.plans (
  key               text primary key,
  sort_order        int  not null,
  price_monthly_eur numeric(10,2) not null check (price_monthly_eur >= 0)
);
create table public.plan_features (
  plan_key    text not null references public.plans(key) on delete cascade,
  feature_key text not null,
  primary key (plan_key, feature_key)
);
-- value NULL means unlimited. A missing row means the limit is not granted (treated as 0).
create table public.plan_limits (
  plan_key  text not null references public.plans(key) on delete cascade,
  limit_key text not null,
  value     integer check (value is null or value >= 0),
  primary key (plan_key, limit_key)
);
create table public.organization_subscriptions (
  org_id     uuid primary key references public.organizations(id) on delete cascade,
  plan_key   text not null references public.plans(key),
  status     text not null default 'manual' check (status in ('manual', 'trial', 'active', 'past_due', 'canceled')),
  updated_at timestamptz not null default now()
);

insert into public.plans (key, sort_order, price_monthly_eur) values
  ('start', 1, 99), ('professional', 2, 199), ('enterprise', 3, 399);

-- Features are cumulative: Professional includes Start, Enterprise includes Professional.
insert into public.plan_features (plan_key, feature_key) values
  ('start', 'product_cards'), ('start', 'document_upload'), ('start', 'qr_public_page'),
  ('start', 'pdf_internal'), ('start', 'data_export'), ('start', 'basic_history'), ('start', 'ai_assistant_basic');

insert into public.plan_features (plan_key, feature_key)
  select 'professional', feature_key from public.plan_features where plan_key = 'start';
insert into public.plan_features (plan_key, feature_key) values
  ('professional', 'supplier_cabinets'), ('professional', 'import_documents'), ('professional', 'ai_extraction'),
  ('professional', 'doc_comparison'), ('professional', 'certificate_alerts'), ('professional', 'audit_checklists'),
  ('professional', 'export_dossier_check'), ('professional', 'approval_routes'), ('professional', 'advanced_history'),
  ('professional', 'supplier_reports'), ('professional', 'tasks');

insert into public.plan_features (plan_key, feature_key)
  select 'enterprise', feature_key from public.plan_features where plan_key = 'professional';
insert into public.plan_features (plan_key, feature_key) values
  ('enterprise', 'multi_org'), ('enterprise', 'advanced_traceability'), ('enterprise', 'api_access'),
  ('enterprise', 'integrations'), ('enterprise', 'webhooks'), ('enterprise', 'custom_workflows'),
  ('enterprise', 'incidents_recalls'), ('enterprise', 'enterprise_audit_log'), ('enterprise', 'crypto_proof'),
  ('enterprise', 'polygon'), ('enterprise', 'bulk_management');

-- Starting values, edit freely: update public.plan_limits set value = ... where plan_key = ... and limit_key = ...
insert into public.plan_limits (plan_key, limit_key, value) values
  ('start', 'passports', 100), ('start', 'users', 3), ('start', 'suppliers', 10), ('start', 'storage_mb', 1024), ('start', 'ai_ops_month', 50),
  ('professional', 'passports', 1000), ('professional', 'users', 15), ('professional', 'suppliers', 200), ('professional', 'storage_mb', 20480), ('professional', 'ai_ops_month', 1000),
  ('enterprise', 'passports', null), ('enterprise', 'users', null), ('enterprise', 'suppliers', null), ('enterprise', 'storage_mb', null), ('enterprise', 'ai_ops_month', null);

-- Every existing organization starts on Start (assigned manually).
insert into public.organization_subscriptions (org_id, plan_key, status)
  select id, 'start', 'manual' from public.organizations on conflict do nothing;

-- New organizations get a subscription in the same transaction (replaces the 0001 function).
create or replace function public.create_organization(org_name text) returns uuid
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
  insert into public.organization_subscriptions (org_id, plan_key, status) values (v_org, 'start', 'manual');
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
  values (v_org, v_uid, 'organization.created', 'organization', v_org::text);
  return v_org;
end $$;

-- ---------- helpers for RLS and server code ----------
create function public.has_feature(p_org uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member(p_org) and exists (
    select 1 from public.organization_subscriptions s
    join public.plan_features f on f.plan_key = s.plan_key
    where s.org_id = p_org and s.status in ('manual', 'trial', 'active', 'past_due') and f.feature_key = p_feature
  );
$$;

-- NULL result = unlimited; 0 = not granted (no subscription, canceled, or no limit row).
create function public.plan_limit(p_org uuid, p_key text) returns integer
language sql stable security definer set search_path = '' as $$
  select case when l.plan_key is null then 0 else l.value end
  from public.organization_subscriptions s
  left join public.plan_limits l on l.plan_key = s.plan_key and l.limit_key = p_key
  where s.org_id = p_org and s.status <> 'canceled' and public.is_member(p_org);
$$;

-- p_used is the current count BEFORE adding one more item.
-- Use in RLS "with check" of insert policies on limited tables, so the limit holds even if app code is bypassed.
create function public.within_limit(p_org uuid, p_key text, p_used bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when not public.is_member(p_org) then false
    when not exists (select 1 from public.organization_subscriptions where org_id = p_org and status <> 'canceled') then false
    else public.plan_limit(p_org, p_key) is null or p_used < public.plan_limit(p_org, p_key)
  end;
$$;

-- ---------- audit of plan changes (made by the operator in SQL) ----------
create function public.audit_subscription_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.plan_key <> old.plan_key or new.status <> old.status then
    insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
    values (new.org_id, (select auth.uid()), 'subscription.changed', 'subscription', new.org_id::text,
            jsonb_build_object('from_plan', old.plan_key, 'to_plan', new.plan_key, 'from_status', old.status, 'to_status', new.status));
  end if;
  return new;
end $$;
create trigger organization_subscriptions_audit
  before update on public.organization_subscriptions
  for each row execute function public.audit_subscription_change();

-- ---------- RLS ----------
alter table public.plans                     enable row level security;
alter table public.plan_features             enable row level security;
alter table public.plan_limits               enable row level security;
alter table public.organization_subscriptions enable row level security;

create policy plans_read         on public.plans         for select to authenticated using (true);
create policy plan_features_read on public.plan_features for select to authenticated using (true);
create policy plan_limits_read   on public.plan_limits   for select to authenticated using (true);
create policy subscriptions_read on public.organization_subscriptions for select to authenticated
  using (public.is_member(org_id));
-- No write policies: customers cannot change their own plan. Only the operator does, in SQL.

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.plans, public.plan_features, public.plan_limits,
  public.organization_subscriptions from authenticated;
revoke all on function public.has_feature(uuid, text), public.plan_limit(uuid, text),
  public.within_limit(uuid, text, bigint) from public, anon;
grant execute on function public.has_feature(uuid, text), public.plan_limit(uuid, text),
  public.within_limit(uuid, text, bigint) to authenticated;
