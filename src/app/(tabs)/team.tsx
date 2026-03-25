import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type MembershipRole = 'owner' | 'admin' | 'manager' | 'employee';

type EmployeeProfileRow =
  | {
      position: string | null;
      department: string | null;
    }
  | {
      position: string | null;
      department: string | null;
    }[]
  | null;

type MembershipRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: MembershipRole;
  status: 'invited' | 'active' | 'suspended';
  employee_profiles: EmployeeProfileRow;
};

type UserProfileRow = {
  id: string;
  full_name: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  roleLabel: string;
  department: string;
  initials: string;
};

const DEFAULT_DEPARTMENT = 'General';

export default function TeamScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!activeOrganization) return;

    setIsLoadingMembers(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('memberships')
      .select(
        'id, organization_id, user_id, invited_email, role, status, employee_profiles(position, department)',
      )
      .eq('organization_id', activeOrganization.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setMembers([]);
      setIsLoadingMembers(false);
      return;
    }

    const memberships = (data ?? []) as MembershipRow[];
    const userIds = memberships
      .map((membership) => membership.user_id)
      .filter((userId): userId is string => Boolean(userId));

    const userNamesById = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: userProfiles, error: userProfilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (userProfilesError) {
        setErrorMessage(userProfilesError.message);
        setMembers([]);
        setIsLoadingMembers(false);
        return;
      }

      (userProfiles ?? []).forEach((profile) => {
        const userProfile = profile as UserProfileRow;
        if (userProfile.full_name?.trim()) {
          userNamesById.set(userProfile.id, userProfile.full_name.trim());
        }
      });
    }

    const normalizedMembers = memberships.map((membership) => {
      const employeeProfile = Array.isArray(membership.employee_profiles)
        ? (membership.employee_profiles[0] ?? null)
        : membership.employee_profiles;

      const profileName =
        membership.user_id != null
          ? userNamesById.get(membership.user_id)
          : undefined;
      const name = deriveName(
        profileName,
        membership.invited_email,
        membership.user_id,
        membership.id,
      );
      const roleLabel =
        employeeProfile?.position?.trim() || mapMembershipRole(membership.role);
      const department = normalizeDepartment(employeeProfile?.department);

      return {
        id: membership.id,
        name,
        roleLabel,
        department,
        initials: deriveInitials(name),
      } satisfies TeamMember;
    });

    setMembers(normalizedMembers);
    setIsLoadingMembers(false);
  }, [activeOrganization]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const departments = useMemo(() => {
    const uniqueDepartments = [
      ...new Set(members.map((member) => member.department)),
    ];
    return ['ALL', ...uniqueDepartments];
  }, [members]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return members.filter((member) => {
      const matchesDepartment =
        selectedDepartment === 'ALL' ||
        member.department === selectedDepartment;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        member.name.toLowerCase().includes(normalizedSearch) ||
        member.roleLabel.toLowerCase().includes(normalizedSearch) ||
        member.department.toLowerCase().includes(normalizedSearch);

      return matchesDepartment && matchesSearch;
    });
  }, [members, searchQuery, selectedDepartment]);

  const inviteMember = useCallback(async () => {
    if (!activeOrganization || isInviting) return;

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setInviteMessage('Ingresa un email válido.');
      return;
    }

    setIsInviting(true);
    setInviteMessage('');

    const invitationCode = createInvitationCode();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase.from('memberships').insert({
      organization_id: activeOrganization.id,
      invited_email: normalizedEmail,
      role: 'employee',
      status: 'invited',
      invitation_code: invitationCode,
      invitation_expires_at: expiresAt,
    });

    if (error) {
      setInviteMessage(error.message);
      setIsInviting(false);
      return;
    }

    setInviteEmail('');
    setInviteMessage(`Invitación enviada (${invitationCode}).`);
    setIsInviting(false);
  }, [activeOrganization, inviteEmail, isInviting]);

  if (isLoadingOrganizations) {
    return (
      <View
        style={[styles.loaderContainer, { backgroundColor: theme.background }]}
      >
        <Text style={[styles.loaderText, { color: theme.textSecondary }]}>
          Cargando organizaciones...
        </Text>
      </View>
    );
  }

  if (!activeOrganization || isOrganizationSetupOpen) {
    return <OrganizationSetupView />;
  }

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + 112,
        },
      ]}
    >
      <AppHeader />

      <View
        style={[
          styles.searchInputWrap,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}
      >
        <View
          style={[styles.searchCircle, { borderColor: theme.textSecondary }]}
        />
        <View
          style={[
            styles.searchHandle,
            { backgroundColor: theme.textSecondary },
          ]}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar miembros del equipo..."
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.departmentsRow}
      >
        {departments.map((department) => {
          const isSelected = department === selectedDepartment;

          return (
            <Pressable
              key={department}
              onPress={() => setSelectedDepartment(department)}
              style={[
                styles.departmentChip,
                {
                  backgroundColor: isSelected
                    ? theme.primary
                    : theme.backgroundElement,
                },
              ]}
            >
              <Text
                style={[
                  styles.departmentChipText,
                  { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                {department === 'ALL' ? 'TODOS' : department.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {errorMessage ? (
        <Text style={[styles.errorText, { color: theme.error }]}>
          {errorMessage}
        </Text>
      ) : null}

      {isLoadingMembers ? (
        <Text style={[styles.stateText, { color: theme.textSecondary }]}>
          Cargando miembros...
        </Text>
      ) : null}

      {!isLoadingMembers && filteredMembers.length === 0 ? (
        <Text style={[styles.stateText, { color: theme.textSecondary }]}>
          No hay miembros para ese filtro.
        </Text>
      ) : null}

      {filteredMembers.map((member) => (
        <View
          key={member.id}
          style={[
            styles.memberCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.memberTopRow}>
            <View
              style={[styles.avatar, { backgroundColor: theme.primaryMuted }]}
            >
              <Text style={[styles.avatarText, { color: theme.accent }]}>
                {member.initials}
              </Text>
            </View>
          </View>

          <Text style={[styles.memberName, { color: theme.text }]}>
            {member.name}
          </Text>
          <Text style={[styles.memberRole, { color: theme.textSecondary }]}>
            {member.roleLabel}
          </Text>
          <Text
            style={[styles.memberDepartment, { color: theme.textSecondary }]}
          >
            Departamento: {member.department}
          </Text>
        </View>
      ))}

      <View
        style={[
          styles.inviteCard,
          {
            borderColor: theme.primaryMuted,
            backgroundColor: theme.background,
          },
        ]}
      >
        <View style={[styles.invitePlus, { backgroundColor: theme.primary }]}>
          <Text style={styles.invitePlusText}>+</Text>
        </View>
        <Text style={[styles.inviteTitle, { color: theme.accent }]}>
          Añadir Miembro
        </Text>
        <Text style={[styles.inviteSubtitle, { color: theme.textSecondary }]}>
          Invita a un nuevo compañero
        </Text>
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="correo@empresa.com"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[
            styles.inviteInput,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={inviteMember}
          style={[
            styles.inviteButton,
            {
              backgroundColor: theme.primary,
              opacity: isInviting ? 0.7 : 1,
            },
          ]}
        >
          <Text style={styles.inviteButtonText}>
            {isInviting ? 'Enviando...' : 'Enviar invitación'}
          </Text>
        </Pressable>
        {inviteMessage ? (
          <Text style={[styles.inviteMessage, { color: theme.textSecondary }]}>
            {inviteMessage}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function deriveName(
  fullName: string | undefined,
  email: string | null,
  userId: string | null,
  fallbackId: string,
) {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  if (email) {
    const localPart = email.split('@')[0] ?? '';
    const fromEmail = localPart
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((token) => token[0].toUpperCase() + token.slice(1).toLowerCase())
      .join(' ');
    if (fromEmail) return fromEmail;
  }

  if (userId) {
    return `Member ${userId.slice(0, 6)}`;
  }

  return `Member ${fallbackId.slice(0, 6)}`;
}

function deriveInitials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return 'MM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function normalizeDepartment(rawDepartment: string | null | undefined) {
  if (!rawDepartment?.trim()) return DEFAULT_DEPARTMENT;
  return rawDepartment.trim();
}

function mapMembershipRole(role: MembershipRole) {
  if (role === 'owner') return 'Organization Owner';
  if (role === 'admin') return 'Administrator';
  if (role === 'manager') return 'Team Manager';
  return 'Employee';
}

function createInvitationCode() {
  return `INV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  title: {
    fontSize: 36,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  searchCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  searchHandle: {
    width: 7,
    height: 2,
    borderRadius: 2,
    marginTop: 2,
    transform: [{ rotate: '45deg' }],
  },
  searchInputWrap: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  departmentsRow: {
    gap: Spacing.two,
  },
  departmentChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  departmentChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberCard: {
    borderRadius: 24,
    padding: Spacing.three,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    gap: Spacing.one,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 31,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  memberRole: {
    fontSize: 18,
    fontWeight: '500',
  },
  memberDepartment: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.one,
  },
  inviteCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  invitePlus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  invitePlusText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
  },
  inviteTitle: {
    fontSize: 34,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  inviteSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  inviteInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  inviteButton: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  inviteMessage: {
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'flex-start',
  },
});
