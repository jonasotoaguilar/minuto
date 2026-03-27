ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Users can update attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Members can insert attendance" ON attendance_records;
DROP POLICY IF EXISTS "Members can update attendance" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_insert_for_active_member" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_select_for_active_member" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_update_for_active_member" ON attendance_records;
CREATE POLICY "Members can view own attendance records" ON attendance_records
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.id = attendance_records.membership_id
      AND m.user_id = auth.uid()
  )
);
COMMENT ON TABLE attendance_records IS 'RLS HARDENED: Users must use register_attendance_event() RPC. Direct INSERT/UPDATE blocked.';
