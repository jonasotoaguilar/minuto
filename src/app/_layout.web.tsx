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

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
