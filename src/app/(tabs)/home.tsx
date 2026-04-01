import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import {
  Chip,
  GlassCard,
  Screen,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

const QUICK_ACTIONS: ReadonlyArray<{ href?: '/(tabs)/team'; label: string }> = [
  { label: 'Payroll' },
  { label: 'Benefits' },
  { href: '/(tabs)/team', label: 'Team' },
];

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

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();
  const [userSnapshot, setUserSnapshot] = useState<HomeUserSnapshot>(
    initialHomeUserSnapshot,
  );

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

  const membershipRoleLabel = useMemo(
    () => formatMembershipRole(activeOrganization?.membershipRole),
    [activeOrganization?.membershipRole],
  );

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
          <View
            style={[
              styles.avatarLarge,
              {
                backgroundColor: theme.surface.glass.tint,
                borderColor: theme.surface.glass.border,
              },
            ]}
          >
            <ThemedText colorToken="accent" variant="heading">
              {userSnapshot.initials}
            </ThemedText>
            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: theme.colors.status.success,
                  borderColor: theme.colors.background.card,
                },
              ]}
            />
          </View>

          <View style={styles.profileCopy}>
            <ThemedText style={styles.profileName} variant="heading">
              {userSnapshot.fullName}
            </ThemedText>
            <ThemedText colorToken="secondary" variant="subtitle">
              {membershipRoleLabel}
            </ThemedText>
          </View>

          <Chip label="En línea" selected tone="success" />
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
        <Chip label="PENDING SIGNATURE" tone="brand" />

        <View style={styles.highlightCopy}>
          <ThemedText colorToken="inverse" variant="heading">
            Q3 Performance Review & Bonus Agreement
          </ThemedText>
          <ThemedText colorToken="inverse" variant="body">
            Due in 2 days
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.highlightButton,
            {
              backgroundColor: theme.colors.background.card,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <ThemedText colorToken="accent" variant="label">
            Sign Document →
          </ThemedText>
        </Pressable>
      </GlassCard>

      <View style={styles.metricsRow}>
        <MetricCard label="VACATION" value="15" caption="Days remaining" />
        <MetricCard label="ATTENDANCE" value="98%" caption="On-time rate" />
      </View>

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

      <GlassCard style={styles.activityCard} variant="soft">
        <SectionHeader
          action={
            <ThemedText colorToken="accent" variant="label">
              View all
            </ThemedText>
          }
          title="Recent Activity"
        />

        <ActivityItem
          accentColor={theme.colors.status.success}
          title="Bonus payment approved"
          when="Yesterday, 4:30 PM"
        />
        <ActivityItem
          accentColor={theme.colors.background.selected}
          title="Updated address in portal"
          when="Oct 12, 11:20 AM"
        />
      </GlassCard>

      <View style={styles.statusRow}>
        <Chip label="ZONA DE TRABAJO VALIDADA" selected tone="success" />
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

function MetricCard(props: { caption: string; label: string; value: string }) {
  const theme = useTheme();

  return (
    <GlassCard style={styles.metricCard} variant="soft">
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
      <ThemedText colorToken="secondary" variant="label">
        {props.label}
      </ThemedText>
      <ThemedText style={styles.metricValue} variant="heading">
        {props.value}
      </ThemedText>
      <ThemedText colorToken="secondary" variant="bodySmall">
        {props.caption}
      </ThemedText>
    </GlassCard>
  );
}

function ActivityItem(props: {
  accentColor: string;
  title: string;
  when: string;
}) {
  return (
    <View style={styles.activityItem}>
      <View
        style={[styles.activityDot, { backgroundColor: props.accentColor }]}
      />
      <View style={styles.activityCopy}>
        <ThemedText variant="subtitle">{props.title}</ThemedText>
        <ThemedText colorToken="secondary" variant="bodySmall">
          {props.when}
        </ThemedText>
      </View>
    </View>
  );
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
  avatarLarge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  onlineDot: {
    borderRadius: 999,
    borderWidth: 2,
    bottom: 6,
    height: 14,
    position: 'absolute',
    right: 6,
    width: 14,
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
  metricValue: {
    letterSpacing: -0.5,
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
  activityDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  activityCopy: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    alignItems: 'center',
  },
});
