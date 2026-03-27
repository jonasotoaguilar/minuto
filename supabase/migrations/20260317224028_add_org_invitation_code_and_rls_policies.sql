alter table public.memberships
  add column if not exists invitation_code text,
  add column if not exists invitation_expires_at timestamptz;

create unique index if not exists memberships_invitation_code_unique
  on public.memberships (invitation_code)
  where invitation_code is not null;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create policy organizations_select_for_active_members
on public.organizations
for select
using (
  exists (
    select 1
    from public.memberships m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy organizations_insert_for_owner
on public.organizations
for insert
with check (owner_user_id = auth.uid());

create policy organizations_update_for_owner
on public.organizations
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy organizations_delete_for_owner
on public.organizations
for delete
using (owner_user_id = auth.uid());

create policy memberships_select_for_self_or_invited_email
on public.memberships
for select
using (
  user_id = auth.uid()
  or (
    status = 'invited'
    and invited_email is not null
    and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy memberships_insert_owner_membership
on public.memberships
for insert
with check (
  user_id = auth.uid()
  and role = 'owner'
  and status = 'active'
  and exists (
    select 1
    from public.organizations o
    where o.id = memberships.organization_id
      and o.owner_user_id = auth.uid()
  )
);

create policy memberships_insert_invitation_by_owner
on public.memberships
for insert
with check (
  invited_email is not null
  and status = 'invited'
  and user_id is null
  and exists (
    select 1
    from public.organizations o
    where o.id = memberships.organization_id
      and o.owner_user_id = auth.uid()
  )
);

create policy memberships_update_for_self_or_invite_claim
on public.memberships
for update
using (
  user_id = auth.uid()
  or (
    status = 'invited'
    and invited_email is not null
    and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  user_id = auth.uid()
  or (
    invited_email is not null
    and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
