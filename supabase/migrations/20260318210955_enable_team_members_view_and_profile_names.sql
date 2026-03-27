alter table public.user_profiles
  add column if not exists full_name text;

update public.user_profiles up
set full_name = nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), '')
from auth.users u
where u.id = up.id
  and (up.full_name is null or length(trim(up.full_name)) = 0);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.user_profiles (id, address, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'address', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do update
    set address = excluded.address,
        full_name = excluded.full_name,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop policy if exists memberships_select_org_active_members on public.memberships;
create policy memberships_select_org_active_members
  on public.memberships
  for select
  using (
    exists (
      select 1
      from public.memberships self_membership
      where self_membership.organization_id = memberships.organization_id
        and self_membership.user_id = auth.uid()
        and self_membership.status = 'active'
    )
  );

drop policy if exists employee_profiles_select_org_active_members on public.employee_profiles;
create policy employee_profiles_select_org_active_members
  on public.employee_profiles
  for select
  using (
    exists (
      select 1
      from public.memberships target_membership
      join public.memberships self_membership
        on self_membership.organization_id = target_membership.organization_id
      where target_membership.id = employee_profiles.membership_id
        and self_membership.user_id = auth.uid()
        and self_membership.status = 'active'
        and target_membership.status = 'active'
    )
  );

drop policy if exists user_profiles_select_org_active_members on public.user_profiles;
create policy user_profiles_select_org_active_members
  on public.user_profiles
  for select
  using (
    exists (
      select 1
      from public.memberships target_membership
      join public.memberships self_membership
        on self_membership.organization_id = target_membership.organization_id
      where target_membership.user_id = user_profiles.id
        and target_membership.status = 'active'
        and self_membership.user_id = auth.uid()
        and self_membership.status = 'active'
    )
  );
