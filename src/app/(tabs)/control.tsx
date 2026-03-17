import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusPill } from '@/components/status-pill';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ControlScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
        <View style={styles.brand}>
          <View style={[styles.brandIcon, { backgroundColor: theme.primary }]}>
            <Text style={styles.brandLetter}>M</Text>
          </View>
          <View>
            <Text style={[styles.brandText, { color: theme.text }]}>
              Minuto
            </Text>
            <Text style={[styles.brandSub, { color: theme.primary }]}>
              ASISTENCIA
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View
            style={[styles.roundIcon, { backgroundColor: theme.surfaceMuted }]}
          />
          <View style={[styles.avatarShell, { borderColor: theme.primary }]} />
        </View>
      </View>

      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <StatusPill label="ZONA DE TRABAJO VALIDADA" />
        <Text style={[styles.clock, { color: theme.text }]}>09:41</Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>
          Jueves, 12 de Octubre
        </Text>
        <View
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.primaryButtonText}>Registrar Entrada</Text>
        </View>
        <Text style={[styles.helper, { color: theme.textSecondary }]}>
          Asegura el pago correcto de tus horas registrando tu entrada.
        </Text>
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
          />
          <Text style={[styles.metricValue, { color: theme.text }]}>
            38h 20m
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Horas semanales
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
          />
          <Text style={[styles.metricValue, { color: theme.text }]}>4 / 5</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Asistencia comp.
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Historial Reciente
        </Text>
        <Text style={[styles.sectionLink, { color: theme.primary }]}>
          Ver Todo
        </Text>
      </View>

      <View
        style={[
          styles.historyCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        {[
          {
            label: 'Entrada Hoy',
            time: '09:00 AM',
            place: 'Oficina Principal',
          },
          { label: 'Salida Ayer', time: '06:15 PM', place: 'Remoto' },
          { label: 'Entrada Ayer', time: '08:55 AM', place: 'Remoto' },
        ].map((item) => (
          <View key={item.label} style={styles.historyRow}>
            <View
              style={[
                styles.historyIcon,
                { backgroundColor: theme.primaryMuted },
              ]}
            />
            <View style={styles.historyInfo}>
              <Text style={[styles.historyTitle, { color: theme.text }]}>
                {item.label}
              </Text>
              <Text
                style={[styles.historyPlace, { color: theme.textSecondary }]}
              >
                {item.place}
              </Text>
            </View>
            <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
              {item.time}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  brandSub: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
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
  },
  avatarShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
  },
  heroCard: {
    borderRadius: 32,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  clock: {
    fontSize: 48,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  date: {
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    marginTop: Spacing.two,
    width: '100%',
    paddingVertical: Spacing.two,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  helper: {
    textAlign: 'center',
    fontSize: 12,
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
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  historyCard: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyPlace: {
    fontSize: 12,
  },
  historyTime: {
    fontSize: 12,
    fontWeight: '600',
  },
});
