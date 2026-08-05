import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useLoginScreen } from '@/hooks/use-login-screen';
import { supabase } from '@/lib/supabase';

const mockReplace = jest.fn();
const mockRedirect: { current: string | undefined } = { current: undefined };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ redirect: mockRedirect.current }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));

const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;

describe('useLoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.current = undefined;
  });

  it('shows a field error and blocks sign-in for invalid input', async () => {
    const { result } = renderHook(() => useLoginScreen());

    act(() => {
      result.current.setEmail('no-un-email');
      result.current.setPassword('12345678');
    });

    await act(async () => {
      await result.current.handleSignIn();
    });

    expect(result.current.errorMessage).toBe('Ingresa un email válido.');
    expect(result.current.touchedFields.email).toBe(true);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('signs in and redirects to the sanitized redirect target', async () => {
    mockSignIn.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mockRedirect.current = '/invite/ACME-123';

    const { result } = renderHook(() => useLoginScreen());
    act(() => {
      result.current.setEmail('ana@empresa.com');
      result.current.setPassword('secret123');
    });

    await act(async () => {
      await result.current.handleSignIn();
    });

    expect(mockReplace).toHaveBeenCalledWith('/invite/ACME-123');
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'ana@empresa.com',
      password: 'secret123',
    });
  });

  it('redirects to home when no redirect param is present', async () => {
    mockSignIn.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });

    const { result } = renderHook(() => useLoginScreen());
    act(() => {
      result.current.setEmail('ana@empresa.com');
      result.current.setPassword('secret123');
    });

    await act(async () => {
      await result.current.handleSignIn();
    });

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('locks the form after five failed attempts', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid credentials' },
    });

    const { result } = renderHook(() => useLoginScreen());
    act(() => {
      result.current.setEmail('ana@empresa.com');
      result.current.setPassword('secret123');
    });

    const attempts = Array.from({ length: 5 }, () =>
      result.current.handleSignIn(),
    );
    await act(async () => {
      await Promise.all(attempts);
    });

    expect(result.current.failedAttempts).toBe(0);
    expect(result.current.isLockoutActive).toBe(true);
    expect(result.current.lockoutSecondsLeft).toBe(30);
    expect(result.current.isSubmitDisabled).toBe(true);
    expect(result.current.errorMessage).toBe(
      'Credenciales inválidas o acceso bloqueado temporalmente.',
    );
  });

  it('shows an info message when the session is created without a session', async () => {
    mockSignIn.mockResolvedValue({ data: { session: null }, error: null });

    const { result } = renderHook(() => useLoginScreen());
    act(() => {
      result.current.setEmail('ana@empresa.com');
      result.current.setPassword('secret123');
    });

    await act(async () => {
      await result.current.handleSignIn();
    });

    await waitFor(() => {
      expect(result.current.infoMessage).toBe(
        'Sesión creada. Continuá para ingresar.',
      );
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
