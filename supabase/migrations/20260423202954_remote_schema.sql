create extension if not exists "pg_cron" with schema "pg_catalog";

create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

create extension if not exists "postgis" with schema "extensions";

drop extension if exists "pg_net";

drop policy "attendance_records_insert" on "public"."attendance_records";

drop policy "attendance_records_update" on "public"."attendance_records";

revoke delete on table "public"."spatial_ref_sys" from "anon";

revoke insert on table "public"."spatial_ref_sys" from "anon";

revoke references on table "public"."spatial_ref_sys" from "anon";

revoke select on table "public"."spatial_ref_sys" from "anon";

revoke trigger on table "public"."spatial_ref_sys" from "anon";

revoke truncate on table "public"."spatial_ref_sys" from "anon";

revoke update on table "public"."spatial_ref_sys" from "anon";

revoke delete on table "public"."spatial_ref_sys" from "authenticated";

revoke insert on table "public"."spatial_ref_sys" from "authenticated";

revoke references on table "public"."spatial_ref_sys" from "authenticated";

revoke select on table "public"."spatial_ref_sys" from "authenticated";

revoke trigger on table "public"."spatial_ref_sys" from "authenticated";

revoke truncate on table "public"."spatial_ref_sys" from "authenticated";

revoke update on table "public"."spatial_ref_sys" from "authenticated";

revoke delete on table "public"."spatial_ref_sys" from "postgres";

revoke insert on table "public"."spatial_ref_sys" from "postgres";

revoke references on table "public"."spatial_ref_sys" from "postgres";

revoke select on table "public"."spatial_ref_sys" from "postgres";

revoke trigger on table "public"."spatial_ref_sys" from "postgres";

revoke truncate on table "public"."spatial_ref_sys" from "postgres";

revoke update on table "public"."spatial_ref_sys" from "postgres";

revoke delete on table "public"."spatial_ref_sys" from "service_role";

revoke insert on table "public"."spatial_ref_sys" from "service_role";

revoke references on table "public"."spatial_ref_sys" from "service_role";

revoke select on table "public"."spatial_ref_sys" from "service_role";

revoke trigger on table "public"."spatial_ref_sys" from "service_role";

revoke truncate on table "public"."spatial_ref_sys" from "service_role";

revoke update on table "public"."spatial_ref_sys" from "service_role";

drop type "public"."geometry_dump";

drop function if exists "public"."is_active_member_of_organization"(p_organization_id uuid);

drop type "public"."valid_detail";

drop function if exists "public"."create_membership_invitation"(p_organization_id uuid, p_invited_email text, p_role text);

drop index if exists "public"."attendance_records_clock_in_point_gist";

drop index if exists "public"."attendance_records_clock_out_point_gist";

alter table "public"."attendance_records" drop column "clock_in_location";

alter table "public"."attendance_records" drop column "clock_in_point";

alter table "public"."attendance_records" drop column "clock_out_location";

alter table "public"."attendance_records" drop column "clock_out_point";

alter table "public"."attendance_records" alter column "office_id" set not null;

alter table "public"."employee_profiles" add column "weekly_hours" numeric not null default 40;

alter table "public"."employee_profiles" enable row level security;

alter table "public"."organization_offices" alter column "location_point" set data type extensions.geography(Point,4326) using "location_point"::extensions.geography(Point,4326);

alter table "public"."organizations" drop column "location";

drop extension if exists "postgis";

alter table "public"."employee_profiles" add constraint "employee_profiles_weekly_hours_check" CHECK (((weekly_hours > (0)::numeric) AND (weekly_hours <= (100)::numeric))) not valid;

alter table "public"."employee_profiles" validate constraint "employee_profiles_weekly_hours_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_active_member_of_organization(target_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_membership_role(p_membership_id uuid, p_new_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_target_org_id uuid;
  v_target_user_id uuid;
  v_target_current_role text;
  v_caller_role text;
  v_allowed_roles text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Get target membership info
  SELECT m.organization_id, m.user_id, m.role::text
  INTO v_target_org_id, v_target_user_id, v_target_current_role
  FROM public.memberships AS m
  WHERE m.id = p_membership_id AND m.status = 'active'::public.membership_status;

  IF v_target_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MEMBERSHIP_NOT_FOUND');
  END IF;

  -- Cannot change your own role
  IF v_target_user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_CHANGE_OWN_ROLE');
  END IF;

  -- Cannot change the role of the owner
  IF v_target_current_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_CHANGE_OWNER_ROLE');
  END IF;

  -- Get caller's role in the same organization
  SELECT m.role::text INTO v_caller_role
  FROM public.memberships AS m
  WHERE m.organization_id = v_target_org_id AND m.user_id = v_user_id
    AND m.status = 'active'::public.membership_status;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Determine allowed target roles based on caller's role
  IF v_caller_role = 'owner' THEN
    v_allowed_roles := ARRAY['admin', 'manager', 'employee'];
  ELSIF v_caller_role = 'admin' THEN
    v_allowed_roles := ARRAY['manager', 'employee'];
  ELSE
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Validate the new role is allowed
  IF p_new_role IS NULL OR NOT (p_new_role = ANY(v_allowed_roles)) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_ROLE');
  END IF;

  -- Admin cannot change someone who is already admin (only owner can)
  IF v_caller_role = 'admin' AND v_target_current_role = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Apply the role change
  UPDATE public.memberships
  SET role = p_new_role::public.membership_role, updated_at = now()
  WHERE id = p_membership_id;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'new_role', p_new_role
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.attendance_clock_in(p_organization_id uuid, p_membership_id uuid, p_work_date date, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision, p_office_id uuid DEFAULT NULL::uuid, p_is_remote boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_record_id uuid; v_office_id uuid; v_office_name text;
  v_user_point extensions.geography; v_user_org_id uuid; v_open_shift jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships AS m WHERE m.id = p_membership_id AND m.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Unauthorized: membership does not belong to caller'; END IF;

  SELECT m.organization_id INTO v_user_org_id FROM public.memberships AS m WHERE m.id = p_membership_id;
  IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Unauthorized: organization mismatch'; END IF;

  v_open_shift := public.get_open_shift(p_membership_id);
  IF v_open_shift IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'OPEN_SHIFT_EXISTS',
      'record_id', v_open_shift -> 'record_id', 'work_date', v_open_shift -> 'work_date',
      'clock_in_at', v_open_shift -> 'clock_in_at', 'open_shift', v_open_shift);
  END IF;

  IF p_is_remote THEN
    SELECT id, name INTO v_office_id, v_office_name FROM public.organization_offices
    WHERE organization_id = v_user_org_id AND is_remote = true LIMIT 1;
    IF v_office_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'NO_REMOTE_OFFICE'); END IF;
  ELSIF p_office_id IS NOT NULL THEN
    SELECT id, name INTO v_office_id, v_office_name FROM public.organization_offices
    WHERE id = p_office_id AND organization_id = v_user_org_id AND is_remote = false LIMIT 1;
    IF v_office_id IS NULL THEN RAISE EXCEPTION 'Invalid office for organization'; END IF;
  ELSE
    IF p_accuracy > 50 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'GPS_ACCURACY_TOO_LOW'); END IF;
    v_user_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography;
    SELECT id, name INTO v_office_id, v_office_name FROM public.organization_offices
    WHERE organization_id = v_user_org_id AND is_remote = false
      AND extensions.ST_DWithin(location_point, v_user_point, 100)
    ORDER BY extensions.ST_Distance(location_point, v_user_point) ASC LIMIT 1;
    IF v_office_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'OUT_OF_RANGE'); END IF;
  END IF;

  BEGIN
    INSERT INTO public.attendance_records (organization_id, membership_id, work_date, clock_in_at, office_id)
    VALUES (p_organization_id, p_membership_id, p_work_date, now(), v_office_id)
    RETURNING id INTO v_record_id;
  EXCEPTION WHEN unique_violation THEN
    v_open_shift := public.get_open_shift(p_membership_id);
    IF v_open_shift IS NULL THEN RAISE; END IF;
    RETURN jsonb_build_object('success', false, 'error_code', 'OPEN_SHIFT_EXISTS',
      'record_id', v_open_shift -> 'record_id', 'work_date', v_open_shift -> 'work_date',
      'clock_in_at', v_open_shift -> 'clock_in_at', 'open_shift', v_open_shift);
  END;

  RETURN jsonb_build_object('success', true, 'record_id', v_record_id,
    'office_id', v_office_id, 'office_name', v_office_name);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.attendance_clock_out(p_record_id uuid, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision, p_is_remote boolean DEFAULT false, p_custom_close_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_auto_closed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_office_name text; v_clock_in_at timestamptz; v_close_at timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance_records AS ar
    JOIN public.memberships AS m ON m.id = ar.membership_id
    WHERE ar.id = p_record_id AND m.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Unauthorized: record does not belong to caller'; END IF;

  SELECT ar.clock_in_at INTO v_clock_in_at
  FROM public.attendance_records AS ar WHERE ar.id = p_record_id AND ar.clock_out_at IS NULL;
  IF v_clock_in_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NO_OPEN_RECORD'); END IF;

  v_close_at := coalesce(p_custom_close_at, now());
  IF v_close_at < v_clock_in_at THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CLOSE_TIME', 'clock_in_at', v_clock_in_at); END IF;

  SELECT oo.name INTO v_office_name
  FROM public.attendance_records AS ar
  JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.id = p_record_id;

  UPDATE public.attendance_records
  SET clock_out_at = v_close_at, auto_closed = p_auto_closed, updated_at = now()
  WHERE id = p_record_id;

  RETURN jsonb_build_object('success', true, 'office_name', v_office_name,
    'clock_out_at', v_close_at, 'auto_closed', p_auto_closed);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_close_stale_shifts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.attendance_records AS ar
  SET clock_out_at = ar.clock_in_at + ((ep.shift_duration_hours + ep.break_duration_hours) * interval '1 hour'),
      auto_closed = true, updated_at = now()
  FROM public.employee_profiles AS ep
  WHERE ep.membership_id = ar.membership_id
    AND ar.clock_out_at IS NULL
    AND ar.clock_in_at + interval '16 hours' < now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_membership_invitation(p_organization_id uuid, p_invited_email text, p_role text)
 RETURNS public.memberships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_membership_id uuid;
  v_actor_role public.membership_role;
  v_code text;
  v_expires_at timestamptz;
  v_invitation public.memberships%ROWTYPE;
  v_invited_email text;
  v_role public.membership_role;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT m.id, m.role
  INTO v_actor_membership_id, v_actor_role
  FROM public.memberships AS m
  WHERE m.organization_id = p_organization_id
    AND m.user_id = v_user_id
    AND m.status = 'active'::public.membership_status
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF v_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'No tenés permisos para invitar miembros.';
  END IF;

  IF p_role IS NULL OR trim(p_role) = '' THEN
    RAISE EXCEPTION 'Debés seleccionar un rol para la invitación.';
  END IF;

  BEGIN
    v_role := lower(trim(p_role))::public.membership_role;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'El rol seleccionado no es válido.';
  END;

  IF NOT public.can_manage_membership_role(v_actor_role, v_role) THEN
    RAISE EXCEPTION 'No tenés permisos para invitar con ese rol.';
  END IF;

  v_invited_email := lower(trim(coalesce(p_invited_email, '')));

  IF v_invited_email = '' THEN
    RAISE EXCEPTION 'Debés ingresar un email para invitar.';
  END IF;

  SELECT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  INTO v_code;
  v_expires_at := now() + interval '14 days';

  INSERT INTO public.memberships (
    organization_id,
    user_id,
    invited_email,
    role,
    status,
    invitation_code,
    invitation_expires_at
  )
  VALUES (
    p_organization_id,
    NULL,
    v_invited_email,
    v_role,
    'invited'::public.membership_status,
    v_code,
    v_expires_at
  )
  ON CONFLICT (organization_id, invited_email) WHERE invited_email IS NOT NULL
  DO UPDATE
  SET user_id = NULL,
      role = EXCLUDED.role,
      status = 'invited'::public.membership_status,
      invitation_code = EXCLUDED.invitation_code,
      invitation_expires_at = EXCLUDED.invitation_expires_at,
      updated_at = now()
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_organization_office(p_organization_id uuid, p_name text, p_address_label text, p_latitude double precision, p_longitude double precision)
 RETURNS public.organization_offices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_address_label text; v_name text;
  v_office public.organization_offices%ROWTYPE; v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = p_organization_id AND m.user_id = v_user_id
      AND m.status = 'active'::public.membership_status
      AND m.role::text IN ('owner', 'admin', 'manager')
  ) THEN RAISE EXCEPTION 'No tenés permisos para crear oficinas en esta organización.'; END IF;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF v_name = '' THEN RAISE EXCEPTION 'Office name is required'; END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Office name length must be between 2 and 120 characters'; END IF;
  IF v_name ~ '[<>]' THEN RAISE EXCEPTION 'Office name contains invalid characters'; END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'Office coordinates must include both latitude and longitude'; END IF;
  IF p_latitude < -90 OR p_latitude > 90 THEN
    RAISE EXCEPTION 'Office latitude must be between -90 and 90'; END IF;
  IF p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Office longitude must be between -180 and 180'; END IF;

  v_address_label := NULLIF(regexp_replace(trim(coalesce(p_address_label, '')), '\s+', ' ', 'g'), '');
  IF v_address_label IS NOT NULL THEN
    IF length(v_address_label) < 3 OR length(v_address_label) > 180 THEN
      RAISE EXCEPTION 'Office address label length must be between 3 and 180 characters'; END IF;
    IF v_address_label ~ '[<>]' THEN
      RAISE EXCEPTION 'Office address label contains invalid characters'; END IF;
  END IF;

  INSERT INTO public.organization_offices (organization_id, name, address_label, location_point, is_remote)
  VALUES (p_organization_id, v_name, v_address_label,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography, false)
  RETURNING * INTO v_office;
  RETURN v_office;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name text, p_default_timezone text DEFAULT 'America/Santiago'::text, p_location text DEFAULT NULL::text, p_office_name text DEFAULT NULL::text, p_office_address_label text DEFAULT NULL::text, p_office_latitude double precision DEFAULT NULL::double precision, p_office_longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_default_timezone text;
  v_membership_id uuid;
  v_name text;
  v_office_address_label text;
  v_office_name text;
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF v_name = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Organization name length must be between 2 and 120 characters';
  END IF;
  IF v_name ~ '[<>]' THEN
    RAISE EXCEPTION 'Organization name contains invalid characters';
  END IF;

  v_default_timezone := trim(coalesce(p_default_timezone, ''));
  IF v_default_timezone = '' THEN
    v_default_timezone := 'America/Santiago';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_timezone_names
    WHERE name = v_default_timezone
  ) THEN
    RAISE EXCEPTION 'Default timezone is invalid';
  END IF;

  IF (p_office_latitude IS NULL) <> (p_office_longitude IS NULL) THEN
    RAISE EXCEPTION 'Office coordinates must include both latitude and longitude';
  END IF;

  IF p_office_latitude IS NOT NULL THEN
    IF p_office_latitude < -90 OR p_office_latitude > 90 THEN
      RAISE EXCEPTION 'Office latitude must be between -90 and 90';
    END IF;
    IF p_office_longitude < -180 OR p_office_longitude > 180 THEN
      RAISE EXCEPTION 'Office longitude must be between -180 and 180';
    END IF;

    v_office_name := NULLIF(
      regexp_replace(trim(coalesce(p_office_name, '')), '\s+', ' ', 'g'),
      ''
    );
    IF v_office_name IS NULL THEN
      RAISE EXCEPTION 'Office name is required when coordinates are provided';
    END IF;
    IF length(v_office_name) < 2 OR length(v_office_name) > 120 THEN
      RAISE EXCEPTION 'Office name length must be between 2 and 120 characters';
    END IF;
    IF v_office_name ~ '[<>]' THEN
      RAISE EXCEPTION 'Office name contains invalid characters';
    END IF;

    v_office_address_label := NULLIF(
      regexp_replace(
        trim(coalesce(p_office_address_label, p_location, '')),
        '\s+',
        ' ',
        'g'
      ),
      ''
    );
    IF v_office_address_label IS NOT NULL THEN
      IF length(v_office_address_label) < 3 OR length(v_office_address_label) > 180 THEN
        RAISE EXCEPTION 'Office address label length must be between 3 and 180 characters';
      END IF;
      IF v_office_address_label ~ '[<>]' THEN
        RAISE EXCEPTION 'Office address label contains invalid characters';
      END IF;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations AS o
    WHERE o.owner_user_id = v_user_id
      AND lower(o.name) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Ya existe una organización con ese nombre.';
  END IF;

  INSERT INTO public.organizations (
    default_timezone,
    name,
    plan,
    owner_user_id
  )
  VALUES (
    v_default_timezone,
    v_name,
    'free',
    v_user_id
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user_id, 'owner', 'active')
  RETURNING id INTO v_membership_id;

  INSERT INTO public.employee_profiles (membership_id, position, department, hire_date)
  VALUES (v_membership_id, 'CEO', 'Administración', current_date)
  ON CONFLICT (membership_id)
  DO UPDATE
    SET position = excluded.position,
        department = excluded.department,
        hire_date = excluded.hire_date,
        updated_at = now();

  INSERT INTO public.organization_offices (
    organization_id,
    name,
    address_label,
    location_point,
    is_remote
  )
  VALUES (
    v_org_id,
    'Remote',
    NULL,
    NULL,
    true
  );

  IF p_office_latitude IS NOT NULL THEN
    INSERT INTO public.organization_offices (
      organization_id,
      name,
      address_label,
      location_point,
      is_remote
    )
    VALUES (
      v_org_id,
      v_office_name,
      v_office_address_label,
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(p_office_longitude, p_office_latitude),
        4326
      )::extensions.geography,
      false
    );
  END IF;

  RETURN v_org_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_attendance_records(p_organization_id uuid, p_membership_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, organization_id uuid, membership_id uuid, work_date date, clock_in_at timestamp with time zone, clock_out_at timestamp with time zone, break_duration_hours numeric, office_id uuid, office_name text, office_is_remote boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships AS m WHERE m.id = p_membership_id AND m.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  RETURN QUERY
  SELECT ar.id, ar.organization_id, ar.membership_id, ar.work_date,
    ar.clock_in_at, ar.clock_out_at,
    coalesce(ep.break_duration_hours, 0.75) AS break_duration_hours,
    ar.office_id, oo.name AS office_name, oo.is_remote AS office_is_remote,
    ar.created_at, ar.updated_at
  FROM public.attendance_records AS ar
  LEFT JOIN public.employee_profiles AS ep ON ep.membership_id = ar.membership_id
  LEFT JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.organization_id = p_organization_id AND ar.membership_id = p_membership_id
    AND (p_start_date IS NULL OR ar.work_date >= p_start_date)
    AND (p_end_date IS NULL OR ar.work_date <= p_end_date)
  ORDER BY ar.work_date DESC, ar.clock_in_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_open_shift(p_membership_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_open_shift jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships AS m WHERE m.id = p_membership_id AND m.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Unauthorized: membership does not belong to caller'; END IF;

  SELECT jsonb_build_object(
    'record_id', ar.id, 'work_date', ar.work_date, 'clock_in_at', ar.clock_in_at,
    'office_id', ar.office_id, 'office_name', oo.name, 'office_is_remote', oo.is_remote,
    'shift_duration_hours', ep.shift_duration_hours, 'break_duration_hours', ep.break_duration_hours
  ) INTO v_open_shift
  FROM public.attendance_records AS ar
  JOIN public.employee_profiles AS ep ON ep.membership_id = ar.membership_id
  LEFT JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.membership_id = p_membership_id AND ar.clock_out_at IS NULL
  ORDER BY ar.clock_in_at DESC, ar.created_at DESC, ar.id DESC LIMIT 1;

  RETURN v_open_shift;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_organization_offices(p_organization_id uuid)
 RETURNS TABLE(id uuid, name text, address_label text, is_remote boolean, latitude double precision, longitude double precision, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    oo.id,
    oo.name,
    oo.address_label,
    oo.is_remote,
    extensions.ST_Y(oo.location_point::extensions.geometry) as latitude,
    extensions.ST_X(oo.location_point::extensions.geometry) as longitude,
    oo.organization_id
  FROM organization_offices oo
  WHERE oo.organization_id = p_organization_id
    AND oo.is_remote = false
  ORDER BY oo.name ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.list_pending_membership_invitations(p_organization_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, organization_name text, invited_email text, role public.membership_role, status public.membership_status, invitation_code text, invitation_expires_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role public.membership_role;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT memberships.role
  INTO v_actor_role
  FROM public.memberships
  WHERE memberships.organization_id = p_organization_id
    AND memberships.user_id = v_user_id
    AND memberships.status = 'active'::public.membership_status;

  IF v_actor_role IS NULL OR v_actor_role NOT IN (
    'owner'::public.membership_role,
    'admin'::public.membership_role,
    'manager'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para ver invitaciones pendientes.';
  END IF;

  RETURN QUERY
  SELECT memberships.id,
         memberships.organization_id,
         organizations.name,
         memberships.invited_email,
         memberships.role,
         memberships.status,
         memberships.invitation_code,
         memberships.invitation_expires_at,
         memberships.created_at
  FROM public.memberships
  JOIN public.organizations
    ON organizations.id = memberships.organization_id
  WHERE memberships.organization_id = p_organization_id
    AND memberships.status = 'invited'::public.membership_status
  ORDER BY memberships.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_membership_invitation(p_membership_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role public.membership_role;
  v_invitation public.memberships%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.memberships
  WHERE id = p_membership_id
  FOR UPDATE;

  IF v_invitation.id IS NULL OR v_invitation.status <> 'invited'::public.membership_status THEN
    RAISE EXCEPTION 'La invitación pendiente ya no existe.';
  END IF;

  SELECT memberships.role
  INTO v_actor_role
  FROM public.memberships
  WHERE memberships.organization_id = v_invitation.organization_id
    AND memberships.user_id = v_user_id
    AND memberships.status = 'active'::public.membership_status;

  IF v_actor_role IS NULL OR v_actor_role NOT IN (
    'owner'::public.membership_role,
    'admin'::public.membership_role,
    'manager'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para revocar esta invitación.';
  END IF;

  IF NOT public.can_manage_membership_role(v_actor_role, v_invitation.role) THEN
    RAISE EXCEPTION 'No tenés permisos para revocar esta invitación.';
  END IF;

  DELETE FROM public.memberships
  WHERE id = v_invitation.id;

  RETURN QUERY
  SELECT v_invitation.id,
         v_invitation.organization_id,
         'revoked'::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_employee_profile(p_membership_id uuid, p_shift_duration_hours numeric DEFAULT NULL::numeric, p_break_duration_hours numeric DEFAULT NULL::numeric, p_position text DEFAULT NULL::text, p_department text DEFAULT NULL::text, p_hire_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id uuid; v_current_shift numeric; v_current_break numeric;
  v_next_shift numeric; v_next_break numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT m.organization_id INTO v_organization_id FROM public.memberships AS m WHERE m.id = p_membership_id;
  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MEMBERSHIP_NOT_FOUND'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = v_organization_id AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status AND m.role::text IN ('owner', 'admin', 'manager')
  ) THEN RAISE EXCEPTION 'Unauthorized: insufficient membership permissions'; END IF;

  INSERT INTO public.employee_profiles (membership_id) VALUES (p_membership_id)
  ON CONFLICT (membership_id) DO NOTHING;

  SELECT ep.shift_duration_hours, ep.break_duration_hours INTO v_current_shift, v_current_break
  FROM public.employee_profiles AS ep WHERE ep.membership_id = p_membership_id;

  v_next_shift := coalesce(p_shift_duration_hours, v_current_shift);
  v_next_break := coalesce(p_break_duration_hours, v_current_break);

  IF v_next_shift IS NULL OR v_next_shift <= 0 OR v_next_shift > 24 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SHIFT_DURATION'); END IF;
  IF v_next_break IS NULL OR v_next_break < 0 OR v_next_break >= v_next_shift THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_BREAK_DURATION'); END IF;

  UPDATE public.employee_profiles
  SET shift_duration_hours = v_next_shift, break_duration_hours = v_next_break,
      position = coalesce(p_position, position), department = coalesce(p_department, department),
      hire_date = coalesce(p_hire_date, hire_date), updated_at = now()
  WHERE membership_id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id,
    'shift_duration_hours', v_next_shift, 'break_duration_hours', v_next_break,
    'position', p_position, 'department', p_department, 'hire_date', p_hire_date);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_organization_settings(p_organization_id uuid, p_name text, p_default_timezone text)
 RETURNS public.organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_default_timezone text;
  v_name text;
  v_organization public.organizations%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = p_organization_id AND m.user_id = v_user_id
      AND m.status = 'active'::public.membership_status
      AND m.role::text IN ('owner', 'admin')
  ) THEN RAISE EXCEPTION 'No tenés permisos para modificar esta organización.'; END IF;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF v_name = '' THEN RAISE EXCEPTION 'Organization name is required'; END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Organization name length must be between 2 and 120 characters'; END IF;
  IF v_name ~ '[<>]' THEN RAISE EXCEPTION 'Organization name contains invalid characters'; END IF;

  v_default_timezone := trim(coalesce(p_default_timezone, ''));
  IF v_default_timezone = '' THEN v_default_timezone := 'America/Santiago'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_default_timezone) THEN
    RAISE EXCEPTION 'Default timezone is invalid'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.organizations AS o
    WHERE o.id <> p_organization_id AND lower(o.name) = lower(v_name)
      AND o.owner_user_id = (SELECT owner_user_id FROM public.organizations WHERE id = p_organization_id)
  ) THEN RAISE EXCEPTION 'Ya existe una organización con ese nombre.'; END IF;

  UPDATE public.organizations SET default_timezone = v_default_timezone, name = v_name
  WHERE id = p_organization_id RETURNING * INTO v_organization;
  IF v_organization.id IS NULL THEN RAISE EXCEPTION 'La organización no existe.'; END IF;
  RETURN v_organization;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_proximity(p_organization_id uuid, p_latitude double precision, p_longitude double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_office_id uuid;
  v_office_name text;
  v_user_point extensions.geography;
BEGIN
  IF p_accuracy > 50 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'GPS_ACCURACY_TOO_LOW'
    );
  END IF;

  v_user_point := extensions.ST_SetSRID(
    extensions.ST_MakePoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;

  SELECT id, name
  INTO v_office_id, v_office_name
  FROM organization_offices
  WHERE organization_id = p_organization_id
    AND is_remote = false
    AND extensions.ST_DWithin(location_point, v_user_point, 100)
  ORDER BY extensions.ST_Distance(location_point, v_user_point) ASC
  LIMIT 1;

  IF v_office_id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'OUT_OF_RANGE'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'office_id', v_office_id,
    'office_name', v_office_name
  );
END;
$function$
;


