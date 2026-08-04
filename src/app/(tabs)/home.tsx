import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  type AttendanceEvent,
  type AttendanceRecord,
  calculateWeeklyTotals,
  getAttendanceRecordsForRange,
  getOpenShift,
  getOrganizationToday,
  getOrganizationWeekRange,
  getRecentAttendanceEvents,
  getTodayAttendanceRecord,
  type OpenShift,
} from '@/lib/attendance';
import { getErrorMessage } from '@/lib/error';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
  AttendanceIcon,
  Avatar,
  Chip,
  FeedbackBlock,
  GlassCard,
  MetricCard,
  Screen,
  SectionHeader,
  Skeleton,
  ThemedText,
} from '@/theme/primitives';

const QUICK_ACTIONS: ReadonlyArray<{
  href?: '/(tabs)/control' | '/(tabs)/control-history' | '/(tabs)/team';
  label: string;
}> = [
  { href: '/(tabs)/control', label: 'Control' },
  { href: '/(tabs)/control-history', label: 'Historial' },
  { href: '/(tabs)/team', label: 'Equipo' },
];

const RECENT_EVENTS_LIMIT = 5;

type HomeUserSnapshot = {
  email: string;
  fullName: string;
  initials: string;
  phone: string;
};

const initialHomeUserSnapshot: HomeUserSnapshot = {
  email: '',
  fullName: 'Usuario Minuto',
  initials: 'UM',
  phone: '',
};

type TodayStatus = {
  label: string;
  tone: 'brand' | 'neutral' | 'success';
};

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const isScreenFocused = useIsFocused();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();
  const currentTimezone = resolveOrganizationTimezone(
    activeOrganization?.defaultTimezone,
  );
  const [userSnapshot, setUserSnapshot] = useState<HomeUserSnapshot>(
    initialHomeUserSnapshot,
  );
  const [isLoadingHome, setIsLoadingHome] = useState(true);
  const [homeErrorMessage, setHomeErrorMessage] = useState('');
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyAttendedDays, setWeeklyAttendedDays] = useState(0);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [openShiftRecord, setOpenShiftRecord] = useState<OpenShift | null>(
    null,
  );
  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const loadHomeUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user || !isMounted) {
        return;
      }

      const displayName =
        typeof data.user.user_metadata.display_name === 'string' &&
        data.user.user_metadata.display_name.trim().length > 0
          ? data.user.user_metadata.display_name.trim()
          : deriveNameFromEmail(data.user.email) || 'Usuario Minuto';

      const phone =
        typeof data.user.user_metadata.phone === 'string'
          ? data.user.user_metadata.phone.trim()
          : '';

      setUserSnapshot({
        email: data.user.email ?? '',
        fullName: displayName,
        initials: deriveInitials(displayName),
        phone,
      });
    };

    void loadHomeUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadHomeData = useCallback(async () => {
    if (!activeOrganization) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoadingHome(true);
    setHomeErrorMessage('');

    const currentDate = getOrganizationToday(currentTimezone);
    const week = getOrganizationWeekRange(currentTimezone);

    try {
      const [today, weeklyRecords, recent, openShift] = await Promise.all([
        getTodayAttendanceRecord({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          workDate: currentDate,
        }),
        getAttendanceRecordsForRange({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          startDate: week.start,
          endDate: week.end,
        }),
        getRecentAttendanceEvents({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          recordLimit: RECENT_EVENTS_LIMIT,
          eventLimit: RECENT_EVENTS_LIMIT,
        }),
        getOpenShift(activeOrganization.membershipId),
      ]);

      if (requestId !== requestIdRef.current || !isMountedRef.current) return;

      const totals = calculateWeeklyTotals(weeklyRecords, {
        includeOpenShiftMinutes: true,
        now: new Date(),
      });

      setTodayRecord(today);
      setOpenShiftRecord(openShift);
      setWeeklyMinutes(totals.totalMinutes);
      setWeeklyAttendedDays(totals.attendedDays);
      setRecentEvents(recent);
    } catch (error) {
      if (requestId !== requestIdRef.current || !isMountedRef.current) return;

      setHomeErrorMessage(
        getErrorMessage(error) ??
          'No se pudieron cargar tus datos de asistencia.',
      );
    } finally {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setIsLoadingHome(false);
      }
    }
  }, [activeOrganization, currentTimezone]);

  useEffect(() => {
    if (!isScreenFocused) {
      requestIdRef.current += 1;
      return;
    }

    isMountedRef.current = true;
    void loadHomeData();

    return () => {
      isMountedRef.current = false;
    };
  }, [isScreenFocused, loadHomeData]);

  const membershipRoleLabel = useMemo(
    () => formatMembershipRole(activeOrganization?.membershipRole),
    [activeOrganization?.membershipRole],
  );

  const todayStatus = useMemo<TodayStatus>(() => {
    if (openShiftRecord?.clockInAt) {
      return { label: 'Jornada en curso', tone: 'success' };
    }

    if (todayRecord?.clockOutAt) {
      return { label: 'Jornada completada', tone: 'brand' };
    }

    if (todayRecord?.clockInAt) {
      return { label: 'Jornada en curso', tone: 'success' };
    }

    return { label: 'Sin registros hoy', tone: 'neutral' };
  }, [openShiftRecord, todayRecord]);

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
          <Avatar
            accessibilityLabel="Tu avatar"
            initials={userSnapshot.initials}
            size="lg"
          />

          <View style={styles.profileCopy}>
            <ThemedText style={styles.profileName} variant="heading">
              {userSnapshot.fullName}
            </ThemedText>
            <ThemedText colorToken="secondary" variant="subtitle">
              {membershipRoleLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.profileFooter}>
          <ContactItem label={userSnapshot.email || 'Sin correo registrado'} />
          <ContactItem
            label={userSnapshot.phone || 'Sin teléfono registrado'}
          />
        </View>
      </GlassCard>

      <GlassCard
        style={[
          styles.highlightCard,
          {
            backgroundColor: theme.colors.brand.primary,
            borderColor: theme.colors.brand.primary,
          },
        ]}
        variant="soft"
      >
        <Chip label="ASISTENCIA" tone="brand" />

        <View style={styles.highlightCopy}>
          <ThemedText colorToken="inverse" variant="heading">
            Registrá tu jornada
          </ThemedText>
          <ThemedText colorToken="inverse" variant="body">
            Marcá tu entrada y tu salida para mantener un registro de asistencia
            preciso.
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/control')}
          style={({ pressed }) => [
            styles.highlightButton,
            {
              backgroundColor: theme.colors.background.card,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <ThemedText colorToken="accent" variant="label">
            Ir a Control →
          </ThemedText>
        </Pressable>
      </GlassCard>

      {isLoadingHome ? (
        <MetricsSkeleton />
      ) : homeErrorMessage ? (
        <FeedbackBlock tone="error" message={homeErrorMessage} />
      ) : (
        <View style={styles.metricsRow}>
          <MetricCard
            icon={<MetricIconPlaceholder />}
            label="Horas semanales"
            value={formatMinutes(weeklyMinutes)}
          />
          <MetricCard
            icon={<MetricIconPlaceholder />}
            label="Días asistidos"
            value={String(weeklyAttendedDays)}
          />
        </View>
      )}

      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map((action) => {
          let handlePress: (() => void) | undefined;

          if (action.href) {
            const href = action.href;
            handlePress = () => router.push(href);
          }

          return (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={handlePress}
              style={({ pressed }) => [
                styles.quickItem,
                {
                  backgroundColor: theme.surface.glass.soft,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.quickIcon,
                  {
                    backgroundColor: theme.surface.glass.tint,
                  },
                ]}
              >
                <View
                  style={[
                    styles.quickIconDot,
                    { backgroundColor: theme.colors.brand.primary },
                  ]}
                />
              </View>
              <ThemedText variant="label">{action.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      {isLoadingHome ? (
        <ActivitySkeleton />
      ) : homeErrorMessage ? null : (
        <GlassCard style={styles.activityCard} variant="soft">
          <SectionHeader
            actionLabel="Ver todo"
            actionProps={{
              onPress: () => router.push('/(tabs)/control-history'),
            }}
            title="Actividad reciente"
          />

          {recentEvents.length === 0 ? (
            <ThemedText colorToken="secondary" variant="bodySmall">
              Todavía no hay registros.
            </ThemedText>
          ) : (
            recentEvents.map((event) => (
              <View key={event.id} style={styles.activityItem}>
                <AttendanceIcon
                  direction={event.type === 'clock_in' ? 'in' : 'out'}
                  size="sm"
                />

                <View style={styles.activityCopy}>
                  <ThemedText variant="subtitle">
                    {event.type === 'clock_in' ? 'Entrada' : 'Salida'}
                  </ThemedText>
                  <ThemedText colorToken="secondary" variant="bodySmall">
                    {formatHistoryOfficeLabel(
                      event.officeName,
                      event.officeIsRemote,
                    )}
                  </ThemedText>
                </View>

                <View style={styles.activityMeta}>
                  <ThemedText style={styles.activityTime} variant="subtitle">
                    {formatTime(event.occurredAt, currentTimezone)}
                  </ThemedText>
                  <ThemedText colorToken="secondary" variant="bodySmall">
                    {formatCompactDate(event.occurredAt, currentTimezone)}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </GlassCard>
      )}

      <View style={styles.statusRow}>
        {isLoadingHome ? (
          <Skeleton radius={999} style={styles.statusSkeleton} />
        ) : homeErrorMessage ? null : (
          <Chip label={todayStatus.label} selected tone={todayStatus.tone} />
        )}
      </View>
    </Screen>
  );
}

function deriveNameFromEmail(email: string | null | undefined) {
  if (!email) return '';

  return email
    .split('@')[0]
    ?.split(/[._-]+/)
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1).toLowerCase())
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

function formatMembershipRole(role?: string | null) {
  switch (role) {
    case 'owner':
      return 'Propietario';
    case 'admin':
      return 'Administrador';
    case 'manager':
      return 'Manager';
    case 'employee':
      return 'Colaborador';
    default:
      return 'Miembro del equipo';
  }
}

function ContactItem({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.profileContact}>
      <View
        style={[
          styles.contactDot,
          { backgroundColor: theme.colors.brand.primary },
        ]}
      />
      <ThemedText colorToken="secondary" variant="caption">
        {label}
      </ThemedText>
    </View>
  );
}

function MetricIconPlaceholder() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.metricIcon,
        {
          backgroundColor: theme.surface.glass.tint,
          borderColor: theme.surface.glass.border,
        },
      ]}
    >
      <View
        style={[
          styles.metricIconInner,
          { backgroundColor: theme.colors.brand.primary },
        ]}
      />
    </View>
  );
}

function MetricsSkeleton() {
  return (
    <View style={styles.metricsRow}>
      <MetricSkeletonCard />
      <MetricSkeletonCard />
    </View>
  );
}

function MetricSkeletonCard() {
  return (
    <GlassCard style={styles.metricCard} variant="soft">
      <Skeleton style={styles.skeletonMetricIcon} />
      <Skeleton style={styles.skeletonMetricValue} />
      <Skeleton style={styles.skeletonMetricLabel} />
    </GlassCard>
  );
}

function ActivitySkeleton() {
  return (
    <GlassCard style={styles.activityCard} variant="soft">
      <Skeleton style={styles.skeletonActivityHeader} />

      {Array.from({ length: 3 }).map((_, index) => (
        <View key={`activity-skeleton-${index}`} style={styles.activityItem}>
          <Skeleton style={styles.skeletonActivityIcon} />

          <View style={styles.activityCopy}>
            <Skeleton style={styles.skeletonActivityLinePrimary} />
            <Skeleton style={styles.skeletonActivityLineSecondary} />
          </View>

          <Skeleton style={styles.skeletonActivityMeta} />
        </View>
      ))}
    </GlassCard>
  );
}

function formatHistoryOfficeLabel(
  officeName: string | null | undefined,
  officeIsRemote?: boolean,
) {
  if (officeIsRemote) {
    return 'Remoto';
  }

  return officeName?.trim() || 'Sin sucursal';
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatCompactDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 720,
    paddingHorizontal: 16,
    width: '100%',
  },
  loaderContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  profileCard: {
    gap: 16,
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    letterSpacing: -0.3,
  },
  profileFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  profileContact: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  contactDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  highlightCard: {
    gap: 16,
  },
  highlightCopy: {
    gap: 8,
  },
  highlightButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    gap: 8,
    minHeight: 148,
    justifyContent: 'space-between',
  },
  metricIcon: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  metricIconInner: {
    borderRadius: 999,
    height: 16,
    width: 16,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickItem: {
    alignItems: 'center',
    borderRadius: 20,
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 112,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  quickIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickIconDot: {
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  activityCard: {
    gap: 16,
  },
  activityItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  activityCopy: {
    flex: 1,
    gap: 2,
  },
  activityMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  activityTime: {
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    alignItems: 'center',
  },
  statusSkeleton: {
    height: 28,
    width: 180,
  },
  skeletonMetricIcon: {
    borderRadius: 999,
    height: 40,
    width: 40,
  },
  skeletonMetricValue: {
    borderRadius: 8,
    height: 28,
    width: '70%',
  },
  skeletonMetricLabel: {
    borderRadius: 6,
    height: 14,
    width: '55%',
  },
  skeletonActivityHeader: {
    borderRadius: 8,
    height: 24,
    width: '55%',
  },
  skeletonActivityIcon: {
    borderRadius: 999,
    height: 18,
    width: 18,
  },
  skeletonActivityLinePrimary: {
    borderRadius: 6,
    height: 14,
    width: '60%',
  },
  skeletonActivityLineSecondary: {
    borderRadius: 6,
    height: 12,
    width: '40%',
  },
  skeletonActivityMeta: {
    borderRadius: 6,
    height: 14,
    width: 56,
  },
});
