alter table public.user_profiles
  drop column if exists rut;

drop function if exists public.check_registration_availability(text, text);

create or replace function public.check_registration_availability(
  p_email text default null::text
)
returns table(email_exists boolean)
language plpgsql
security definer
set search_path = 'public', 'auth'
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
    end;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.user_profiles (id, address)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'address', '')), '')
  )
  on conflict (id) do update
    set address = excluded.address,
        updated_at = timezone('utc', now());

  return new;
end;
$$;
