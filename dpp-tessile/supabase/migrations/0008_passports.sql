-- DPP Tessile 0008: passports (drafts), composition, production stages, quota, document links to passports.
-- Creating a passport goes through create_passport(): it checks rights, plan feature and the monthly quota
-- (plan limit, then purchased credits) in one transaction. Passports are never hard-deleted.

create table public.passports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  product_id  uuid not null,
  title       text not null,                 -- product name at creation, used as a label
  batch_code  text check (batch_code is null or char_length(batch_code) <= 64),
  produced_on date,
  status      text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published', 'unpublished')),
  current_step int not null default 1 check (current_step between 1 and 5),
  credit_id   bigint references public.organization_credits(id),   -- purchased credit used for this passport, if any
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, id),
  foreign key (org_id, product_id) references public.products (org_id, id)
);
create unique index passports_org_product_batch_uq on public.passports (org_id, product_id, coalesce(lower(batch_code), '')) where deleted_at is null;
create index passports_org_updated_idx on public.passports (org_id, updated_at desc) where deleted_at is null;

create table public.passport_composition (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  passport_id     uuid not null,
  fiber           text not null check (char_length(btrim(fiber)) between 2 and 120),
  material_id     uuid,
  percent         numeric(5,2) not null check (percent > 0 and percent <= 100),
  recycled        boolean not null default false,
  recycled_percent numeric(5,2) check (recycled_percent is null or recycled_percent between 0 and 100),
  lot_id          uuid,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  check (recycled or recycled_percent is null),
  foreign key (org_id, passport_id) references public.passports (org_id, id) on delete cascade,
  foreign key (org_id, material_id) references public.materials (org_id, id) on delete set null (material_id),
  foreign key (org_id, lot_id)      references public.lots (org_id, id)      on delete set null (lot_id)
);
create index passport_composition_passport_idx on public.passport_composition (passport_id);

create table public.passport_stages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  passport_id uuid not null,
  stage_type  text not null check (stage_type in ('raw_material', 'spinning', 'weaving_knitting', 'dyeing_finishing', 'sewing', 'other')),
  site_id     uuid,
  supplier_id uuid,
  lot_id      uuid,
  started_on  date,
  finished_on date,
  notes       text check (notes is null or char_length(notes) <= 1000),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  check (finished_on is null or started_on is null or finished_on >= started_on),
  foreign key (org_id, passport_id) references public.passports (org_id, id) on delete cascade,
  foreign key (org_id, site_id)     references public.production_sites (org_id, id) on delete set null (site_id),
  foreign key (org_id, supplier_id) references public.suppliers (org_id, id)         on delete set null (supplier_id),
  foreign key (org_id, lot_id)      references public.lots (org_id, id)              on delete set null (lot_id)
);
create index passport_stages_passport_idx on public.passport_stages (passport_id);

-- documents can be attached to a passport
alter table public.document_links drop constraint document_links_entity_type_check;
alter table public.document_links add constraint document_links_entity_type_check
  check (entity_type in ('product', 'supplier', 'lot', 'site', 'material', 'passport'));

create or replace function public.document_link_guard() returns trigger
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
                                  when 'site' then 'production_sites' when 'material' then 'materials' when 'passport' then 'passports' end;
  execute format('select exists (select 1 from public.%I where id = $1 and org_id = $2 and deleted_at is null)', v_table)
    into v_ok using new.entity_id, new.org_id;
  if not v_ok then raise exception 'linked record not found' using errcode = '23503'; end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (new.org_id, (select auth.uid()), 'document.linked', 'document', new.document_id::text,
          jsonb_build_object('type', new.entity_type, 'id', new.entity_id));
  return new;
end $$;

-- ---------- triggers ----------
create trigger passports_protect before update on public.passports for each row execute function public.protect_row();
create trigger passports_audit after insert or update on public.passports
  for each row execute function public.audit_entity_change('passport');

-- this task only allows draft -> in_review; approval and publication come with their own functions later
create function public.passport_status_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not (old.status = 'draft' and new.status = 'in_review') then
      raise exception 'status change % -> % is not allowed here', old.status, new.status using errcode = '23514';
    end if;
    new.submitted_at := now();
    new.submitted_by := (select auth.uid());
    insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
    values (new.org_id, (select auth.uid()), 'passport.submitted_for_review', 'passport', new.id::text);
  end if;
  if new.product_id <> old.product_id then raise exception 'product cannot be changed' using errcode = '23514'; end if;
  return new;
end $$;
create trigger passports_status before update on public.passports for each row execute function public.passport_status_guard();

-- ---------- helpers ----------
create function public.passport_editable(p_org uuid, p_passport uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_permission(p_org, 'passport.edit') and public.has_feature(p_org, 'manual_entry')
     and exists (select 1 from public.passports where id = p_passport and org_id = p_org and status = 'draft' and deleted_at is null);
$$;

-- Creates a draft after checking rights, plan and quota. Quota: plan limit for the period, then purchased credits.
-- Deleted passports still count, so deleting does not free quota.
create function public.create_passport(p_org uuid, p_product uuid, p_batch text default null, p_produced_on date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := (select auth.uid());
  v_title   text;
  v_granted boolean;
  v_limit   int;
  v_period  text;
  v_used    bigint;
  v_credit  bigint;
  v_id      uuid;
begin
  if v_uid is null or not public.has_permission(p_org, 'passport.edit') or not public.has_feature(p_org, 'manual_entry') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select name into v_title from public.products where id = p_product and org_id = p_org and deleted_at is null;
  if v_title is null then raise exception 'product not found' using errcode = '23503'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));

  select (l.plan_key is not null), l.value, coalesce(l.period, 'total')
    into v_granted, v_limit, v_period
  from public.organization_subscriptions s
  left join public.plan_limits l on l.plan_key = s.plan_key and l.limit_key = 'passports'
  where s.org_id = p_org and s.status <> 'canceled';
  if not found then raise exception 'no active plan' using errcode = '42501'; end if;
  if not v_granted then v_limit := 0; end if;

  if v_limit is not null then
    select count(*) into v_used from public.passports
      where org_id = p_org
        and (v_period = 'total' or created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc'));
    if v_used >= v_limit then
      select id into v_credit from public.organization_credits
        where org_id = p_org and credits > used order by granted_at, id limit 1 for update;
      if v_credit is null then raise exception 'passport quota exceeded' using errcode = 'DPP01'; end if;
      update public.organization_credits set used = used + 1 where id = v_credit;
    end if;
  end if;

  insert into public.passports (org_id, product_id, title, batch_code, produced_on, credit_id, created_by)
  values (p_org, p_product, v_title, nullif(btrim(coalesce(p_batch, '')), ''), p_produced_on, v_credit, v_uid)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- RLS ----------
alter table public.passports            enable row level security;
alter table public.passport_composition enable row level security;
alter table public.passport_stages      enable row level security;

create policy passports_select on public.passports for select to authenticated using (public.has_permission(org_id, 'passport.read'));
-- no insert policy: only create_passport() creates passports
create policy passports_update on public.passports for update to authenticated
  using (status = 'draft' and public.has_permission(org_id, 'passport.edit') and public.has_feature(org_id, 'manual_entry'))
  with check (status in ('draft', 'in_review') and public.has_permission(org_id, 'passport.edit'));

create policy composition_select on public.passport_composition for select to authenticated using (public.has_permission(org_id, 'passport.read'));
create policy composition_insert on public.passport_composition for insert to authenticated
  with check (public.passport_editable(org_id, passport_id) and created_by = (select auth.uid()));
create policy composition_update on public.passport_composition for update to authenticated
  using (public.passport_editable(org_id, passport_id)) with check (public.passport_editable(org_id, passport_id));
create policy composition_delete on public.passport_composition for delete to authenticated using (public.passport_editable(org_id, passport_id));

create policy stages_select on public.passport_stages for select to authenticated using (public.has_permission(org_id, 'passport.read'));
create policy stages_insert on public.passport_stages for insert to authenticated
  with check (public.passport_editable(org_id, passport_id) and created_by = (select auth.uid()));
create policy stages_update on public.passport_stages for update to authenticated
  using (public.passport_editable(org_id, passport_id)) with check (public.passport_editable(org_id, passport_id));
create policy stages_delete on public.passport_stages for delete to authenticated using (public.passport_editable(org_id, passport_id));

revoke all on all tables in schema public from anon;
revoke insert, delete, truncate on public.passports from authenticated;
revoke all on function public.passport_editable(uuid, uuid), public.create_passport(uuid, uuid, text, date) from public, anon;
grant execute on function public.passport_editable(uuid, uuid), public.create_passport(uuid, uuid, text, date) to authenticated;
