-- DPP Tessile 0003: replaces the three starter plans with the owner's price list
-- FREE / LITE / BASE / FACTORY / EXPORT and adds Add-on Packs (extra passport credits).
-- Customer data is not deleted: only plan configuration is replaced; existing subscriptions move to FREE.
-- Limits other than passports (users, suppliers, storage, AI operations) are PLACEHOLDERS, edit them later.

alter table public.plan_limits
  add column period text not null default 'total' check (period in ('total', 'month'));

insert into public.plans (key, sort_order, price_monthly_eur) values
  ('free', 1, 0), ('lite', 2, 49), ('base', 3, 99), ('factory', 4, 149), ('export', 5, 199);

-- Features. FREE is a restricted demo: manual entry only, EXAMPLE watermark, no QR, no PDF.
insert into public.plan_features (plan_key, feature_key) values
  ('free', 'manual_entry'), ('free', 'example_watermark'),
  ('lite', 'manual_entry'), ('lite', 'document_upload'), ('lite', 'qr_public_page'), ('lite', 'pdf_internal');

insert into public.plan_features (plan_key, feature_key)
  select 'base', feature_key from public.plan_features where plan_key = 'lite';
insert into public.plan_features (plan_key, feature_key) values
  ('base', 'ai_create_from_photo_invoice'), ('base', 'excel_export');

insert into public.plan_features (plan_key, feature_key)
  select 'factory', feature_key from public.plan_features where plan_key = 'base';
insert into public.plan_features (plan_key, feature_key) values
  ('factory', 'blockchain_proof'), ('factory', 'white_label');

insert into public.plan_features (plan_key, feature_key)
  select 'export', feature_key from public.plan_features where plan_key = 'factory';
insert into public.plan_features (plan_key, feature_key) values
  ('export', 'api_access'), ('export', 'integrations'), ('export', 'priority_support');

-- Passports: FREE = 1 in total; paid plans = included per calendar month (assumption, change `period` if needed).
insert into public.plan_limits (plan_key, limit_key, value, period) values
  ('free',    'passports', 1,    'total'),
  ('lite',    'passports', 100,  'month'),
  ('base',    'passports', 300,  'month'),
  ('factory', 'passports', 500,  'month'),
  ('export',  'passports', 1000, 'month'),
  -- placeholders below
  ('free',    'users', 1,  'total'), ('free',    'suppliers', 3,    'total'), ('free',    'storage_mb', 100,   'total'), ('free',    'ai_ops_month', 0,    'total'),
  ('lite',    'users', 3,  'total'), ('lite',    'suppliers', 10,   'total'), ('lite',    'storage_mb', 1024,  'total'), ('lite',    'ai_ops_month', 0,    'total'),
  ('base',    'users', 5,  'total'), ('base',    'suppliers', 50,   'total'), ('base',    'storage_mb', 5120,  'total'), ('base',    'ai_ops_month', 100,  'total'),
  ('factory', 'users', 15, 'total'), ('factory', 'suppliers', 200,  'total'), ('factory', 'storage_mb', 20480, 'total'), ('factory', 'ai_ops_month', 500,  'total'),
  ('export',  'users', 50, 'total'), ('export',  'suppliers', null, 'total'), ('export',  'storage_mb', 51200, 'total'), ('export',  'ai_ops_month', 2000, 'total');

-- Existing organizations move to FREE, then the starter plans are removed (their features/limits cascade).
update public.organization_subscriptions set plan_key = 'free'
  where plan_key in ('start', 'professional', 'enterprise');
delete from public.plans where key in ('start', 'professional', 'enterprise');

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
  insert into public.organization_subscriptions (org_id, plan_key, status) values (v_org, 'free', 'manual');
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
  values (v_org, v_uid, 'organization.created', 'organization', v_org::text);
  return v_org;
end $$;

-- ---------- Add-on Packs: extra passport credits ----------
create table public.addon_packs (
  key        text primary key,
  sort_order int  not null,
  credits    int  not null check (credits > 0),
  price_eur  numeric(10,2) not null check (price_eur >= 0)
);
insert into public.addon_packs (key, sort_order, credits, price_eur) values
  ('pack_50', 1, 50, 19), ('pack_100', 2, 100, 29), ('pack_300', 3, 300, 69);

-- Credits granted to an organization. They do not expire (assumption). `used` is increased when a passport consumes one.
create table public.organization_credits (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  pack_key   text references public.addon_packs(key),
  credits    int  not null check (credits > 0),
  used       int  not null default 0 check (used >= 0 and used <= credits),
  source     text not null default 'manual' check (source in ('manual')),
  note       text,
  granted_at timestamptz not null default now()
);
create index organization_credits_org_idx on public.organization_credits (org_id);

create function public.extra_passport_credits(p_org uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when public.is_member(p_org)
    then coalesce((select sum(credits - used)::int from public.organization_credits where org_id = p_org), 0)
    else 0 end;
$$;

alter table public.addon_packs          enable row level security;
alter table public.organization_credits enable row level security;
create policy addon_packs_read on public.addon_packs for select to authenticated using (true);
create policy credits_read on public.organization_credits for select to authenticated using (public.is_member(org_id));
-- No write policies: credits are granted by the operator in SQL until payment is connected.

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.addon_packs, public.organization_credits from authenticated;
revoke all on function public.extra_passport_credits(uuid) from public, anon;
grant execute on function public.extra_passport_credits(uuid) to authenticated;
