-- Migration: add_get_attendance_history_page_rpc
-- Adds offset-paginated attendance history RPC while keeping get_attendance_records unchanged.

DROP FUNCTION IF EXISTS public.get_attendance_history_page(uuid, uuid, integer, integer, integer, integer);

CREATE FUNCTION public.get_attendance_history_page(
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_month IS NOT NULL AND p_year IS NULL THEN
    RAISE EXCEPTION 'Invalid filter: p_month requires p_year';
  END IF;

  IF p_month IS NOT NULL AND (p_month < 1 OR p_month > 12) THEN
    RAISE EXCEPTION 'Invalid filter: p_month must be between 1 and 12';
  END IF;

  IF p_year IS NOT NULL AND (p_year < 1900 OR p_year > 9999) THEN
    RAISE EXCEPTION 'Invalid filter: p_year out of range';
  END IF;

  IF p_year IS NOT NULL AND p_month IS NOT NULL THEN
    v_filter_start_date := make_date(p_year, p_month, 1);
    v_filter_end_date := (v_filter_start_date + interval '1 month - 1 day')::date;
    v_filter_period_key := format('%s-%s', p_year::text, lpad(p_month::text, 2, '0'));
  ELSIF p_year IS NOT NULL THEN
    v_filter_start_date := make_date(p_year, 1, 1);
    v_filter_end_date := make_date(p_year, 12, 31);
    v_filter_period_key := p_year::text;
  ELSE
    v_filter_start_date := NULL;
    v_filter_end_date := NULL;
    v_filter_period_key := NULL;
  END IF;

  v_offset := v_page * v_page_size;

  SELECT coalesce(ep.weekly_hours, 40)
  INTO v_weekly_hours
  FROM public.employee_profiles AS ep
  WHERE ep.membership_id = p_membership_id
  LIMIT 1;

  v_weekly_hours := coalesce(v_weekly_hours, 40);

  WITH filtered_records AS (
    SELECT
      ar.id,
      ar.work_date,
      ar.clock_in_at,
      ar.clock_out_at,
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
  event_rows AS (
    SELECT
      fr.id AS attendance_id,
      format('%s-in', fr.id::text) AS id,
      'clock_in'::text AS event_type,
      fr.clock_in_at AS occurred_at,
      fr.work_date,
      fr.office_id,
      fr.office_name,
      fr.office_is_remote
    FROM filtered_records AS fr
    UNION ALL
    SELECT
      fr.id AS attendance_id,
      format('%s-out', fr.id::text) AS id,
      'clock_out'::text AS event_type,
      fr.clock_out_at AS occurred_at,
      fr.work_date,
      fr.office_id,
      fr.office_name,
      fr.office_is_remote
    FROM filtered_records AS fr
    WHERE fr.clock_out_at IS NOT NULL
  )
  SELECT
    (SELECT count(*)::bigint FROM event_rows),
    (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', page_events.id,
            'attendance_id', page_events.attendance_id,
            'event_type', page_events.event_type,
            'occurred_at', page_events.occurred_at,
            'work_date', page_events.work_date,
            'office_id', page_events.office_id,
            'office_name', page_events.office_name,
            'office_is_remote', page_events.office_is_remote
          )
          ORDER BY page_events.occurred_at DESC, page_events.attendance_id DESC, page_events.event_type DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT er.*
        FROM event_rows AS er
        ORDER BY er.occurred_at DESC, er.attendance_id DESC, er.event_type DESC
        OFFSET v_offset
        LIMIT v_page_size
      ) AS page_events
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
      'year', p_year,
      'month', p_month,
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
