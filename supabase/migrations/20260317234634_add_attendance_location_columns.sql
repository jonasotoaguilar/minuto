alter table public.attendance_records
  add column if not exists clock_in_location jsonb,
  add column if not exists clock_out_location jsonb;
