-- DPP Tessile 0004: product catalog (collections, products). Soft delete, org isolation, audit.
-- Reads need passport.read, writes need passport.edit. Rows are never hard-deleted from the app.

create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  season      text check (season is null or char_length(season) <= 40),
  year        int  check (year is null or year between 1990 and 2100),
  description text check (description is null or char_length(description) <= 1000),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, id)
);
create unique index collections_org_name_uq on public.collections (org_id, lower(name)) where deleted_at is null;

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  collection_id     uuid,
  name              text not null check (char_length(btrim(name)) between 2 and 200),
  sku               text check (sku is null or char_length(sku) <= 64),
  gtin              text check (gtin is null or gtin ~ '^([0-9]{8}|[0-9]{12,14})$'),
  brand             text check (brand is null or char_length(brand) <= 120),
  category          text check (category is null or char_length(category) <= 120),
  manufacturer      text check (manufacturer is null or char_length(manufacturer) <= 200),
  country_of_origin text check (country_of_origin is null or country_of_origin ~ '^[A-Z]{2}$'),
  hs_code           text check (hs_code is null or hs_code ~ '^[0-9]{6,10}$'),
  hs_source         text check (hs_source is null or char_length(hs_source) <= 300),
  hs_status         text not null default 'unverified' check (hs_status in ('unverified', 'verified')),
  notes             text check (notes is null or char_length(notes) <= 2000),
  created_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  -- a collection must belong to the same organization; deleting it only clears the link
  foreign key (org_id, collection_id) references public.collections (org_id, id) on delete set null (collection_id),
  -- "verified" classification needs a code and a source
  check (hs_status = 'unverified' or (hs_code is not null and hs_source is not null))
);
create unique index products_org_sku_uq  on public.products (org_id, lower(sku)) where deleted_at is null and sku is not null;
create unique index products_org_gtin_uq on public.products (org_id, gtin)       where deleted_at is null and gtin is not null;
create index products_org_updated_idx    on public.products (org_id, updated_at desc) where deleted_at is null;
create index products_collection_idx     on public.products (org_id, collection_id);

-- org_id and created_by never change; updated_at is maintained here.
create function public.protect_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.org_id <> old.org_id then raise exception 'org_id is immutable' using errcode = '23514'; end if;
  new.created_by := old.created_by;
  new.updated_at := now();
  return new;
end $$;
create trigger collections_protect before update on public.collections for each row execute function public.protect_row();
create trigger products_protect    before update on public.products    for each row execute function public.protect_row();

-- audit: created / updated / deleted (soft)
create function public.audit_entity_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_entity text := tg_argv[0];
  v_action text;
begin
  if tg_op = 'INSERT' then v_action := v_entity || '.created';
  elsif new.deleted_at is not null and old.deleted_at is null then v_action := v_entity || '.deleted';
  else v_action := v_entity || '.updated';
  end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (new.org_id, (select auth.uid()), v_action, v_entity, new.id::text, jsonb_build_object('name', new.name));
  return new;
end $$;
create trigger collections_audit after insert or update on public.collections
  for each row execute function public.audit_entity_change('collection');
create trigger products_audit after insert or update on public.products
  for each row execute function public.audit_entity_change('product');

-- soft-deleting a collection detaches its products
create function public.collection_deleted_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.products set collection_id = null where org_id = new.org_id and collection_id = new.id;
  end if;
  return new;
end $$;
create trigger collections_cleanup after update on public.collections
  for each row execute function public.collection_deleted_cleanup();

-- RLS. Soft-deleted rows are filtered by the application (a select policy on deleted_at would break soft delete).
alter table public.collections enable row level security;
alter table public.products    enable row level security;

create policy collections_select on public.collections for select to authenticated
  using (public.has_permission(org_id, 'passport.read'));
create policy collections_insert on public.collections for insert to authenticated
  with check (public.has_permission(org_id, 'passport.edit') and created_by = (select auth.uid()));
create policy collections_update on public.collections for update to authenticated
  using (public.has_permission(org_id, 'passport.edit')) with check (public.has_permission(org_id, 'passport.edit'));

create policy products_select on public.products for select to authenticated
  using (public.has_permission(org_id, 'passport.read'));
create policy products_insert on public.products for insert to authenticated
  with check (public.has_permission(org_id, 'passport.edit') and created_by = (select auth.uid()));
create policy products_update on public.products for update to authenticated
  using (public.has_permission(org_id, 'passport.edit')) with check (public.has_permission(org_id, 'passport.edit'));
-- No delete policies: rows are only soft-deleted.

revoke all on all tables in schema public from anon;
revoke delete, truncate on public.collections, public.products from authenticated;
