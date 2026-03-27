create or replace function public.create_organization_with_owner(
  p_name text,
  p_timezone text default 'America/Santiago'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_name text;
  v_timezone text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'Organization name is required';
  end if;

  v_timezone := trim(coalesce(p_timezone, ''));
  if v_timezone = '' then
    v_timezone := 'America/Santiago';
  end if;

  insert into public.organizations (name, plan, timezone, owner_user_id)
  values (v_name, 'free', v_timezone, v_user_id)
  returning id into v_org_id;

  insert into public.memberships (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  return v_org_id;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text) from public;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;
