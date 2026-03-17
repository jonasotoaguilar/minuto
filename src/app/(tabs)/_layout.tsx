import { Tabs } from 'expo-router';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { OrganizationProvider } from '@/hooks/use-organization';

export default function TabsLayout() {
  return (
    <OrganizationProvider>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="control" options={{ title: 'Control' }} />
      </Tabs>
    </OrganizationProvider>
  );
}
