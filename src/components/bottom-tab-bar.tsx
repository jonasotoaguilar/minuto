import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { GlassCard, ThemedText } from '@/theme/primitives';

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
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name="clock"
        size={22}
        tintColor={color}
        style={{ opacity: isActive ? 1 : 0.6 }}
      />
    );
  }

  // Android + Web fallback: simple circle + hands
  return (
    <View
      style={[
        styles.clockShell,
        { borderColor: color, opacity: isActive ? 1 : 0.6 },
      ]}
    >
      <View
        style={[
          styles.clockHand,
          {
            backgroundColor: color,
            transform: [{ translateY: -5 }, { rotate: '90deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.clockHand,
          {
            backgroundColor: color,
            transform: [{ translateY: -7 }],
          },
        ]}
      />
    </View>
  );
}

function TeamIcon({ color, isActive }: IconProps) {
  return (
    <View style={styles.teamIcon}>
      <View
        style={[
          styles.teamHeadPrimary,
          { backgroundColor: color, opacity: isActive ? 1 : 0.7 },
        ]}
      />
      <View
        style={[
          styles.teamHeadSecondary,
          { backgroundColor: color, opacity: isActive ? 0.7 : 0.45 },
        ]}
      />
      <View
        style={[
          styles.teamBodyPrimary,
          { borderColor: color, opacity: isActive ? 1 : 0.7 },
        ]}
      />
      <View
        style={[
          styles.teamBodySecondary,
          { borderColor: color, opacity: isActive ? 0.7 : 0.45 },
        ]}
      />
    </View>
  );
}

function ProfileIcon({ color, isActive }: IconProps) {
  return (
    <View style={styles.profileIcon}>
      <View
        style={[
          styles.profileHead,
          { backgroundColor: color, opacity: isActive ? 1 : 0.7 },
        ]}
      />
      <View
        style={[
          styles.profileBody,
          { borderColor: color, opacity: isActive ? 1 : 0.7 },
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

  const primary = theme.colors.brand.primary;
  const inactive = theme.colors.text.secondary;
  const routes = state.routes;

  const homeRoute = routes.find((route) => route.name === 'home') ?? routes[0];
  const controlRoute =
    routes.find((route) => route.name === 'control') ??
    routes[routes.length - 1];
  const teamRoute = routes.find((route) => route.name === 'team') ?? routes[0];
  const profileRoute =
    routes.find((route) => route.name === 'profile') ??
    routes[routes.length - 1];

  const homeRouteIndex = routes.findIndex(
    (route) => route.key === homeRoute.key,
  );
  const controlRouteIndex = routes.findIndex(
    (route) => route.key === controlRoute.key,
  );
  const teamRouteIndex = routes.findIndex(
    (route) => route.key === teamRoute.key,
  );
  const profileRouteIndex = routes.findIndex(
    (route) => route.key === profileRoute.key,
  );

  const goToRoute = (routeName: string) => {
    navigation.navigate(routeName as never);
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: insets.bottom,
          bottom: 0,
          left: 0,
          right: 0,
        },
      ]}
      pointerEvents="box-none"
    >
      <GlassCard
        padding={0}
        style={[
          styles.bar,
          {
            backgroundColor: theme.surface.glass.strong,
            borderColor: theme.surface.glass.border,
            shadowColor: theme.colors.shadow.color,
            ...theme.elevation.elevated,
          },
        ]}
        variant="soft"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            descriptors[homeRoute.key]?.options.title ?? 'Home'
          }
          onPress={() => goToRoute(homeRoute.name)}
          style={styles.tabButton}
        >
          <HomeIcon
            color={state.index === homeRouteIndex ? primary : inactive}
            isActive={state.index === homeRouteIndex}
          />
          <ThemedText
            style={[
              styles.tabLabel,
              {
                color: state.index === homeRouteIndex ? primary : inactive,
              },
            ]}
            variant="caption"
          >
            Inicio
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            descriptors[controlRoute.key]?.options.title ?? 'Control'
          }
          onPress={() => goToRoute(controlRoute.name)}
          style={styles.tabButton}
        >
          <ClockIcon
            color={state.index === controlRouteIndex ? primary : inactive}
            isActive={state.index === controlRouteIndex}
          />
          <ThemedText
            style={[
              styles.tabLabel,
              {
                color: state.index === controlRouteIndex ? primary : inactive,
              },
            ]}
            variant="caption"
          >
            Control
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            descriptors[teamRoute.key]?.options.title ?? 'Equipo'
          }
          onPress={() => goToRoute(teamRoute.name)}
          style={styles.tabButton}
        >
          <TeamIcon
            color={state.index === teamRouteIndex ? primary : inactive}
            isActive={state.index === teamRouteIndex}
          />
          <ThemedText
            style={[
              styles.tabLabel,
              {
                color: state.index === teamRouteIndex ? primary : inactive,
              },
            ]}
            variant="caption"
          >
            Equipo
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            descriptors[profileRoute.key]?.options.title ?? 'Perfil'
          }
          onPress={() => goToRoute(profileRoute.name)}
          style={styles.tabButton}
        >
          <ProfileIcon
            color={state.index === profileRouteIndex ? primary : inactive}
            isActive={state.index === profileRouteIndex}
          />
          <ThemedText
            style={[
              styles.tabLabel,
              {
                color: state.index === profileRouteIndex ? primary : inactive,
              },
            ]}
            variant="caption"
          >
            Perfil
          </ThemedText>
        </Pressable>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  bar: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    // TODO: Move to inline style with theme.typography.body.fontFamily
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
  teamIcon: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  teamHeadPrimary: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 1,
  },
  teamHeadSecondary: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 3,
    top: 5,
  },
  teamBodyPrimary: {
    width: 12,
    height: 8,
    borderWidth: 2,
    borderTopWidth: 0,
    borderRadius: 6,
    marginTop: 2,
  },
  teamBodySecondary: {
    width: 10,
    height: 7,
    borderWidth: 2,
    borderTopWidth: 0,
    borderRadius: 6,
    position: 'absolute',
    left: 1,
    top: 10,
  },
  profileIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  profileHead: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 1,
  },
  profileBody: {
    width: 14,
    height: 8,
    borderWidth: 2,
    borderTopWidth: 0,
    borderRadius: 7,
    marginTop: 2,
  },
});
