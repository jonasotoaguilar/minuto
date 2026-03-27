create policy "attendance_records_select_for_active_member"
on public.attendance_records
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = attendance_records.membership_id
      and m.organization_id = attendance_records.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy "attendance_records_insert_for_active_member"
on public.attendance_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = attendance_records.membership_id
      and m.organization_id = attendance_records.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy "attendance_records_update_for_active_member"
on public.attendance_records
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = attendance_records.membership_id
      and m.organization_id = attendance_records.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = attendance_records.membership_id
      and m.organization_id = attendance_records.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);
