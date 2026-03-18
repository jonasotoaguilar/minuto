import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { z } from 'zod';
import {
  type CreateOrganizationInput,
  createOrganizationInputSchema,
  getFirstValidationError,
} from '@/lib/organization-validation';
import { supabase } from '@/lib/supabase';

type MembershipRole = 'owner' | 'admin' | 'manager' | 'employee';

export type OrganizationSummary = {
  id: string;
  name: string;
  location: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  timezone: string;
  ownerUserId: string;
  membershipId: string;
  membershipRole: MembershipRole;
};

type OrganizationContextValue = {
  organizations: OrganizationSummary[];
  activeOrganization: OrganizationSummary | null;
  isLoadingOrganizations: boolean;
  isOrganizationSetupOpen: boolean;
  setupErrorMessage: string;
  setSetupErrorMessage: (value: string) => void;
  setActiveOrganizationById: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  openOrganizationSetup: () => void;
  closeOrganizationSetup: () => void;
  createOrganization: (input: CreateOrganizationInput) => Promise<void>;
  joinOrganizationByCodeOrLink: (codeOrLink: string) => Promise<void>;
};

const ACTIVE_ORGANIZATION_STORAGE_KEY = 'active_organization_id';

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null,
);

const getWebStorage = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
};

async function readStoredActiveOrganizationId() {
  const webStorage = getWebStorage();
  if (webStorage) {
    return webStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
  }
  return AsyncStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
}

async function writeStoredActiveOrganizationId(organizationId: string) {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, organizationId);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, organizationId);
}

function normalizeInvitationCode(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  let candidate = trimmed;

  try {
    const url = trimmed.includes('://')
      ? new URL(trimmed)
      : new URL(trimmed, 'https://dummy.minuto.app');

    const fromQuery =
      url.searchParams.get('code') || url.searchParams.get('invitation_code');
    if (fromQuery) {
      candidate = fromQuery;
    } else {
      const pathSegments = url.pathname.split('/').filter(Boolean);
      candidate = pathSegments[pathSegments.length - 1] ?? trimmed;
    }
  } catch {
    candidate = trimmed;
  }

  return candidate.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
}

function toOrganizationSummary(row: {
  id: string;
  role: MembershipRole;
  organizations:
    | {
        id: string;
        name: string;
        location: string | null;
        plan: 'free' | 'pro' | 'enterprise';
        timezone: string;
        owner_user_id: string;
      }
    | {
        id: string;
        name: string;
        location: string | null;
        plan: 'free' | 'pro' | 'enterprise';
        timezone: string;
        owner_user_id: string;
      }[]
    | null;
}) {
  const relatedOrganization = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;

  if (!relatedOrganization) return null;

  return {
    id: relatedOrganization.id,
    name: relatedOrganization.name,
    location: relatedOrganization.location,
    plan: relatedOrganization.plan,
    timezone: relatedOrganization.timezone,
    ownerUserId: relatedOrganization.owner_user_id,
    membershipId: row.id,
    membershipRole: row.role,
  } satisfies OrganizationSummary;
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<
    string | null
  >(null);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);
  const [isOrganizationSetupOpen, setIsOrganizationSetupOpen] = useState(false);
  const [setupErrorMessage, setSetupErrorMessage] = useState('');
  const isCreatingOrganizationRef = useRef(false);

  const requireCurrentUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error('No hay sesión activa.');
    }
    return data.user;
  }, []);

  const refreshOrganizations = useCallback(async () => {
    if (!sessionUserId) {
      setOrganizations([]);
      setActiveOrganizationId(null);
      setIsOrganizationSetupOpen(true);
      setIsLoadingOrganizations(false);
      return;
    }

    setIsLoadingOrganizations(true);
    setSetupErrorMessage('');

    const { data, error } = await supabase
      .from('memberships')
      .select(
        'id, role, organizations(id, name, location, plan, timezone, owner_user_id)',
      )
      .eq('user_id', sessionUserId)
      .eq('status', 'active');

    if (error) {
      setSetupErrorMessage(error.message);
      setOrganizations([]);
      setActiveOrganizationId(null);
      setIsOrganizationSetupOpen(true);
      setIsLoadingOrganizations(false);
      return;
    }

    const normalizedOrganizations = (data ?? [])
      .map((row) => toOrganizationSummary(row as never))
      .filter((row): row is OrganizationSummary => row !== null);

    setOrganizations(normalizedOrganizations);

    if (normalizedOrganizations.length === 0) {
      setActiveOrganizationId(null);
      setIsOrganizationSetupOpen(true);
      setIsLoadingOrganizations(false);
      return;
    }

    const storedOrganizationId = await readStoredActiveOrganizationId();
    const hasStoredOrganization = normalizedOrganizations.some(
      (organization) => organization.id === storedOrganizationId,
    );

    const nextActiveOrganizationId =
      hasStoredOrganization && storedOrganizationId
        ? storedOrganizationId
        : normalizedOrganizations[0].id;

    setActiveOrganizationId(nextActiveOrganizationId);
    setIsOrganizationSetupOpen(false);
    await writeStoredActiveOrganizationId(nextActiveOrganizationId);
    setIsLoadingOrganizations(false);
  }, [sessionUserId]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const currentSession = data.session;
      setSessionUserId(currentSession?.user.id ?? null);
    };

    bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSessionUserId(session?.user.id ?? null);
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const setActiveOrganizationById = useCallback(
    async (organizationId: string) => {
      setActiveOrganizationId(organizationId);
      await writeStoredActiveOrganizationId(organizationId);
      setIsOrganizationSetupOpen(false);
    },
    [],
  );

  const openOrganizationSetup = useCallback(() => {
    setSetupErrorMessage('');
    setIsOrganizationSetupOpen(true);
  }, []);

  const closeOrganizationSetup = useCallback(() => {
    setSetupErrorMessage('');
    setIsOrganizationSetupOpen(false);
  }, []);

  const createOrganization = useCallback(
    async (input: CreateOrganizationInput) => {
      if (isCreatingOrganizationRef.current) {
        throw new Error('Ya hay una creación en curso.');
      }

      const parsedInput = createOrganizationInputSchema.safeParse(input);
      if (!parsedInput.success) {
        const fieldErrors = z.flattenError(parsedInput.error).fieldErrors;
        throw new Error(
          getFirstValidationError(fieldErrors) || 'Datos inválidos.',
        );
      }

      const currentUser = await requireCurrentUser();
      const normalizedName = parsedInput.data.name.toLowerCase();
      const duplicateOrganization = organizations.some(
        (organization) =>
          organization.ownerUserId === currentUser.id &&
          organization.name.toLowerCase() === normalizedName,
      );

      if (duplicateOrganization) {
        throw new Error('Ya existe una organización con ese nombre.');
      }

      isCreatingOrganizationRef.current = true;
      try {
        const { data: newOrganizationId, error: createOrganizationError } =
          await supabase.rpc('create_organization_with_owner', {
            p_name: parsedInput.data.name,
            p_timezone: parsedInput.data.timezone,
            p_location: parsedInput.data.location,
          });

        if (createOrganizationError || !newOrganizationId) {
          throw new Error(
            createOrganizationError?.message ||
              'No se pudo crear la organización.',
          );
        }

        await refreshOrganizations();
        await setActiveOrganizationById(newOrganizationId);
        setIsOrganizationSetupOpen(false);
      } finally {
        isCreatingOrganizationRef.current = false;
      }
    },
    [
      organizations,
      refreshOrganizations,
      requireCurrentUser,
      setActiveOrganizationById,
    ],
  );

  const joinOrganizationByCodeOrLink = useCallback(
    async (codeOrLink: string) => {
      const invitationCode = normalizeInvitationCode(codeOrLink);
      if (!invitationCode) {
        throw new Error('Código/link de invitación inválido.');
      }
      const currentUser = await requireCurrentUser();
      const currentUserEmail = currentUser.email;
      if (!currentUserEmail) {
        throw new Error('No hay sesión activa.');
      }

      const { data: invitation, error: findInvitationError } = await supabase
        .from('memberships')
        .select(
          'id, organization_id, invited_email, invitation_expires_at, status',
        )
        .ilike('invitation_code', invitationCode)
        .eq('status', 'invited')
        .maybeSingle();

      if (findInvitationError) {
        throw new Error(findInvitationError.message);
      }

      if (!invitation) {
        throw new Error('Invitación no encontrada o vencida.');
      }

      const normalizedSessionEmail = currentUserEmail.toLowerCase();
      const normalizedInvitedEmail = invitation.invited_email?.toLowerCase();
      if (
        !normalizedInvitedEmail ||
        normalizedInvitedEmail !== normalizedSessionEmail
      ) {
        throw new Error('Esta invitación no corresponde a tu email.');
      }

      if (
        invitation.invitation_expires_at &&
        new Date(invitation.invitation_expires_at) < new Date()
      ) {
        throw new Error('La invitación está vencida.');
      }

      const { error: claimInvitationError } = await supabase
        .from('memberships')
        .update({
          user_id: currentUser.id,
          status: 'active',
          invitation_code: null,
          invitation_expires_at: null,
        })
        .eq('id', invitation.id);

      if (claimInvitationError) {
        throw new Error(claimInvitationError.message);
      }

      await refreshOrganizations();
      await setActiveOrganizationById(invitation.organization_id);
      setIsOrganizationSetupOpen(false);
    },
    [refreshOrganizations, requireCurrentUser, setActiveOrganizationById],
  );

  const activeOrganization = useMemo(
    () =>
      organizations.find(
        (organization) => organization.id === activeOrganizationId,
      ) ?? null,
    [activeOrganizationId, organizations],
  );

  const contextValue = useMemo(
    () => ({
      organizations,
      activeOrganization,
      isLoadingOrganizations,
      isOrganizationSetupOpen,
      setupErrorMessage,
      setSetupErrorMessage,
      setActiveOrganizationById,
      refreshOrganizations,
      openOrganizationSetup,
      closeOrganizationSetup,
      createOrganization,
      joinOrganizationByCodeOrLink,
    }),
    [
      organizations,
      activeOrganization,
      isLoadingOrganizations,
      isOrganizationSetupOpen,
      setupErrorMessage,
      setActiveOrganizationById,
      refreshOrganizations,
      openOrganizationSetup,
      closeOrganizationSetup,
      createOrganization,
      joinOrganizationByCodeOrLink,
    ],
  );

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used inside OrganizationProvider');
  }
  return context;
}
