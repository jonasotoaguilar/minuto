import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  calculateAttendanceDays,
  calculateWorkdayStreak,
  getAttendanceRecordsForRange,
  getOrganizationMonthRange,
} from '@/lib/attendance';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
  GlassCard,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

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
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfileData = useCallback(async () => {
    if (!activeOrganization) {
      return;
    }

    setErrorMessage('');
    setAttendanceDays(0);
    setStreakDays(0);

    try {
      const currentTimezone = resolveOrganizationTimezone(
        activeOrganization.defaultTimezone,
      );
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

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

      const monthRange = getOrganizationMonthRange(currentTimezone);
      const streakStartDate = shiftDateString(monthRange.end, -365);
      const [monthRecordsResult, streakRecordsResult] =
        await Promise.allSettled([
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

      if (
        monthRecordsResult.status === 'fulfilled' &&
        streakRecordsResult.status === 'fulfilled'
      ) {
        setAttendanceDays(calculateAttendanceDays(monthRecordsResult.value));
        setStreakDays(
          calculateWorkdayStreak(streakRecordsResult.value, currentTimezone),
        );
        return;
      }

      const attendanceError =
        monthRecordsResult.status === 'rejected'
          ? monthRecordsResult.reason
          : streakRecordsResult.status === 'rejected'
            ? streakRecordsResult.reason
            : null;

      setErrorMessage(
        attendanceError instanceof Error
          ? `Perfil cargado, pero no se pudieron obtener las métricas de asistencia (${attendanceError.message}).`
          : 'Perfil cargado, pero no se pudieron obtener las métricas de asistencia.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo cargar el perfil.',
      );
    }
  }, [activeOrganization]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  const configItems = useMemo(
    () => [
      {
        id: 'identity',
        title: 'Identidad',
        description: 'Nombre público y datos visibles en tu equipo',
      },
      {
        id: 'notifications',
        title: 'Avisos',
        description: 'Recordatorios, push y novedades por correo',
      },
      {
        id: 'help',
        title: 'Soporte',
        description: 'Guías rápidas y ayuda técnica cuando la necesites',
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
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ThemedText colorToken="secondary" variant="label">
          Cargando organizaciones...
        </ThemedText>
      </Screen>
    );
  }

  if (!activeOrganization || isOrganizationSetupOpen) {
    return <OrganizationSetupView />;
  }

  return (
    <Screen
      scroll
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: theme.spacing.lg,
          paddingBottom: BottomTabInset + theme.spacing['2xl'],
        },
      ]}
      scrollProps={{ contentInsetAdjustmentBehavior: 'automatic' }}
    >
      <AppHeader />

      <GlassCard style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <ThemedText colorToken="accent" variant="eyebrow">
            Perfil
          </ThemedText>

          <View
            style={[
              styles.roleChip,
              {
                backgroundColor: theme.surface.glass.soft,
                borderColor: theme.surface.glass.border,
              },
            ]}
          >
            <ThemedText colorToken="secondary" variant="label">
              {profileSnapshot.roleLabel}
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.heroAvatar,
            {
              backgroundColor: theme.surface.glass.tint,
              borderColor: theme.surface.glass.border,
            },
          ]}
        >
          <ThemedText
            colorToken="accent"
            style={styles.heroAvatarText}
            variant="heading"
          >
            {profileSnapshot.initials}
          </ThemedText>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText style={styles.name} variant="heading">
            {profileSnapshot.fullName}
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            style={styles.email}
            variant="body"
          >
            {profileSnapshot.email || 'Sin correo registrado'}
          </ThemedText>
        </View>

        <PrimaryButton
          accessibilityLabel="Modificar perfil"
          fullWidth={false}
          label="Modificar perfil"
          onPress={() => router.push('/edit-profile')}
          style={styles.editButton}
        />
      </GlassCard>

      <View style={styles.metricsRow}>
        <GlassCard style={styles.metricCard} variant="soft">
          <ThemedText colorToken="secondary" variant="label">
            Asistencia
          </ThemedText>
          <ThemedText
            colorToken="brand"
            style={styles.metricValue}
            variant="heading"
          >
            {attendanceDays}
          </ThemedText>
          <ThemedText colorToken="secondary" variant="bodySmall">
            días este mes
          </ThemedText>
        </GlassCard>

        <GlassCard style={styles.metricCard} variant="soft">
          <ThemedText colorToken="secondary" variant="label">
            Racha
          </ThemedText>
          <ThemedText style={styles.metricValue} variant="heading">
            {streakDays}
          </ThemedText>
          <ThemedText colorToken="secondary" variant="bodySmall">
            días hábiles
          </ThemedText>
        </GlassCard>
      </View>

      <GlassCard style={styles.settingsCard}>
        <SectionHeader title="Configuración" />

        {configItems.map((item) => (
          <View
            key={item.id}
            style={[
              styles.settingRow,
              {
                backgroundColor: theme.surface.glass.soft,
                borderColor: theme.surface.glass.border,
              },
            ]}
          >
            <View
              style={[
                styles.settingIcon,
                {
                  backgroundColor: theme.surface.glass.tint,
                  borderColor: theme.surface.glass.border,
                },
              ]}
            >
              <View
                style={[
                  styles.settingIconDot,
                  { backgroundColor: theme.colors.brand.primary },
                ]}
              />
            </View>

            <View style={styles.settingTextWrap}>
              <ThemedText variant="subtitle">{item.title}</ThemedText>
              <ThemedText colorToken="secondary" variant="bodySmall">
                {item.description}
              </ThemedText>
            </View>

            <View
              style={[
                styles.settingArrowWrap,
                {
                  backgroundColor: theme.surface.glass.tint,
                  borderColor: theme.surface.glass.border,
                },
              ]}
            >
              <ThemedText
                colorToken="secondary"
                style={styles.settingArrow}
                variant="label"
              >
                →
              </ThemedText>
            </View>
          </View>
        ))}
      </GlassCard>

      {errorMessage ? (
        <View
          style={[
            styles.messageCard,
            {
              backgroundColor: theme.surface.danger,
              borderColor: theme.surface.glass.border,
            },
          ]}
        >
          <ThemedText
            colorToken="error"
            style={styles.messageText}
            variant="bodySmall"
          >
            {errorMessage}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.footerActions}>
        <SecondaryButton
          accessibilityLabel="Cerrar sesión"
          label="Cerrar sesión"
          onPress={handleSignOut}
          textStyle={{ color: theme.colors.status.error }}
        />
      </View>
    </Screen>
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
  container: {
    gap: 16,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    alignItems: 'center',
    gap: 16,
  },
  profileHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleChip: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatar: {
    width: 112,
    height: 112,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroAvatarText: {
    textAlign: 'center',
  },
  heroCopy: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    textAlign: 'center',
  },
  email: {
    textAlign: 'center',
  },
  editButton: {
    minWidth: 196,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  metricValue: {},
  settingsCard: {
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 24,
    padding: 8,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  settingTextWrap: {
    flex: 1,
    gap: 4,
  },
  settingArrowWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingArrow: {
    textAlign: 'center',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  messageText: {
    textAlign: 'center',
  },
  footerActions: {
    marginBottom: 16,
  },
});
