create extension if not exists "pgcrypto";

create type public.organization_plan as enum ('free', 'pro', 'enterprise');
create type public.membership_role as enum ('owner', 'admin', 'manager', 'employee');
create type public.membership_status as enum ('invited', 'active', 'suspended');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  global_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan public.organization_plan not null default 'free',
  timezone text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role public.membership_role not null,
  status public.membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_user_or_email_check check (
    user_id is not null or invited_email is not null
  ),
  constraint memberships_id_org_unique unique (id, organization_id)
);

create unique index memberships_unique_user_per_org
  on public.memberships (organization_id, user_id)
  where user_id is not null;

create unique index memberships_unique_invite_per_org
  on public.memberships (organization_id, invited_email)
  where invited_email is not null;

create table public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references public.memberships(id) on delete cascade,
  position text,
  department text,
  hire_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  membership_id uuid not null,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_clock_out_after_in check (
    clock_out_at is null or clock_out_at >= clock_in_at
  ),
  constraint attendance_membership_org_fk foreign key (membership_id, organization_id)
    references public.memberships (id, organization_id) on delete cascade
);

create unique index attendance_unique_member_day
  on public.attendance_records (membership_id, work_date);

create index attendance_org_day
  on public.attendance_records (organization_id, work_date);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_memberships_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

create trigger set_employee_profiles_updated_at
before update on public.employee_profiles
for each row execute function public.set_updated_at();

create trigger set_attendance_records_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();
