-- Migration: history_page_grouped_by_workday
-- Purpose:
-- 1) Return attendance history grouped by workday (one row per day)
-- 2) Include missing days in the selected period as absences
-- 3) Keep existing pagination/filter contract

DROP FUNCTION IF EXISTS public.get_attendance_history_page(uuid, uuid, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.get_attendance_history_page(
  p_organization_id uuid,
  p_membership_id uuid,
  p_page integer DEFAULT 0,
  p_page_size integer DEFAULT 10,
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_page integer := greatest(coalesce(p_page, 0), 0);
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 10), 100));
  v_offset integer;
  v_filter_start_date date;
  v_filter_end_date date;
  v_filter_period_key text;
  v_weekly_hours numeric := 40;
  v_shift_duration_hours numeric := 8.0;
  v_break_duration_hours numeric := 0.75;
  v_daily_target_minutes integer := 0;
  v_total_items bigint := 0;
  v_total_pages integer := 0;
  v_has_previous_page boolean := false;
  v_has_next_page boolean := false;
  v_available_periods jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_summary jsonb := jsonb_build_object(
    'weekly_hours', 40,
    'worked_days', 0,
    'total_minutes', 0,
    'overtime_minutes', 0
  );
  v_effective_year integer := p_year;
  v_effective_month integer := p_month;
  v_org_timezone text := 'America/Santiago';
  v_org_today date;
  v_is_current_month boolean := false;
  v_has_today_record boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
      AND m.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_effective_month IS NOT NULL AND v_effective_year IS NULL THEN
    RAISE EXCEPTION 'Invalid filter: p_month requires p_year';
  END IF;

  SELECT coalesce(o.default_timezone, 'America/Santiago')
  INTO v_org_timezone
  FROM public.organizations AS o
  WHERE o.id = p_organization_id
  LIMIT 1;

  v_org_today := timezone(v_org_timezone, now())::date;

  IF v_effective_year IS NULL AND v_effective_month IS NULL THEN
    v_effective_year := extract(year FROM v_org_today)::integer;
    v_effective_month := extract(month FROM v_org_today)::integer;
  END IF;

  IF v_effective_month IS NOT NULL
     AND (v_effective_month < 1 OR v_effective_month > 12) THEN
    RAISE EXCEPTION 'Invalid filter: p_month must be between 1 and 12';
  END IF;

  IF v_effective_year IS NOT NULL
     AND (v_effective_year < 1900 OR v_effective_year > 9999) THEN
    RAISE EXCEPTION 'Invalid filter: p_year out of range';
  END IF;

  IF v_effective_year IS NOT NULL AND v_effective_month IS NOT NULL THEN
    v_filter_start_date := make_date(v_effective_year, v_effective_month, 1);
    v_filter_end_date :=
      (v_filter_start_date + interval '1 month - 1 day')::date;
    v_filter_period_key := format(
      '%s-%s',
      v_effective_year::text,
      lpad(v_effective_month::text, 2, '0')
    );
  ELSIF v_effective_year IS NOT NULL THEN
    v_filter_start_date := make_date(v_effective_year, 1, 1);
    v_filter_end_date := make_date(v_effective_year, 12, 31);
    v_filter_period_key := v_effective_year::text;
  ELSE
    v_filter_start_date := NULL;
    v_filter_end_date := NULL;
    v_filter_period_key := NULL;
  END IF;

  v_is_current_month :=
    v_effective_year = extract(year FROM v_org_today)::integer
    AND v_effective_month = extract(month FROM v_org_today)::integer;

  IF v_is_current_month THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.attendance_records AS ar
      WHERE ar.organization_id = p_organization_id
        AND ar.membership_id = p_membership_id
        AND ar.work_date = v_org_today
    )
    INTO v_has_today_record;

    v_filter_end_date := least(
      v_filter_end_date,
      CASE
        WHEN v_has_today_record THEN v_org_today
        ELSE v_org_today - 1
      END
    );
  END IF;

  v_offset := v_page * v_page_size;

  SELECT
    coalesce(ep.weekly_hours, 40),
    coalesce(ep.shift_duration_hours, 8.0),
    coalesce(ep.break_duration_hours, 0.75)
  INTO v_weekly_hours, v_shift_duration_hours, v_break_duration_hours
  FROM public.employee_profiles AS ep
  WHERE ep.membership_id = p_membership_id
  LIMIT 1;

  v_weekly_hours := coalesce(v_weekly_hours, 40);
  v_shift_duration_hours := coalesce(v_shift_duration_hours, 8.0);
  v_break_duration_hours := coalesce(v_break_duration_hours, 0.75);
  v_daily_target_minutes := greatest(
    0,
    round((v_shift_duration_hours - v_break_duration_hours) * 60)::integer
  );

  WITH filtered_records AS (
    SELECT
      ar.id,
      ar.work_date,
      ar.clock_in_at,
      ar.clock_out_at,
      ar.auto_closed,
      coalesce(ep.break_duration_hours, 0.75) AS break_duration_hours,
      ar.office_id,
      oo.name AS office_name,
      oo.is_remote AS office_is_remote
    FROM public.attendance_records AS ar
    LEFT JOIN public.employee_profiles AS ep ON ep.membership_id = ar.membership_id
    LEFT JOIN public.organization_offices AS oo ON oo.id = ar.office_id
    WHERE ar.organization_id = p_organization_id
      AND ar.membership_id = p_membership_id
      AND (v_filter_start_date IS NULL OR ar.work_date >= v_filter_start_date)
      AND (v_filter_end_date IS NULL OR ar.work_date <= v_filter_end_date)
  ),
  calendar_days AS (
    SELECT gs::date AS work_date
    FROM generate_series(v_filter_start_date, v_filter_end_date, interval '1 day') AS gs
  ),
  daily_rows AS (
    SELECT
      cd.work_date,
      count(fr.id) > 0 AS has_record,
      min(fr.clock_in_at) AS clock_in_at,
      max(fr.clock_out_at) FILTER (WHERE fr.clock_out_at IS NOT NULL) AS clock_out_at,
      coalesce(bool_or(fr.auto_closed), false) AS auto_closed,
      (array_agg(fr.office_id ORDER BY fr.clock_in_at DESC NULLS LAST, fr.id DESC))[1] AS office_id,
      (array_agg(fr.office_name ORDER BY fr.clock_in_at DESC NULLS LAST, fr.id DESC))[1] AS office_name,
      coalesce(bool_or(fr.office_is_remote), false) AS office_is_remote,
      coalesce(
        sum(
          CASE
            WHEN fr.clock_out_at IS NULL THEN 0
            ELSE greatest(
              0,
              floor(extract(epoch FROM (fr.clock_out_at - fr.clock_in_at)) / 60)::integer
              - greatest(0, round(fr.break_duration_hours * 60)::integer)
            )
          END
        ),
        0
      )::integer AS worked_minutes
    FROM calendar_days AS cd
    LEFT JOIN filtered_records AS fr ON fr.work_date = cd.work_date
    GROUP BY cd.work_date
  )
  SELECT
    (SELECT count(*)::bigint FROM calendar_days),
    (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', paged.work_date::text,
            'work_date', paged.work_date,
            'has_record', paged.has_record,
            'clock_in_at', paged.clock_in_at,
            'clock_out_at', paged.clock_out_at,
            'auto_closed', paged.auto_closed,
            'status', CASE
              WHEN NOT paged.has_record THEN 'absence'
              WHEN paged.auto_closed THEN 'auto_closed'
              WHEN paged.worked_minutes >= v_daily_target_minutes THEN 'complete'
              ELSE 'incomplete'
            END,
            'worked_minutes', paged.worked_minutes,
            'required_minutes', v_daily_target_minutes,
            'office_id', paged.office_id,
            'office_name', paged.office_name,
            'office_is_remote', paged.office_is_remote
          )
          ORDER BY paged.work_date DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT dr.*
        FROM daily_rows AS dr
        ORDER BY dr.work_date DESC
        OFFSET v_offset
        LIMIT v_page_size
      ) AS paged
    ),
    jsonb_build_object(
      'weekly_hours', v_weekly_hours,
      'worked_days', (
        SELECT count(DISTINCT fr.work_date)::integer
        FROM filtered_records AS fr
      ),
      'total_minutes', (
        SELECT coalesce(
          sum(
            greatest(
              0,
              floor(extract(epoch FROM (fr.clock_out_at - fr.clock_in_at)) / 60)::integer
              - greatest(0, round(fr.break_duration_hours * 60)::integer)
            )
          ),
          0
        )::integer
        FROM filtered_records AS fr
        WHERE fr.clock_out_at IS NOT NULL
      ),
      'overtime_minutes', (
        SELECT coalesce(
          sum(greatest(0, weekly_totals.week_minutes - round(v_weekly_hours * 60)::integer)),
          0
        )::integer
        FROM (
          SELECT
            date_trunc('week', fr.work_date::timestamp)::date AS week_start,
            sum(
              greatest(
                0,
                floor(extract(epoch FROM (fr.clock_out_at - fr.clock_in_at)) / 60)::integer
                - greatest(0, round(fr.break_duration_hours * 60)::integer)
              )
            )::integer AS week_minutes
          FROM filtered_records AS fr
          WHERE fr.clock_out_at IS NOT NULL
          GROUP BY 1
        ) AS weekly_totals
      )
    )
  INTO v_total_items, v_items, v_summary;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'year', periods.period_year,
        'month', periods.period_month,
        'period_key', format('%s-%s', periods.period_year::text, lpad(periods.period_month::text, 2, '0')),
        'start_date', make_date(periods.period_year, periods.period_month, 1),
        'end_date', (make_date(periods.period_year, periods.period_month, 1) + interval '1 month - 1 day')::date
      )
      ORDER BY periods.period_year DESC, periods.period_month DESC
    ),
    '[]'::jsonb
  )
  INTO v_available_periods
  FROM (
    SELECT
      extract(year FROM ar.work_date)::integer AS period_year,
      extract(month FROM ar.work_date)::integer AS period_month
    FROM public.attendance_records AS ar
    WHERE ar.organization_id = p_organization_id
      AND ar.membership_id = p_membership_id
    GROUP BY 1, 2
  ) AS periods;

  v_total_pages :=
    CASE
      WHEN v_total_items = 0 THEN 0
      ELSE ceil(v_total_items::numeric / v_page_size::numeric)::integer
    END;

  v_has_previous_page := v_page > 0;
  v_has_next_page := (v_page + 1) < v_total_pages;

  RETURN jsonb_build_object(
    'page', v_page,
    'page_size', v_page_size,
    'total_items', v_total_items,
    'total_pages', v_total_pages,
    'has_previous_page', v_has_previous_page,
    'has_next_page', v_has_next_page,
    'filter', jsonb_build_object(
      'year', v_effective_year,
      'month', v_effective_month,
      'period_key', v_filter_period_key,
      'start_date', v_filter_start_date,
      'end_date', v_filter_end_date
    ),
    'available_periods', v_available_periods,
    'summary', v_summary,
    'items', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_history_page(
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer
) TO authenticated;
