import '../global.css';

import { Stack } from 'expo-router';

import { OrganizationProvider } from '@/hooks/use-organization';
import { useSession } from '@/hooks/use-session';
import { ThemeProvider } from '@/theme';
import { FeedbackProvider } from '@/theme/feedback';

// Web typography resolves through the CSS font stacks declared in global.css
// (--font-display / --font-sans), which fall back to system families. No
// @font-face rule is registered for the expo-font family names on web, so the
// Lora/Manrope assets useFonts() would load are never applied to rendered
// text; loading them would only preload ~1 MB of TTFs on every exported page
// and delay first paint. The web layout therefore renders immediately and
// never gates the navigator on font state. The navigator stays mounted from
// the first frame (a null frame makes expo-router fail URL matching);
// protected screens render empty shells without a session and are locked once
// the session resolves.
export default function TabLayout() {
  const { isInitializing, isSignedIn } = useSession();

  return (
    <ThemeProvider>
      <FeedbackProvider>
        <OrganizationProvider>
          <Stack
            screenOptions={{ headerShown: false }}
            initialRouteName="index"
          >
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
      </FeedbackProvider>
    </ThemeProvider>
  );
}
