-- DPP Tessile 0005: suppliers, production sites, materials, raw material lots.
-- Reads need supplier.read, writes need supplier.manage. Soft delete, org isolation, audit.
-- Suppliers are limited by the plan (limit key 'suppliers') in the database itself.

-- Anyone who prepares passports must be able to maintain suppliers and lots.
insert into public.role_permissions (role_key, permission_key) values
  ('employee', 'supplier.manage'), ('passport_author', 'supplier.manage'), ('document_specialist', 'supplier.manage')
on conflict do nothing;

-- Audit now also works for rows without a "name" column (lots use lot_number).
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
          jsonb_build_object('name', coalesce(v_json->>'name', v_json->>'lot_number')));
  return new;
end $$;

create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 2 and 200),
  country      text check (country is null or country ~ '^[A-Z]{2}$'),
  contact_name text check (contact_name is null or char_length(contact_name) <= 200),
  email        text check (email is null or char_length(email) <= 200),
  website      text check (website is null or (char_length(website) <= 300 and website ~* '^https?://')),
  status       text not null default 'active' check (status in ('active', 'inactive')),
  notes        text check (notes is null or char_length(notes) <= 2000),
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, id)
);
create unique index suppliers_org_name_uq on public.suppliers (org_id, lower(name)) where deleted_at is null;

create table public.production_sites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid,
  name        text not null check (char_length(btrim(name)) between 2 and 200),
  country     text check (country is null or country ~ '^[A-Z]{2}$'),
  activity    text not null default 'other' check (activity in ('spinning', 'weaving', 'knitting', 'dyeing_finishing', 'sewing', 'other')),
  address     text check (address is null or char_length(address) <= 300),
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, id),
  foreign key (org_id, supplier_id) references public.suppliers (org_id, id) on delete set null (supplier_id)
);
create unique index sites_org_name_uq on public.production_sites (org_id, lower(name)) where deleted_at is null;

create table public.materials (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 2 and 200),
  kind       text not null default 'fiber' check (kind in ('fiber', 'yarn', 'fabric', 'trim', 'other')),
  fiber_type text check (fiber_type is null or char_length(fiber_type) <= 120),
  notes      text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, id)
);
create unique index materials_org_name_uq on public.materials (org_id, lower(name)) where deleted_at is null;

create table public.lots (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  lot_number     text not null check (char_length(btrim(lot_number)) between 1 and 64),
  material_id    uuid not null,
  supplier_id    uuid,
  site_id        uuid,
  quantity       numeric(14,3) check (quantity is null or quantity >= 0),
  unit           text check (unit is null or unit in ('kg', 'm', 'm2', 'pcs')),
  received_date  date,
  origin_country text check (origin_country is null or origin_country ~ '^[A-Z]{2}$'),
  -- Origin is a claim until proven: a supplier declaration is never shown as proof.
  origin_basis   text not null default 'supplier_declaration' check (origin_basis in ('supplier_declaration', 'document', 'verified')),
  notes          text check (notes is null or char_length(notes) <= 2000),
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (org_id, id),
  check (quantity is null or unit is not null),
  foreign key (org_id, material_id) references public.materials (org_id, id),
  foreign key (org_id, supplier_id) references public.suppliers (org_id, id) on delete set null (supplier_id),
  foreign key (org_id, site_id)     references public.production_sites (org_id, id) on delete set null (site_id)
);
create unique index lots_org_number_uq on public.lots (org_id, lower(lot_number), material_id) where deleted_at is null;
create index lots_org_updated_idx on public.lots (org_id, updated_at desc) where deleted_at is null;

create trigger suppliers_protect before update on public.suppliers        for each row execute function public.protect_row();
create trigger sites_protect     before update on public.production_sites for each row execute function public.protect_row();
create trigger materials_protect before update on public.materials        for each row execute function public.protect_row();
create trigger lots_protect      before update on public.lots             for each row execute function public.protect_row();

create trigger suppliers_audit after insert or update on public.suppliers        for each row execute function public.audit_entity_change('supplier');
create trigger sites_audit     after insert or update on public.production_sites for each row execute function public.audit_entity_change('site');
create trigger materials_audit after insert or update on public.materials        for each row execute function public.audit_entity_change('material');
create trigger lots_audit      after insert or update on public.lots             for each row execute function public.audit_entity_change('lot');

alter table public.suppliers        enable row level security;
alter table public.production_sites enable row level security;
alter table public.materials        enable row level security;
alter table public.lots             enable row level security;

create policy suppliers_select on public.suppliers for select to authenticated using (public.has_permission(org_id, 'supplier.read'));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (
    public.has_permission(org_id, 'supplier.manage') and created_by = (select auth.uid())
    and public.within_limit(org_id, 'suppliers',
        (select count(*) from public.suppliers s where s.org_id = suppliers.org_id and s.deleted_at is null))
  );
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.has_permission(org_id, 'supplier.manage')) with check (public.has_permission(org_id, 'supplier.manage'));

create policy sites_select on public.production_sites for select to authenticated using (public.has_permission(org_id, 'supplier.read'));
create policy sites_insert on public.production_sites for insert to authenticated
  with check (public.has_permission(org_id, 'supplier.manage') and created_by = (select auth.uid()));
create policy sites_update on public.production_sites for update to authenticated
  using (public.has_permission(org_id, 'supplier.manage')) with check (public.has_permission(org_id, 'supplier.manage'));

create policy materials_select on public.materials for select to authenticated using (public.has_permission(org_id, 'supplier.read'));
create policy materials_insert on public.materials for insert to authenticated
  with check (public.has_permission(org_id, 'supplier.manage') and created_by = (select auth.uid()));
create policy materials_update on public.materials for update to authenticated
  using (public.has_permission(org_id, 'supplier.manage')) with check (public.has_permission(org_id, 'supplier.manage'));

create policy lots_select on public.lots for select to authenticated using (public.has_permission(org_id, 'supplier.read'));
create policy lots_insert on public.lots for insert to authenticated
  with check (public.has_permission(org_id, 'supplier.manage') and created_by = (select auth.uid()));
create policy lots_update on public.lots for update to authenticated
  using (public.has_permission(org_id, 'supplier.manage')) with check (public.has_permission(org_id, 'supplier.manage'));

revoke all on all tables in schema public from anon;
revoke delete, truncate on public.suppliers, public.production_sites, public.materials, public.lots from authenticated;
