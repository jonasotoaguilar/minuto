import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export interface OrganizationOffice {
  addressLabel: string | null;
  id: string;
  isRemote: boolean;
  latitude: number | null;
  longitude: number | null;
  name: string;
  organizationId: string;
}

interface OrganizationOfficeRow {
  address_label: string | null;
  id: string;
  is_remote: boolean;
  latitude: number | null;
  longitude: number | null;
  name: string;
  organization_id: string;
}

function toOrganizationOffice(row: OrganizationOfficeRow) {
  return {
    addressLabel: row.address_label,
    id: row.id,
    isRemote: row.is_remote,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    organizationId: row.organization_id,
  } satisfies OrganizationOffice;
}

export function useOrganizationOffices(organizationId: string | null) {
  const [offices, setOffices] = useState<OrganizationOffice[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingOffices, setIsLoadingOffices] = useState(false);

  const loadOffices = useCallback(async () => {
    if (!organizationId) {
      setOffices([]);
      setErrorMessage('');
      setIsLoadingOffices(false);
      return;
    }

    setIsLoadingOffices(true);
    setErrorMessage('');

    const { data, error } = await supabase.rpc('get_organization_offices', {
      p_organization_id: organizationId,
    });

    if (error) {
      setOffices([]);
      setErrorMessage(error.message);
      setIsLoadingOffices(false);
      return;
    }

    setOffices(
      ((data ?? []) as OrganizationOfficeRow[]).map(toOrganizationOffice),
    );
    setIsLoadingOffices(false);
  }, [organizationId]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  return {
    errorMessage,
    isLoadingOffices,
    offices,
    reloadOffices: loadOffices,
  };
}
