import '../global.css';

import { Stack } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OrganizationProvider } from '@/hooks/use-organization';
import { ThemeProvider } from '@/theme';

// Web: fonts are loaded via @font-face declarations in global.css — no
// expo-font/useFonts needed. The CSS already references the correct families.
export default function TabLayout() {
  return (
    <ThemeProvider>
      <OrganizationProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="invite/[code]" />
          <Stack.Screen name="org-settings" />
          <Stack.Screen name="index" />
        </Stack>
      </OrganizationProvider>
    </ThemeProvider>
  );
}
