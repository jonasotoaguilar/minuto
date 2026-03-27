import { Tabs } from 'expo-router';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { useOrganization } from '@/hooks/use-organization';

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
  return <TabsNavigator />;
}
