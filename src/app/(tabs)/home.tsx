import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { OrganizationSwitcher } from '@/components/organization-switcher';

import { StatusPill } from '@/components/status-pill';
import { Fonts, Spacing } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeOrganization,
    organizations,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
    setActiveOrganizationById,
    openOrganizationSetup,
  } = useOrganization();

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
          paddingBottom: insets.bottom + 110,
        },
      ]}
    >
      <View style={styles.header}>
        <OrganizationSwitcher
          activeOrganization={activeOrganization}
          organizations={organizations}
          onSelectOrganization={setActiveOrganizationById}
          onOpenOrganizationSetup={openOrganizationSetup}
        />

        <View style={styles.headerActions}>
          <View
            style={[styles.roundIcon, { backgroundColor: theme.surfaceMuted }]}
          >
            <View
              style={[
                styles.searchCircle,
                { borderColor: theme.textSecondary },
              ]}
            />
            <View
              style={[
                styles.searchHandle,
                { backgroundColor: theme.textSecondary },
              ]}
            />
          </View>
          <View
            style={[
              styles.headerAvatar,
              {
                borderColor: theme.primary,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          >
            <Text
              style={[styles.headerAvatarText, { color: theme.textSecondary }]}
            >
              TO
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.profileHeader}>
          <View
            style={[
              styles.avatarLarge,
              { backgroundColor: theme.primaryMuted },
            ]}
          >
            <Text style={[styles.avatarInitials, { color: theme.accent }]}>
              TO
            </Text>
            <View
              style={[styles.onlineDot, { backgroundColor: theme.primary }]}
            />
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>
            Thiago Oliveira
          </Text>
          <Text style={[styles.profileRole, { color: theme.textSecondary }]}>
            Senior Product Designer
          </Text>
        </View>

        <View style={styles.profileFooter}>
          <View style={styles.profileContact}>
            <View
              style={[styles.contactDot, { backgroundColor: theme.primary }]}
            />
            <Text style={[styles.contactText, { color: theme.textSecondary }]}>
              thiago@minut...
            </Text>
          </View>
          <View style={styles.profileContact}>
            <View
              style={[styles.contactDot, { backgroundColor: theme.primary }]}
            />
            <Text style={[styles.contactText, { color: theme.textSecondary }]}>
              +55 11 9882...
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.highlightCard,
          { backgroundColor: theme.primary, shadowColor: theme.shadow },
        ]}
      >
        <View style={styles.highlightBadge}>
          <View
            style={[
              styles.badgeSquare,
              { backgroundColor: theme.primaryMuted },
            ]}
          >
            <View
              style={[styles.badgeTick, { backgroundColor: theme.primary }]}
            />
          </View>
          <Text style={styles.badgeLabel}>PENDING SIGNATURE</Text>
        </View>
        <Text style={styles.highlightTitle}>
          Q3 Performance Review & Bonus Agreement
        </Text>
        <Text style={styles.highlightSubtitle}>Due in 2 days</Text>
        <View style={styles.highlightButton}>
          <Text style={[styles.highlightButtonText, { color: theme.primary }]}>
            Sign Document →
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.backgroundElement,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={[styles.metricIcon, { backgroundColor: theme.primaryMuted }]}
          >
            <View
              style={[
                styles.metricIconInner,
                { backgroundColor: theme.primary },
              ]}
            />
          </View>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            VACATION
          </Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>15</Text>
          <Text style={[styles.metricCaption, { color: theme.textSecondary }]}>
            Days remaining
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.backgroundElement,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={[styles.metricIcon, { backgroundColor: theme.primaryMuted }]}
          >
            <View
              style={[
                styles.metricIconInner,
                { backgroundColor: theme.primary },
              ]}
            />
          </View>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            ATTENDANCE
          </Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>98%</Text>
          <Text style={[styles.metricCaption, { color: theme.textSecondary }]}>
            On-time rate
          </Text>
        </View>
      </View>

      <View style={styles.quickRow}>
        {['Payroll', 'Benefits', 'Team'].map((label) => (
          <Pressable
            key={label}
            onPress={
              label === 'Team'
                ? () => router.push('/(tabs)/team' as never)
                : undefined
            }
            style={[
              styles.quickItem,
              {
                backgroundColor: theme.backgroundElement,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View
              style={[
                styles.quickIcon,
                { backgroundColor: theme.surfaceMuted },
              ]}
            />
            <Text style={[styles.quickLabel, { color: theme.text }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        style={[
          styles.activityCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.activityHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Recent Activity
          </Text>
          <Text style={[styles.sectionLink, { color: theme.primary }]}>
            View all
          </Text>
        </View>
        <View style={styles.activityItem}>
          <View
            style={[styles.activityDot, { backgroundColor: theme.primary }]}
          />
          <View>
            <Text style={[styles.activityTitle, { color: theme.text }]}>
              Bonus payment approved
            </Text>
            <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
              Yesterday, 4:30 PM
            </Text>
          </View>
        </View>
        <View style={styles.activityItem}>
          <View
            style={[
              styles.activityDot,
              { backgroundColor: theme.backgroundSelected },
            ]}
          />
          <View>
            <Text style={[styles.activityTitle, { color: theme.text }]}>
              Updated address in portal
            </Text>
            <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
              Oct 12, 11:20 AM
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statusRow}>
        <StatusPill label="ZONA DE TRABAJO VALIDADA" />
      </View>
    </ScrollView>
  );
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 120,
    elevation: 120,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  roundIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  searchCircle: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderRadius: 7,
  },
  searchHandle: {
    width: 8,
    height: 2,
    borderRadius: 2,
    marginTop: 2,
    transform: [{ rotate: '45deg' }],
  },
  profileCard: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  profileHeader: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  profileRole: {
    fontSize: 14,
    fontWeight: '500',
  },
  profileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  profileContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  contactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contactText: {
    fontSize: 12,
  },
  highlightCard: {
    borderRadius: 32,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badgeSquare: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTick: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EFFFF7',
    letterSpacing: 0.6,
  },
  highlightTitle: {
    color: '#F7FFFB',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  highlightSubtitle: {
    color: '#E3FFF2',
    fontSize: 14,
    fontWeight: '500',
  },
  highlightButton: {
    marginTop: Spacing.one,
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.two,
    borderRadius: 999,
    alignItems: 'center',
  },
  highlightButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.one,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  metricIconInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  metricCaption: {
    fontSize: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickItem: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityCard: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
  },
  statusRow: {
    alignItems: 'center',
  },
});
