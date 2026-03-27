CREATE OR REPLACE FUNCTION set_organization_geofencing(
  p_organization_id uuid,
  p_enabled boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT (role IN ('owner', 'admin')) INTO v_is_admin
  FROM memberships
  WHERE organization_id = p_organization_id
    AND user_id = auth.uid();

  IF v_is_admin IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not a member of this organization';
  END IF;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: only owners and admins can modify geofencing settings';
  END IF;

  UPDATE organizations
  SET geofencing_enabled = p_enabled
  WHERE id = p_organization_id;

  RETURN jsonb_build_object('success', true, 'organization_id', p_organization_id, 'geofencing_enabled', p_enabled);
END;
$$;
COMMENT ON FUNCTION set_organization_geofencing IS 'Enable or disable geofencing for an organization (admin/owner only)';
