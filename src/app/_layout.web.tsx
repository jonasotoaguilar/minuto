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
import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OrganizationProvider } from '@/hooks/use-organization';
import { useSession } from '@/hooks/use-session';
import { ThemeProvider } from '@/theme';

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

  // On web the navigator must stay mounted while fonts load (a null frame
  // makes expo-router fail URL matching); protected screens render empty
  // shells without a session and are locked once the session resolves.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <OrganizationProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Protected guard={isInitializing || isSignedIn}>
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="invitations" />
            <Stack.Screen name="org-settings" />
          </Stack.Protected>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="invite/[code]" />
          <Stack.Screen name="index" />
        </Stack>
      </OrganizationProvider>
    </ThemeProvider>
  );
}
