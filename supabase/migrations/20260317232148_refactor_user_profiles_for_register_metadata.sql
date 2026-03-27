alter table public.user_profiles
  add column if not exists rut text,
  add column if not exists address text;

alter table public.user_profiles
  drop column if exists email,
  drop column if exists global_name;

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, rut, address)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'rut', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'address', '')), '')
  )
  on conflict (id) do update
    set rut = excluded.rut,
        address = excluded.address,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();
