create or replace function public.check_registration_availability(
  p_email text default null,
  p_rut text default null
)
returns table(email_exists boolean, rut_exists boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  select
    case
      when p_email is null or btrim(p_email) = '' then false
      else exists (
        select 1
        from auth.users u
        where lower(u.email) = lower(btrim(p_email))
      )
    end,
    case
      when p_rut is null or btrim(p_rut) = '' then false
      else exists (
        select 1
        from public.user_profiles up
        where upper(up.rut) = upper(btrim(p_rut))
      )
    end;
end;
$$;

grant execute on function public.check_registration_availability(text, text)
to anon, authenticated;

create unique index if not exists user_profiles_rut_unique
  on public.user_profiles (rut)
  where rut is not null;
