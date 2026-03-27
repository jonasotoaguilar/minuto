alter table public.organizations
  add column if not exists location text;

create unique index if not exists organizations_owner_name_ci_unique
  on public.organizations (owner_user_id, lower(name));

drop function if exists public.create_organization_with_owner(text, text);

create or replace function public.create_organization_with_owner(
  p_name text,
  p_timezone text default 'America/Santiago',
  p_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
  v_name text;
  v_timezone text;
  v_location text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if v_name = '' then
    raise exception 'Organization name is required';
  end if;
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Organization name length must be between 2 and 120 characters';
  end if;
  if v_name ~ '[<>]' then
    raise exception 'Organization name contains invalid characters';
  end if;

  v_location := regexp_replace(trim(coalesce(p_location, '')), '\s+', ' ', 'g');
  if v_location = '' then
    raise exception 'Organization location is required';
  end if;
  if length(v_location) < 3 or length(v_location) > 180 then
    raise exception 'Organization location length must be between 3 and 180 characters';
  end if;
  if v_location ~ '[<>]' then
    raise exception 'Organization location contains invalid characters';
  end if;

  v_timezone := trim(coalesce(p_timezone, ''));
  if v_timezone = '' then
    v_timezone := 'America/Santiago';
  end if;

  if not exists (
    select 1
    from pg_timezone_names
    where name = v_timezone
  ) then
    raise exception 'Timezone is invalid';
  end if;

  if exists (
    select 1
    from public.organizations o
    where o.owner_user_id = v_user_id
      and lower(o.name) = lower(v_name)
  ) then
    raise exception 'Ya existe una organización con ese nombre.';
  end if;

  insert into public.organizations (name, plan, timezone, location, owner_user_id)
  values (v_name, 'free', v_timezone, v_location, v_user_id)
  returning id into v_org_id;

  insert into public.memberships (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active')
  returning id into v_membership_id;

  insert into public.employee_profiles (membership_id, position, department, hire_date)
  values (v_membership_id, 'CEO', 'Administration', current_date)
  on conflict (membership_id)
  do update
    set position = excluded.position,
        department = excluded.department,
        hire_date = excluded.hire_date,
        updated_at = now();

  return v_org_id;
end;
$$;
