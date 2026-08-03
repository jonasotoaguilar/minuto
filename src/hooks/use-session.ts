import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Resolves the persisted Supabase session on mount and stays subscribed to
 * auth changes; `isInitializing` stays true until the session is known so
 * route gates never render (or flash) the wrong screen. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;
    // Tracks auth events that land before the bootstrap read finishes; their
    // state is fresher than the getSession() result, which must not clobber it.
    let sessionFromEvent: Session | null | undefined;

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) {
          return;
        }

        sessionFromEvent = nextSession;
        setSession(nextSession);
        setIsInitializing(false);
      },
    );

    void supabase.auth
      .getSession()
      .then(({ data }) => data.session)
      .catch(() => null)
      .then((resolvedSession) => {
        if (!isMounted || sessionFromEvent !== undefined) {
          return;
        }

        setSession(resolvedSession);
        setIsInitializing(false);
      });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return {
    isInitializing,
    isSignedIn: session !== null,
    session,
  };
}
