import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconProps = {
  color: string;
  isActive?: boolean;
};

function HomeIcon({ color, isActive }: IconProps) {
  return (
    <View style={styles.iconBox}>
      <View
        style={[
          styles.gridCell,
          { backgroundColor: color, opacity: isActive ? 1 : 0.6 },
        ]}
      />
      <View
        style={[
          styles.gridCell,
          { backgroundColor: color, opacity: isActive ? 0.9 : 0.45 },
        ]}
      />
      <View
        style={[
          styles.gridCell,
          { backgroundColor: color, opacity: isActive ? 0.85 : 0.4 },
        ]}
      />
      <View
        style={[
          styles.gridCell,
          { backgroundColor: color, opacity: isActive ? 0.75 : 0.35 },
        ]}
      />
    </View>
  );
}

function ClockIcon({ color, isActive }: IconProps) {
  return (
    <View style={[styles.clockShell, { borderColor: color }]}>
      <View
        style={[
          styles.clockHand,
          {
            backgroundColor: color,
            transform: [{ translateY: -5 }, { rotate: '90deg' }],
            opacity: isActive ? 1 : 0.6,
          },
        ]}
      />
      <View
        style={[
          styles.clockHand,
          {
            backgroundColor: color,
            transform: [{ translateY: -7 }],
            opacity: isActive ? 0.9 : 0.5,
          },
        ]}
      />
    </View>
  );
}

function PlusIcon({ color }: IconProps) {
  return (
    <View style={styles.plusIcon}>
      <View style={[styles.plusLine, { backgroundColor: color }]} />
      <View
        style={[
          styles.plusLine,
          styles.plusLineVertical,
          { backgroundColor: color },
        ]}
      />
    </View>
  );
}

export function BottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const primary = theme.primary;
  const inactive = theme.textSecondary;
  const routes = state.routes;

  const leftRoute = routes[0];
  const rightRoute = routes[1];

  const goToRoute = (routeName: string) => {
    navigation.navigate(routeName as never);
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            descriptors[leftRoute.key]?.options.title ?? 'Home'
          }
          onPress={() => goToRoute(leftRoute.name)}
          style={styles.tabButton}
        >
          <HomeIcon
            color={state.index === 0 ? primary : inactive}
            isActive={state.index === 0}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: state.index === 0 ? primary : inactive,
              },
            ]}
          >
            Inicio
          </Text>
        </Pressable>

        <View style={styles.centerSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Registrar"
            onPress={() => goToRoute('control')}
            style={[
              styles.centerButton,
              { backgroundColor: primary, shadowColor: theme.shadow },
            ]}
          >
            <PlusIcon color={theme.backgroundElement} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            descriptors[rightRoute.key]?.options.title ?? 'Control'
          }
          onPress={() => goToRoute(rightRoute.name)}
          style={styles.tabButton}
        >
          <ClockIcon
            color={state.index === 1 ? primary : inactive}
            isActive={state.index === 1}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: state.index === 1 ? primary : inactive,
              },
            ]}
          >
            Control
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
  },
  bar: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.one,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  centerSlot: {
    width: 74,
    alignItems: 'center',
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    marginTop: -Spacing.three,
  },
  plusIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusLine: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  plusLineVertical: {
    position: 'absolute',
    transform: [{ rotate: '90deg' }],
  },
  iconBox: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  gridCell: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  clockShell: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHand: {
    width: 2,
    height: 8,
    borderRadius: 2,
    position: 'absolute',
  },
});
