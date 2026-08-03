import type { Session } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

const authMock = supabase.auth as unknown as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
};

const fakeSession = { user: { id: 'user-1' } } as Session;
const unsubscribe = jest.fn();

function stubSubscription() {
  authMock.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe } },
  });
}

describe('useSession', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reports initializing until the persisted session resolves', async () => {
    let resolveSession!: (value: { data: { session: Session | null } }) => void;
    authMock.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    stubSubscription();

    const { result } = renderHook(() => useSession());

    expect(result.current.isInitializing).toBe(true);
    expect(result.current.isSignedIn).toBe(false);

    await act(async () => {
      resolveSession({ data: { session: fakeSession } });
    });

    expect(result.current.isInitializing).toBe(false);
    expect(result.current.isSignedIn).toBe(true);
  });

  it('is signed out when no persisted session exists', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    stubSubscription();

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    expect(result.current.isSignedIn).toBe(false);
  });

  it('follows auth state changes (sign out clears the session)', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: fakeSession } });
    let authListener!: (event: string, session: Session | null) => void;
    authMock.onAuthStateChange.mockImplementation((listener: unknown) => {
      authListener = listener as typeof authListener;
      return { data: { subscription: { unsubscribe } } };
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isSignedIn).toBe(true);
    });

    await act(async () => {
      authListener('SIGNED_OUT', null);
    });

    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.session).toBeNull();
  });

  it('never hangs when session bootstrap fails', async () => {
    authMock.getSession.mockRejectedValue(new Error('storage unavailable'));
    stubSubscription();

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    expect(result.current.isSignedIn).toBe(false);
  });

  it('prefers an auth event over a stale bootstrap result', async () => {
    let resolveSession!: (value: { data: { session: Session | null } }) => void;
    authMock.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    let authListener!: (event: string, session: Session | null) => void;
    authMock.onAuthStateChange.mockImplementation((listener: unknown) => {
      authListener = listener as typeof authListener;
      return { data: { subscription: { unsubscribe } } };
    });

    const { result } = renderHook(() => useSession());

    // A session event lands while the storage read is still pending...
    const freshSession = { user: { id: 'user-2' } } as Session;
    await act(async () => {
      authListener('INITIAL_SESSION', freshSession);
    });

    // ...then the stale bootstrap result resolves with an older session.
    await act(async () => {
      resolveSession({ data: { session: fakeSession } });
    });

    expect(result.current.session).toBe(freshSession);
    expect(result.current.isSignedIn).toBe(true);
  });

  it('unsubscribes from auth changes on unmount', () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    stubSubscription();

    const { unmount } = renderHook(() => useSession());

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
