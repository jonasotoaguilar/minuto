import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';

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

export interface UseOrganizationOfficesResult {
  errorMessage: string;
  isLoadingOffices: boolean;
  offices: OrganizationOffice[];
  reloadOffices: () => Promise<void>;
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

const organizationOfficeRowSchema = z.object({
  address_label: z.string().nullable(),
  id: z.string().min(1),
  is_remote: z.boolean(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  name: z.string().min(1),
  organization_id: z.string().min(1),
});

const organizationOfficesSchema = z.array(organizationOfficeRowSchema);

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

function resetOfficeState(params: {
  requestId: number;
  requestIdRef: MutableRefObject<number>;
  setErrorMessage: (value: string) => void;
  setIsLoadingOffices: (value: boolean) => void;
  setOffices: (value: OrganizationOffice[]) => void;
}) {
  if (params.requestId !== params.requestIdRef.current) {
    return;
  }

  params.setOffices([]);
  params.setErrorMessage('');
  params.setIsLoadingOffices(false);
}

function commitOfficeFailure(params: {
  errorMessage: string;
  requestId: number;
  requestIdRef: MutableRefObject<number>;
  setErrorMessage: (value: string) => void;
  setIsLoadingOffices: (value: boolean) => void;
  setOffices: (value: OrganizationOffice[]) => void;
}) {
  if (params.requestId !== params.requestIdRef.current) {
    return;
  }

  params.setOffices([]);
  params.setErrorMessage(params.errorMessage);
  params.setIsLoadingOffices(false);
}

function commitOfficeSuccess(params: {
  offices: OrganizationOffice[];
  requestId: number;
  requestIdRef: MutableRefObject<number>;
  setIsLoadingOffices: (value: boolean) => void;
  setOffices: (value: OrganizationOffice[]) => void;
}) {
  if (params.requestId !== params.requestIdRef.current) {
    return;
  }

  params.setOffices(params.offices);
  params.setIsLoadingOffices(false);
}

export function useOrganizationOffices(
  organizationId: string | null,
): UseOrganizationOfficesResult {
  const [offices, setOffices] = useState<OrganizationOffice[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingOffices, setIsLoadingOffices] = useState(false);
  const requestIdRef = useRef(0);

  const loadOffices = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!organizationId) {
      resetOfficeState({
        requestId,
        requestIdRef,
        setErrorMessage,
        setIsLoadingOffices,
        setOffices,
      });
      return;
    }

    setIsLoadingOffices(true);
    setErrorMessage('');

    const { data, error } = await supabase.rpc('get_organization_offices', {
      p_organization_id: organizationId,
    });

    if (error) {
      commitOfficeFailure({
        errorMessage: error.message,
        requestId,
        requestIdRef,
        setErrorMessage,
        setIsLoadingOffices,
        setOffices,
      });
      return;
    }

    const parsedOffices = organizationOfficesSchema.safeParse(data ?? []);

    if (!parsedOffices.success) {
      commitOfficeFailure({
        errorMessage: 'La respuesta de oficinas llegó con un formato inválido.',
        requestId,
        requestIdRef,
        setErrorMessage,
        setIsLoadingOffices,
        setOffices,
      });
      return;
    }

    commitOfficeSuccess({
      offices: parsedOffices.data.map(toOrganizationOffice),
      requestId,
      requestIdRef,
      setIsLoadingOffices,
      setOffices,
    });
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
