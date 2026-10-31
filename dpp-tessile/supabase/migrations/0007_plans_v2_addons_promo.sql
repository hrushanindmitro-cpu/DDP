-- DPP Tessile 0007: price list v2 (features and limits), add-ons, country of the company, UA2026 promotion.
-- Only plan configuration is replaced. No customer data is deleted.
-- NOTE: FREE becomes view-only. To test the app with your own organization, assign it a paid plan (see docs/backend-setup.md).

-- ---------- plan features v2 ----------
delete from public.plan_features;
insert into public.plan_features (plan_key, feature_key) values
  ('free', 'view_only'), ('free', 'example_watermark'),
  ('lite', 'manual_entry'), ('lite', 'document_upload'), ('lite', 'qr_public_page'), ('lite', 'pdf_internal'),
  ('lite', 'public_pdf'), ('lite', 'trust_page_basic'), ('lite', 'custom_fields');
insert into public.plan_features (plan_key, feature_key)
  select 'base', feature_key from public.plan_features where plan_key = 'lite';
insert into public.plan_features (plan_key, feature_key) values
  ('base', 'ai_create_from_photo_invoice'), ('base', 'excel_import'), ('base', 'readiness_checklist');
insert into public.plan_features (plan_key, feature_key)
  select 'factory', feature_key from public.plan_features where plan_key = 'base';
insert into public.plan_features (plan_key, feature_key) values
  ('factory', 'blockchain_proof'), ('factory', 'supplier_portal'), ('factory', 'co2_calculator'), ('factory', 'white_label');
insert into public.plan_features (plan_key, feature_key)
  select 'export', feature_key from public.plan_features where plan_key = 'factory';
insert into public.plan_features (plan_key, feature_key) values
  ('export', 'shopify_erp_import'), ('export', 'auto_translate'), ('export', 'qr_analytics'),
  ('export', 'espr_updates'), ('export', 'custom_domain'), ('export', 'ai_repair_disposal');

-- ---------- plan limits v2 (NULL = unlimited; missing row = not granted) ----------
-- users, suppliers, storage and AI operations are still PLACEHOLDERS. portal_suppliers for EXPORT is inherited from FACTORY (to confirm).
delete from public.plan_limits;
insert into public.plan_limits (plan_key, limit_key, value, period) values
  ('free',    'passports', 1,    'total'),
  ('lite',    'passports', 100,  'month'),
  ('base',    'passports', 300,  'month'),
  ('factory', 'passports', 500,  'month'),
  ('export',  'passports', 1000, 'month'),
  ('free', 'custom_fields', 0, 'total'), ('lite', 'custom_fields', 3, 'total'), ('base', 'custom_fields', 10, 'total'),
  ('factory', 'custom_fields', null, 'total'), ('export', 'custom_fields', null, 'total'),
  ('factory', 'portal_suppliers', 10, 'total'), ('export', 'portal_suppliers', 10, 'total'),
  ('export', 'qr_scans_month', 50000, 'month'),
  ('free',    'users', 1,  'total'), ('free',    'suppliers', 0,    'total'), ('free',    'storage_mb', 0,     'total'), ('free',    'ai_ops_month', 0,    'total'),
  ('lite',    'users', 3,  'total'), ('lite',    'suppliers', 10,   'total'), ('lite',    'storage_mb', 1024,  'total'), ('lite',    'ai_ops_month', 0,    'total'),
  ('base',    'users', 5,  'total'), ('base',    'suppliers', 50,   'total'), ('base',    'storage_mb', 5120,  'total'), ('base',    'ai_ops_month', 100,  'total'),
  ('factory', 'users', 15, 'total'), ('factory', 'suppliers', 200,  'total'), ('factory', 'storage_mb', 20480, 'total'), ('factory', 'ai_ops_month', 500,  'total'),
  ('export',  'users', 50, 'total'), ('export',  'suppliers', null, 'total'), ('export',  'storage_mb', 51200, 'total'), ('export',  'ai_ops_month', 2000, 'total');

-- ---------- add-ons ----------
create table public.addons (
  key          text primary key,
  sort_order   int  not null,
  kind         text not null check (kind in ('subscription', 'pack')),
  price_eur    numeric(10,2) not null check (price_eur >= 0),
  billing      text not null check (billing in ('month', 'once')),
  feature_key  text,
  units        int check (units is null or units > 0),
  plans        text[] not null
);
insert into public.addons (key, sort_order, kind, price_eur, billing, feature_key, units, plans) values
  ('qr_analytics',     1, 'subscription', 49, 'month', 'qr_analytics',       null,  '{lite,base,factory}'),
  ('co2_calculator',   2, 'subscription', 19, 'month', 'co2_calculator',      null,  '{lite,base}'),
  ('ai_repair',        3, 'subscription', 19, 'month', 'ai_repair_disposal',  null,  '{lite,base,factory}'),
  ('api_marketplaces', 4, 'subscription', 49, 'month', 'api_marketplaces',    null,  '{lite,base,factory,export}'),
  ('qr_scans_10k',     5, 'pack',         10, 'month', null,                  10000, '{lite,base,factory,export}');

create table public.organization_addons (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  addon_key  text not null references public.addons(key),
  quantity   int  not null default 1 check (quantity >= 1),
  status     text not null default 'active' check (status in ('active', 'canceled')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  note       text
);
create unique index organization_addons_active_uq on public.organization_addons (org_id, addon_key) where status = 'active';

-- a feature is available from the plan OR from an active add-on that fits the plan
create or replace function public.has_feature(p_org uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member(p_org) and (
    exists (
      select 1 from public.organization_subscriptions s
      join public.plan_features f on f.plan_key = s.plan_key
      where s.org_id = p_org and s.status <> 'canceled' and f.feature_key = p_feature
    )
    or exists (
      select 1 from public.organization_addons oa
      join public.addons a on a.key = oa.addon_key
      join public.organization_subscriptions s on s.org_id = oa.org_id
      where oa.org_id = p_org and oa.status = 'active' and a.feature_key = p_feature
        and s.plan_key = any (a.plans) and s.status <> 'canceled'
    )
  );
$$;

alter table public.addons              enable row level security;
alter table public.organization_addons enable row level security;
create policy addons_read on public.addons for select to authenticated using (true);
create policy org_addons_read on public.organization_addons for select to authenticated using (public.is_member(org_id));

-- ---------- company country + promotions ----------
alter table public.organizations add column country text check (country is null or country ~ '^[A-Z]{2}$');

create table public.promotions (
  code            text primary key check (code = upper(code)),
  percent_off     int  not null check (percent_off between 1 and 100),
  duration_months int  not null check (duration_months > 0),
  country         text check (country is null or country ~ '^[A-Z]{2}$'),
  active          boolean not null default true
);
create table public.promotion_prices (
  promo_code        text not null references public.promotions(code) on delete cascade,
  plan_key          text not null references public.plans(key) on delete cascade,
  price_monthly_eur numeric(10,2) not null check (price_monthly_eur >= 0),
  primary key (promo_code, plan_key)
);
insert into public.promotions (code, percent_off, duration_months, country) values ('UA2026', 30, 12, 'UA');
insert into public.promotion_prices (promo_code, plan_key, price_monthly_eur) values
  ('UA2026', 'lite', 35), ('UA2026', 'base', 69), ('UA2026', 'factory', 104), ('UA2026', 'export', 139);

-- One promotion per organization. The discount is only "pending" until a human verifies the business;
-- it applies from the first payment for duration_months. Billing is not connected yet.
create table public.organization_promotions (
  org_id            uuid primary key references public.organizations(id) on delete cascade,
  promo_code        text not null references public.promotions(code),
  applied_via       text not null check (applied_via in ('country', 'code')),
  status            text not null default 'pending_verification' check (status in ('pending_verification', 'verified', 'rejected')),
  registry_id       text check (registry_id is null or registry_id ~ '^[0-9]{8}$'),
  verification_note text,
  created_at        timestamptz not null default now(),
  verified_at       timestamptz,
  discount_starts_on date,
  discount_ends_on   date
);

alter table public.promotions              enable row level security;
alter table public.promotion_prices        enable row level security;
alter table public.organization_promotions enable row level security;
-- promotions itself has no policy: codes are checked only inside apply_promo_code()
create policy promo_prices_read on public.promotion_prices for select to authenticated
  using (exists (select 1 from public.organization_promotions op
                 where op.promo_code = promotion_prices.promo_code and public.is_member(op.org_id)));
create policy org_promos_read on public.organization_promotions for select to authenticated using (public.is_member(org_id));

create function public.apply_promo_code(p_org uuid, p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not public.has_permission(p_org, 'org.manage') then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.promotions where code = v_code and active) then return 'invalid'; end if;
  if exists (select 1 from public.organization_promotions where org_id = p_org) then return 'exists'; end if;
  insert into public.organization_promotions (org_id, promo_code, applied_via) values (p_org, v_code, 'code');
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (p_org, (select auth.uid()), 'promotion.applied', 'promotion', v_code, jsonb_build_object('via', 'code'));
  return 'applied';
end $$;

-- the registry id format and check digit are validated in the application; here only the shape
create function public.submit_registry_id(p_org uuid, p_registry_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission(p_org, 'org.manage') then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_registry_id is null or p_registry_id !~ '^[0-9]{8}$' then return false; end if;
  update public.organization_promotions set registry_id = p_registry_id
    where org_id = p_org and status = 'pending_verification';
  if not found then return false; end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
  values (p_org, (select auth.uid()), 'promotion.registry_id_submitted', 'promotion', p_org::text);
  return true;
end $$;

-- create_organization now takes the country and applies country promotions (pending verification)
drop function public.create_organization(text);
create function public.create_organization(org_name text, org_country text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
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
  insert into public.organizations (name, created_by, country) values (btrim(org_name), v_uid, v_country) returning id into v_org;
  insert into public.organization_members (org_id, user_id, role_key) values (v_org, v_uid, 'owner');
  insert into public.organization_subscriptions (org_id, plan_key, status) values (v_org, 'free', 'manual');
  insert into public.organization_promotions (org_id, promo_code, applied_via)
    select v_org, code, 'country' from public.promotions where active and country = v_country order by code limit 1;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
  values (v_org, v_uid, 'organization.created', 'organization', v_org::text);
  return v_org;
end $$;

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.addons, public.organization_addons, public.promotions,
  public.promotion_prices, public.organization_promotions from authenticated;
revoke all on function public.apply_promo_code(uuid, text), public.submit_registry_id(uuid, text),
  public.create_organization(text, text) from public, anon;
grant execute on function public.apply_promo_code(uuid, text), public.submit_registry_id(uuid, text),
  public.create_organization(text, text) to authenticated;
