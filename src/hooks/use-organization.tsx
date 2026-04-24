import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { z } from 'zod';
import { acceptMembershipInvitation } from '@/lib/organization-invitations';
import {
  type CreateOrganizationInput,
  createOrganizationInputSchema,
  getFirstValidationError,
} from '@/lib/organization-validation';
import { supabase } from '@/lib/supabase';

interface OrganizationMembershipRow {
  id: string;
  role: MembershipRole;
  organizations: OrganizationSummaryRow | OrganizationSummaryRow[] | null;
}

interface OrganizationSummaryRow {
  default_timezone: string;
  id: string;
  name: string;
  owner_user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
}

type MembershipRole = 'owner' | 'admin' | 'manager' | 'employee';

const membershipRoleSchema = z.enum(['owner', 'admin', 'manager', 'employee']);

const organizationSummaryRowSchema = z.object({
  default_timezone: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  owner_user_id: z.string().min(1),
  plan: z.enum(['free', 'pro', 'enterprise']),
});

const organizationMembershipRowSchema = z.object({
  id: z.string().min(1),
  role: membershipRoleSchema,
  organizations: z
    .union([
      organizationSummaryRowSchema,
      z.array(organizationSummaryRowSchema),
      z.null(),
    ])
    .nullable(),
});

const organizationMembershipRowsSchema = z.array(
  organizationMembershipRowSchema,
);

export type OrganizationSummary = {
  defaultTimezone: string;
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
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
  joinOrganizationByCode: (code: string) => Promise<void>;
};

interface OrganizationState {
  activeOrganizationId: string | null;
  isLoadingOrganizations: boolean;
  isOrganizationSetupOpen: boolean;
  organizations: OrganizationSummary[];
  sessionUserId: string | null;
  setupErrorMessage: string;
}

interface OrganizationStateSetters {
  setActiveOrganizationId: Dispatch<SetStateAction<string | null>>;
  setIsLoadingOrganizations: Dispatch<SetStateAction<boolean>>;
  setIsOrganizationSetupOpen: Dispatch<SetStateAction<boolean>>;
  setOrganizations: Dispatch<SetStateAction<OrganizationSummary[]>>;
  setSessionUserId: Dispatch<SetStateAction<string | null>>;
  setSetupErrorMessage: Dispatch<SetStateAction<string>>;
}

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

function getDeprecatedOrganizationLocation(
  input: CreateOrganizationInput,
): string | null {
  const trimmedLocation = input.location?.trim();
  return trimmedLocation ? trimmedLocation : null;
}

function toOrganizationSummary(row: OrganizationMembershipRow) {
  const relatedOrganization = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;

  if (!relatedOrganization) return null;

  return {
    defaultTimezone: relatedOrganization.default_timezone,
    id: relatedOrganization.id,
    name: relatedOrganization.name,
    plan: relatedOrganization.plan,
    ownerUserId: relatedOrganization.owner_user_id,
    membershipId: row.id,
    membershipRole: row.role,
  } satisfies OrganizationSummary;
}

function resetOrganizationState(params: {
  setActiveOrganizationId: (value: string | null) => void;
  setIsLoadingOrganizations: (value: boolean) => void;
  setIsOrganizationSetupOpen: (value: boolean) => void;
  setOrganizations: (value: OrganizationSummary[]) => void;
}) {
  params.setOrganizations([]);
  params.setActiveOrganizationId(null);
  params.setIsOrganizationSetupOpen(true);
  params.setIsLoadingOrganizations(false);
}

async function fetchOrganizationSummaries(userId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select(
      'id, role, organizations(id, name, plan, owner_user_id, default_timezone)',
    )
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    throw new Error(error.message);
  }

  const parsedMemberships = organizationMembershipRowsSchema.safeParse(
    data ?? [],
  );

  if (!parsedMemberships.success) {
    throw new Error(
      'La respuesta de tus organizaciones llegó con un formato inválido.',
    );
  }

  return parsedMemberships.data
    .map((row) => toOrganizationSummary(row))
    .filter((row): row is OrganizationSummary => row !== null);
}

async function resolveNextActiveOrganizationId(
  organizations: OrganizationSummary[],
) {
  const storedOrganizationId = await readStoredActiveOrganizationId();
  const hasStoredOrganization = organizations.some(
    (organization) => organization.id === storedOrganizationId,
  );

  return hasStoredOrganization && storedOrganizationId
    ? storedOrganizationId
    : organizations[0].id;
}

function parseCreateOrganizationInput(input: CreateOrganizationInput) {
  const parsedInput = createOrganizationInputSchema.safeParse(input);

  if (!parsedInput.success) {
    const fieldErrors = z.flattenError(parsedInput.error).fieldErrors;
    throw new Error(getFirstValidationError(fieldErrors) || 'Datos inválidos.');
  }

  return parsedInput.data;
}

function ensureOrganizationNameIsUnique(params: {
  organizations: OrganizationSummary[];
  ownerUserId: string;
  organizationName: string;
}) {
  const normalizedName = params.organizationName.toLowerCase();
  const duplicateOrganization = params.organizations.some(
    (organization) =>
      organization.ownerUserId === params.ownerUserId &&
      organization.name.toLowerCase() === normalizedName,
  );

  if (duplicateOrganization) {
    throw new Error('Ya existe una organización con ese nombre.');
  }
}

async function createOrganizationRecord(input: CreateOrganizationInput) {
  const compatibilityLocation = getDeprecatedOrganizationLocation(input);
  const office = input.office ?? null;

  const { data: newOrganizationId, error } = await supabase.rpc(
    'create_organization_with_owner',
    {
      p_name: input.name,
      p_default_timezone: input.defaultTimezone,
      p_location: compatibilityLocation,
      p_office_name: office?.name ?? null,
      p_office_address_label: office?.addressLabel ?? null,
      p_office_latitude: office?.latitude ?? null,
      p_office_longitude: office?.longitude ?? null,
    },
  );

  if (error || !newOrganizationId) {
    throw new Error(error?.message || 'No se pudo crear la organización.');
  }

  return newOrganizationId;
}

function useOrganizationState(): [OrganizationState, OrganizationStateSetters] {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<
    string | null
  >(null);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);
  const [isOrganizationSetupOpen, setIsOrganizationSetupOpen] = useState(false);
  const [setupErrorMessage, setSetupErrorMessage] = useState('');

  return [
    {
      activeOrganizationId,
      isLoadingOrganizations,
      isOrganizationSetupOpen,
      organizations,
      sessionUserId,
      setupErrorMessage,
    },
    {
      setActiveOrganizationId,
      setIsLoadingOrganizations,
      setIsOrganizationSetupOpen,
      setOrganizations,
      setSessionUserId,
      setSetupErrorMessage,
    },
  ];
}

function useSessionBootstrap(params: {
  setSessionUserId: Dispatch<SetStateAction<string | null>>;
  setSetupErrorMessage: Dispatch<SetStateAction<string>>;
}): void {
  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        params.setSetupErrorMessage(error.message);
        params.setSessionUserId(null);
        return;
      }

      params.setSessionUserId(data.session?.user.id ?? null);
    };

    void bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        params.setSessionUserId(session?.user.id ?? null);
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [params.setSessionUserId, params.setSetupErrorMessage]);
}

function useOrganizationRefresh(params: {
  sessionUserId: string | null;
  setters: Pick<
    OrganizationStateSetters,
    | 'setActiveOrganizationId'
    | 'setIsLoadingOrganizations'
    | 'setIsOrganizationSetupOpen'
    | 'setOrganizations'
    | 'setSetupErrorMessage'
  >;
}): () => Promise<void> {
  const requestIdRef = useRef(0);

  return useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!params.sessionUserId) {
      resetOrganizationState({
        setActiveOrganizationId: params.setters.setActiveOrganizationId,
        setIsLoadingOrganizations: params.setters.setIsLoadingOrganizations,
        setIsOrganizationSetupOpen: params.setters.setIsOrganizationSetupOpen,
        setOrganizations: params.setters.setOrganizations,
      });
      return;
    }

    params.setters.setIsLoadingOrganizations(true);
    params.setters.setSetupErrorMessage('');

    try {
      const normalizedOrganizations = await fetchOrganizationSummaries(
        params.sessionUserId,
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      params.setters.setOrganizations(normalizedOrganizations);

      if (normalizedOrganizations.length === 0) {
        params.setters.setActiveOrganizationId(null);
        params.setters.setIsOrganizationSetupOpen(true);
        params.setters.setIsLoadingOrganizations(false);
        return;
      }

      const nextActiveOrganizationId = await resolveNextActiveOrganizationId(
        normalizedOrganizations,
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      params.setters.setActiveOrganizationId(nextActiveOrganizationId);
      params.setters.setIsOrganizationSetupOpen(false);
      await writeStoredActiveOrganizationId(nextActiveOrganizationId);
      if (requestId !== requestIdRef.current) {
        return;
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      params.setters.setSetupErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar tus organizaciones.',
      );
      resetOrganizationState({
        setActiveOrganizationId: params.setters.setActiveOrganizationId,
        setIsLoadingOrganizations: params.setters.setIsLoadingOrganizations,
        setIsOrganizationSetupOpen: params.setters.setIsOrganizationSetupOpen,
        setOrganizations: params.setters.setOrganizations,
      });
      return;
    }

    if (requestId === requestIdRef.current) {
      params.setters.setIsLoadingOrganizations(false);
    }
  }, [
    params.sessionUserId,
    params.setters.setActiveOrganizationId,
    params.setters.setIsLoadingOrganizations,
    params.setters.setIsOrganizationSetupOpen,
    params.setters.setOrganizations,
    params.setters.setSetupErrorMessage,
  ]);
}

function useOrganizationActions(params: {
  organizations: OrganizationSummary[];
  refreshOrganizations: () => Promise<void>;
  requireCurrentUser: () => Promise<{ id: string; email?: string | null }>;
  setActiveOrganizationId: (organizationId: string) => Promise<void>;
  setIsOrganizationSetupOpen: Dispatch<SetStateAction<boolean>>;
  setSetupErrorMessage: Dispatch<SetStateAction<string>>;
}) {
  const isCreatingOrganizationRef = useRef(false);

  const setActiveOrganizationById = useCallback(
    async (organizationId: string) => {
      await params.setActiveOrganizationId(organizationId);
      params.setIsOrganizationSetupOpen(false);
    },
    [params.setActiveOrganizationId, params.setIsOrganizationSetupOpen],
  );

  const openOrganizationSetup = useCallback(() => {
    params.setSetupErrorMessage('');
    params.setIsOrganizationSetupOpen(true);
  }, [params.setIsOrganizationSetupOpen, params.setSetupErrorMessage]);

  const closeOrganizationSetup = useCallback(() => {
    params.setSetupErrorMessage('');
    params.setIsOrganizationSetupOpen(false);
  }, [params.setIsOrganizationSetupOpen, params.setSetupErrorMessage]);

  const createOrganization = useCallback(
    async (input: CreateOrganizationInput) => {
      if (isCreatingOrganizationRef.current) {
        throw new Error('Ya hay una creación en curso.');
      }

      const parsedInput = parseCreateOrganizationInput(input);
      const currentUser = await params.requireCurrentUser();
      ensureOrganizationNameIsUnique({
        organizations: params.organizations,
        ownerUserId: currentUser.id,
        organizationName: parsedInput.name,
      });

      isCreatingOrganizationRef.current = true;
      try {
        const newOrganizationId = await createOrganizationRecord(parsedInput);
        await params.refreshOrganizations();
        await setActiveOrganizationById(newOrganizationId);
      } finally {
        isCreatingOrganizationRef.current = false;
      }
    },
    [
      params.organizations,
      params.refreshOrganizations,
      params.requireCurrentUser,
      setActiveOrganizationById,
    ],
  );

  const joinOrganizationByCode = useCallback(
    async (code: string) => {
      await params.requireCurrentUser();

      const acceptedInvitation = await acceptMembershipInvitation(code);

      await params.refreshOrganizations();
      await setActiveOrganizationById(acceptedInvitation.organizationId);
    },
    [
      params.refreshOrganizations,
      params.requireCurrentUser,
      setActiveOrganizationById,
    ],
  );

  return {
    closeOrganizationSetup,
    createOrganization,
    joinOrganizationByCode,
    openOrganizationSetup,
    setActiveOrganizationById,
  };
}

function useOrganizationController(): OrganizationContextValue {
  const [state, setters] = useOrganizationState();
  const {
    setActiveOrganizationId: setActiveOrganizationIdState,
    setIsOrganizationSetupOpen,
    setSessionUserId,
    setSetupErrorMessage,
  } = setters;

  const requireCurrentUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error('No hay sesión activa.');
    }
    return data.user;
  }, []);

  useSessionBootstrap({
    setSessionUserId,
    setSetupErrorMessage,
  });

  const refreshOrganizations = useOrganizationRefresh({
    sessionUserId: state.sessionUserId,
    setters,
  });

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  const setActiveOrganizationId = useCallback(
    async (organizationId: string) => {
      setActiveOrganizationIdState(organizationId);
      await writeStoredActiveOrganizationId(organizationId);
    },
    [setActiveOrganizationIdState],
  );

  const actions = useOrganizationActions({
    organizations: state.organizations,
    refreshOrganizations,
    requireCurrentUser,
    setActiveOrganizationId,
    setIsOrganizationSetupOpen,
    setSetupErrorMessage,
  });

  const activeOrganization = useMemo(
    () =>
      state.organizations.find(
        (organization) => organization.id === state.activeOrganizationId,
      ) ?? null,
    [state.activeOrganizationId, state.organizations],
  );

  return useMemo(
    () => ({
      organizations: state.organizations,
      activeOrganization,
      isLoadingOrganizations: state.isLoadingOrganizations,
      isOrganizationSetupOpen: state.isOrganizationSetupOpen,
      setupErrorMessage: state.setupErrorMessage,
      setSetupErrorMessage,
      setActiveOrganizationById: actions.setActiveOrganizationById,
      refreshOrganizations,
      openOrganizationSetup: actions.openOrganizationSetup,
      closeOrganizationSetup: actions.closeOrganizationSetup,
      createOrganization: actions.createOrganization,
      joinOrganizationByCode: actions.joinOrganizationByCode,
    }),
    [
      activeOrganization,
      actions,
      refreshOrganizations,
      setSetupErrorMessage,
      state,
    ],
  );
}

export function OrganizationProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const contextValue = useOrganizationController();

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used inside OrganizationProvider');
  }
  return context;
}
