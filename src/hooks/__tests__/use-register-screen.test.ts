import { act, renderHook } from '@testing-library/react-native';

import {
  type RegisterFormValues,
  useRegisterScreen,
} from '@/hooks/use-register-screen';
import { supabase } from '@/lib/supabase';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ redirect: undefined }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
  },
}));

const mockSignUp = supabase.auth.signUp as jest.Mock;

function fillValidForm(result: {
  current: {
    setFieldValue: (field: keyof RegisterFormValues, value: string) => void;
  };
}) {
  act(() => {
    result.current.setFieldValue('fullName', 'Ana Pérez');
    result.current.setFieldValue('address', 'Av Siempre Viva 123');
    result.current.setFieldValue('email', 'ana@empresa.com');
    result.current.setFieldValue('phone', '9 1234 5678');
    result.current.setFieldValue('password', 'secret123');
    result.current.setFieldValue('confirmPassword', 'secret123');
  });
}

describe('useRegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates the phone and blocks an invalid form', async () => {
    const { result } = renderHook(() => useRegisterScreen());

    fillValidForm(result);
    act(() => {
      result.current.setFieldValue('phone', '123');
    });

    expect(result.current.validationFieldErrors.phone).toContain(
      'Ingresa un número válido',
    );
    expect(result.current.isSubmitDisabled).toBe(true);

    await act(async () => {
      await result.current.handleSignUp();
    });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('creates the account and redirects to login after success', async () => {
    jest.useFakeTimers();
    mockSignUp.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useRegisterScreen());
    fillValidForm(result);

    await act(async () => {
      await result.current.handleSignUp();
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'ana@empresa.com',
      password: 'secret123',
      options: {
        data: {
          display_name: 'Ana Pérez',
          address: 'Av Siempre Viva 123',
          phone: '+56912345678',
        },
      },
    });
    expect(result.current.infoMessage).toContain('Registro exitoso');

    act(() => {
      jest.advanceTimersByTime(1600);
    });
    expect(mockReplace).toHaveBeenCalledWith('/login');

    jest.useRealTimers();
  });

  it('maps already-registered errors to a friendly message', async () => {
    mockSignUp.mockResolvedValue({
      error: { message: 'User already registered' },
    });

    const { result } = renderHook(() => useRegisterScreen());
    fillValidForm(result);

    await act(async () => {
      await result.current.handleSignUp();
    });

    expect(result.current.errorMessage).toBe(
      'Este email ya está registrado. Iniciá sesión o recuperá la contraseña.',
    );
  });

  it('guards against rapid resubmission', async () => {
    mockSignUp.mockResolvedValue({
      error: { message: 'network error' },
    });

    const { result } = renderHook(() => useRegisterScreen());
    fillValidForm(result);

    await act(async () => {
      await result.current.handleSignUp();
    });
    await act(async () => {
      await result.current.handleSignUp();
    });

    expect(result.current.errorMessage).toBe(
      'Esperá un momento antes de volver a intentar.',
    );
  });
});
