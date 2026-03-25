import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  calculateAttendanceDays,
  calculateWorkdayStreak,
  getAttendanceRecordsForRange,
  getOrganizationMonthRange,
} from '@/lib/attendance';
import { supabase } from '@/lib/supabase';

type UserProfileSnapshot = {
  fullName: string;
  email: string;
  roleLabel: string;
  initials: string;
};

const initialProfileSnapshot: UserProfileSnapshot = {
  fullName: 'Usuario Minuto',
  email: '',
  roleLabel: 'Sin rol',
  initials: 'UM',
};

export default function ProfileTabScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();

  const [profileSnapshot, setProfileSnapshot] = useState<UserProfileSnapshot>(
    initialProfileSnapshot,
  );
  const [attendanceDays, setAttendanceDays] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfileData = useCallback(async () => {
    if (!activeOrganization) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const monthRange = getOrganizationMonthRange(activeOrganization.timezone);
      const streakStartDate = shiftDateString(monthRange.end, -365);

      const [
        { data: authData, error: authError },
        monthRecords,
        streakRecords,
      ] = await Promise.all([
        supabase.auth.getUser(),
        getAttendanceRecordsForRange({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          startDate: monthRange.start,
          endDate: monthRange.end,
        }),
        getAttendanceRecordsForRange({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          startDate: streakStartDate,
          endDate: monthRange.end,
        }),
      ]);

      if (authError || !authData.user) {
        throw new Error('No se pudo cargar el usuario autenticado.');
      }

      const user = authData.user;
      const fullName =
        typeof user.user_metadata.display_name === 'string' &&
        user.user_metadata.display_name.trim().length > 0
          ? user.user_metadata.display_name.trim()
          : deriveNameFromEmail(user.email) || 'Usuario Minuto';

      setProfileSnapshot({
        fullName,
        email: user.email ?? '',
        roleLabel: mapMembershipRole(activeOrganization.membershipRole),
        initials: deriveInitials(fullName),
      });

      setAttendanceDays(calculateAttendanceDays(monthRecords));
      setStreakDays(
        calculateWorkdayStreak(streakRecords, activeOrganization.timezone),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo cargar el perfil.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const configItems = useMemo(
    () => [
      {
        id: 'security',
        title: 'Account Security',
        description: 'Contraseña y 2FA',
      },
      {
        id: 'notifications',
        title: 'Notifications',
        description: 'Push y correo electrónico',
      },
      {
        id: 'help',
        title: 'Centro de Ayuda',
        description: 'FAQs y soporte técnico',
      },
    ],
    [],
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

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
          styles.profileCard,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View
          style={[styles.heroAvatar, { backgroundColor: theme.primaryMuted }]}
        >
          <Text style={[styles.heroAvatarText, { color: theme.accent }]}>
            {profileSnapshot.initials}
          </Text>
        </View>

        <Text style={[styles.name, { color: theme.text }]}>
          {profileSnapshot.fullName}
        </Text>
        <Text style={[styles.role, { color: theme.textSecondary }]}>
          {profileSnapshot.roleLabel}
        </Text>

        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={[styles.editButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.editButtonText}>Editar Perfil</Text>
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Asistencia
          </Text>
          <Text style={[styles.metricValue, { color: theme.primary }]}>
            {attendanceDays}
          </Text>
          <Text style={[styles.metricHint, { color: theme.textSecondary }]}>
            Días este mes
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Racha
          </Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {streakDays}
          </Text>
          <Text style={[styles.metricHint, { color: theme.textSecondary }]}>
            Días hábiles seguidos
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.settingsCard,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <Text style={[styles.settingsTitle, { color: theme.text }]}>
          Configuración
        </Text>

        {configItems.map((item) => (
          <View key={item.id} style={styles.settingRow}>
            <View
              style={[
                styles.settingIcon,
                { backgroundColor: theme.primaryMuted },
              ]}
            >
              <View
                style={[
                  styles.settingIconDot,
                  { backgroundColor: theme.primary },
                ]}
              />
            </View>

            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                {item.title}
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {item.description}
              </Text>
            </View>

            <Text style={[styles.settingArrow, { color: theme.textSecondary }]}>
              ›
            </Text>
          </View>
        ))}
      </View>

      {errorMessage ? (
        <Text style={[styles.errorText, { color: theme.error }]}>
          {errorMessage}
        </Text>
      ) : null}

      <View style={styles.footerActions}>
        <Pressable
          onPress={loadProfileData}
          disabled={isLoading}
          style={[styles.secondaryAction, { borderColor: theme.border }]}
        >
          <Text style={[styles.secondaryActionText, { color: theme.text }]}>
            {isLoading ? 'Actualizando...' : 'Actualizar datos'}
          </Text>
        </Pressable>

        <Pressable onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Cerrar Sesión</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function deriveNameFromEmail(email: string | null | undefined) {
  if (!email) return '';
  const localPart = email.split('@')[0] ?? '';
  return localPart
    .split(/[._-]+/)
    .map((token) =>
      token.length > 0
        ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
        : '',
    )
    .join(' ')
    .trim();
}

function deriveInitials(fullName: string) {
  const segments = fullName.trim().split(/\s+/).filter(Boolean);

  if (segments.length === 0) {
    return 'UM';
  }

  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase();
  }

  return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase();
}

function mapMembershipRole(role: 'owner' | 'admin' | 'manager' | 'employee') {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrador';
    case 'manager':
      return 'Manager';
    default:
      return 'Empleado';
  }
}

function shiftDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);

  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 28,
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroAvatar: {
    width: 126,
    height: 126,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  heroAvatarText: {
    fontSize: 38,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  name: {
    fontSize: 44,
    lineHeight: 48,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    textAlign: 'center',
  },
  role: {
    fontSize: 28,
    fontFamily: Fonts.serif,
    lineHeight: 32,
    textAlign: 'center',
  },
  editButton: {
    borderRadius: 999,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    marginTop: Spacing.one,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  metricHint: {
    fontSize: 14,
    lineHeight: 18,
  },
  settingsCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: Spacing.three,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  settingsTitle: {
    fontSize: 38,
    lineHeight: 44,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  settingIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  settingTextWrap: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  settingArrow: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '700',
  },
  footerActions: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  secondaryAction: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  signOutText: {
    color: '#D14343',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
