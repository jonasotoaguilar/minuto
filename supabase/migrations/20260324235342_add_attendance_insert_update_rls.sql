COMMENT ON TABLE public.attendance_records IS 'Attendance records for organization members';

CREATE POLICY "Members can insert own attendance records"
  ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = attendance_records.membership_id
        AND m.organization_id = attendance_records.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

CREATE POLICY "Members can update own attendance records"
  ON public.attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = attendance_records.membership_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = attendance_records.membership_id
        AND m.organization_id = attendance_records.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );
