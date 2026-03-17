import { Tabs } from 'expo-router';

import { BottomTabBar } from '@/components/bottom-tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="control" options={{ title: 'Control' }} />
    </Tabs>
  );
}
