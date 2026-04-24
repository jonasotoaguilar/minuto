DROP POLICY IF EXISTS memberships_select ON public.memberships;

CREATE POLICY memberships_select ON public.memberships
  FOR SELECT TO public
  USING (
    user_id = (SELECT auth.uid())
    OR (
      status = 'invited'::public.membership_status
      AND invited_email IS NOT NULL
      AND lower(invited_email) = lower(COALESCE((SELECT auth.jwt()) ->> 'email', ''))
    )
    OR public.is_active_member_of_organization(public.memberships.organization_id)
  );
