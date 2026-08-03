import {
  Lora_400Regular,
  Lora_500Medium,
  Lora_600SemiBold,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OrganizationProvider } from '@/hooks/use-organization';
import { useSession } from '@/hooks/use-session';
import { ThemeProvider } from '@/theme';

// Keep the native splash screen visible while we load fonts and resolve the
// persisted session, so the first frame is always the correct gate state.
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const { isInitializing, isSignedIn } = useSession();

  useEffect(() => {
    // Hide the splash once fonts are ready (or on error) and session
    // bootstrap has settled, so the first frame is the correct gate state.
    if ((fontsLoaded || fontError) && !isInitializing) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isInitializing]);

  // Don't render the navigation tree until fonts are ready and the session
  // state is known; rendering before either would flash the wrong route.
  if ((!fontsLoaded && !fontError) || isInitializing) {
    return null;
  }

  return (
    <ThemeProvider>
      <OrganizationProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="invitations" />
            <Stack.Screen name="org-settings" />
          </Stack.Protected>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="invite/[code]" />
          <Stack.Screen name="index" />
        </Stack>
      </OrganizationProvider>
    </ThemeProvider>
  );
}
