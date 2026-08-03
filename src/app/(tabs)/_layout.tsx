import { Redirect, Tabs, usePathname } from 'expo-router';
import { Platform } from 'react-native';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { useOrganization } from '@/hooks/use-organization';
import { useSession } from '@/hooks/use-session';
import { buildAuthRouteWithRedirect } from '@/lib/auth-redirect';

function TabsNavigator() {
  const { isOrganizationSetupOpen, isLoadingOrganizations } = useOrganization();

  const shouldHideTabBar = isOrganizationSetupOpen || isLoadingOrganizations;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const activeRoute = props.state.routes[props.state.index]?.name;

        if (shouldHideTabBar || activeRoute === 'control-history') {
          return null;
        }

        return <BottomTabBar {...props} />;
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="control" options={{ title: 'Control' }} />
      <Tabs.Screen name="team" options={{ title: 'Equipo' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
      <Tabs.Screen
        name="control-history"
        options={{ href: null, title: 'Historial Control' }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { isInitializing, isSignedIn } = useSession();
  const routerPathname = usePathname();

  if (isInitializing) {
    // Web: a null layout breaks expo-router URL matching (route bounce), and
    // tabs render empty without a session. Native: the root Protected group
    // handles the gate instead.
    return Platform.OS === 'web' ? <TabsNavigator /> : null;
  }

  if (!isSignedIn) {
    // Web: the router store may still report "/" while a deep link hydrates.
    const pathname =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.pathname
        : routerPathname;

    return <Redirect href={buildAuthRouteWithRedirect('/login', pathname)} />;
  }

  return <TabsNavigator />;
}
