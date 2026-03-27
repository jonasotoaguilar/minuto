ALTER TABLE organization_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view organization sites" ON organization_sites FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = organization_sites.organization_id
      AND m.user_id = auth.uid()
  )
);
CREATE POLICY "Admins can create organization sites" ON organization_sites FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = organization_sites.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Admins can update organization sites" ON organization_sites FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = organization_sites.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = organization_sites.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Admins can delete organization sites" ON organization_sites FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = organization_sites.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);
