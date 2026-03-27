DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'attendance_records'
      AND indexname = 'attendance_unique_member_day'
  ) THEN
    COMMENT ON INDEX attendance_unique_member_day IS 'Ensures one attendance record per member per day. Required for register_attendance_event UPSERT.';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'attendance_records'
      AND indexname = 'attendance_records_org_member_date_unique'
  ) THEN
    CREATE UNIQUE INDEX attendance_unique_member_day ON attendance_records (organization_id, membership_id, work_date);
    COMMENT ON INDEX attendance_unique_member_day IS 'Ensures one attendance record per member per day. Required for register_attendance_event UPSERT.';
  END IF;
END $$;
