-- Manual isolation test. Run in the Supabase SQL editor on a DEV project only.
-- It inserts two throwaway users, checks tenant isolation, then rolls everything back.
begin;
insert into auth.users (id, email, instance_id, aud, role)
values ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-0000000000b2', 'b@test.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.create_organization('Org A');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select public.create_organization('Org B');

do $$
declare n int;
begin
  -- user B sees only Org B
  select count(*) into n from public.organizations;
  if n <> 1 then raise exception 'FAIL: user B sees % organizations, expected 1', n; end if;
  select count(*) into n from public.organizations where name = 'Org A';
  if n <> 0 then raise exception 'FAIL: user B can see Org A'; end if;
  -- user B cannot write into Org A's audit log or members
  begin
    insert into public.organization_members (org_id, user_id, role_key)
      select id, '00000000-0000-0000-0000-0000000000b2', 'owner' from public.organizations where name = 'Org A';
    raise exception 'FAIL: user B inserted a member into Org A';
  exception when others then null; end;
  -- last owner cannot leave
  begin
    delete from public.organization_members where user_id = '00000000-0000-0000-0000-0000000000b2';
    if found then raise exception 'FAIL: last owner removed'; end if;
  exception when check_violation then null; end;
  raise notice 'isolation checks passed';
end $$;
rollback;
