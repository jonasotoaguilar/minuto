CREATE OR REPLACE FUNCTION public.get_organization_team_members(
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  user_id uuid,
  invited_email text,
  role public.membership_role,
  status public.membership_status,
  member_position text,
  department text,
  hire_date date,
  shift_duration_hours numeric,
  break_duration_hours numeric,
  weekly_hours numeric,
  full_name text,
  phone text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an active member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.organization_id,
    m.user_id,
    m.invited_email,
    m.role,
    m.status,
    ep.position AS member_position,
    ep.department,
    ep.hire_date,
    ep.shift_duration_hours,
    ep.break_duration_hours,
    ep.weekly_hours,
    up.full_name,
    up.phone,
    au.email::text
  FROM public.memberships AS m
  LEFT JOIN public.employee_profiles AS ep ON ep.membership_id = m.id
  LEFT JOIN public.user_profiles AS up ON up.id = m.user_id
  LEFT JOIN auth.users AS au ON au.id = m.user_id
  WHERE m.organization_id = p_organization_id
    AND m.status = 'active'::public.membership_status
  ORDER BY m.created_at ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_organization_team_members(uuid) TO authenticated;
