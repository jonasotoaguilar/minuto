import { Redirect } from 'expo-router';

import { useSession } from '@/hooks/use-session';

export default function IndexRedirect() {
  const { isInitializing, isSignedIn } = useSession();

  if (isInitializing) {
    return null;
  }

  return <Redirect href={isSignedIn ? '/(tabs)/home' : '/login'} />;
}
