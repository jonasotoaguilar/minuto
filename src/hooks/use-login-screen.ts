import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { z } from 'zod';
import { sanitizeAuthRedirect } from '@/lib/auth-redirect';
import { getErrorMessage } from '@/lib/error';
import { supabase } from '@/lib/supabase';

const MAX_EMAIL_LENGTH = 120;
const MAX_PASSWORD_LENGTH = 72;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const LOGIN_THROTTLE_STORAGE_KEY = 'login_throttle_state';

interface LoginThrottleState {
  failedAttempts: number;
  lockoutEndsAt: number | null;
}

const loginThrottleStateSchema = z.object({
  failedAttempts: z.number().int().min(0),
  lockoutEndsAt: z.number().int().nullable(),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Ingresa un email válido.')
    .max(
      MAX_EMAIL_LENGTH,
      `El email no puede superar ${MAX_EMAIL_LENGTH} caracteres.`,
    ),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(
      MAX_PASSWORD_LENGTH,
      `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`,
    ),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type LoginFieldErrors = Partial<Record<keyof LoginFormValues, string>>;
export type LoginTouchedFields = Partial<
  Record<keyof LoginFormValues, boolean>
>;

function getWebStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

async function readStoredLoginThrottleState(): Promise<LoginThrottleState> {
  try {
    const webStorage = getWebStorage();
    const rawValue = webStorage
      ? webStorage.getItem(LOGIN_THROTTLE_STORAGE_KEY)
      : await AsyncStorage.getItem(LOGIN_THROTTLE_STORAGE_KEY);

    if (!rawValue) {
      return { failedAttempts: 0, lockoutEndsAt: null };
    }

    const parsedValue = loginThrottleStateSchema.safeParse(
      JSON.parse(rawValue),
    );

    if (!parsedValue.success) {
      console.warn('Formato inválido en el throttle de login persistido.');
    }

    return parsedValue.success
      ? parsedValue.data
      : { failedAttempts: 0, lockoutEndsAt: null };
  } catch (error) {
    console.warn('No se pudo leer el throttle de login persistido.', error);
    return { failedAttempts: 0, lockoutEndsAt: null };
  }
}

async function writeStoredLoginThrottleState(state: LoginThrottleState) {
  try {
    const serializedValue = JSON.stringify(state);
    const webStorage = getWebStorage();

    if (webStorage) {
      webStorage.setItem(LOGIN_THROTTLE_STORAGE_KEY, serializedValue);
      return;
    }

    await AsyncStorage.setItem(LOGIN_THROTTLE_STORAGE_KEY, serializedValue);
  } catch (error) {
    console.warn('No se pudo persistir el throttle de login.', error);
  }
}

export function useLoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutEndsAt, setLockoutEndsAt] = useState<number | null>(null);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [touchedFields, setTouchedFields] = useState<LoginTouchedFields>({});
  const [focusedField, setFocusedField] = useState<
    keyof LoginFormValues | null
  >(null);

  const normalizedValues = useMemo(
    () => ({
      email: email.trim().toLowerCase(),
      password,
    }),
    [email, password],
  );

  const redirectTo = useMemo(() => sanitizeAuthRedirect(redirect), [redirect]);

  const validationResult = useMemo(
    () => loginSchema.safeParse(normalizedValues),
    [normalizedValues],
  );

  const fieldErrors = useMemo<LoginFieldErrors>(() => {
    if (validationResult.success) {
      return {};
    }

    const flattenedError = z.flattenError(validationResult.error);
    const nextErrors: LoginFieldErrors = {};

    Object.entries(flattenedError.fieldErrors).forEach(([field, errors]) => {
      if (!errors?.length) {
        return;
      }

      nextErrors[field as keyof LoginFormValues] = errors[0];
    });

    return nextErrors;
  }, [validationResult]);

  const isFormComplete = useMemo(
    () => Boolean(normalizedValues.email && normalizedValues.password),
    [normalizedValues],
  );

  const isLockoutActive = lockoutSecondsLeft > 0;
  const isSubmitDisabled =
    isSubmitting ||
    isLockoutActive ||
    !isFormComplete ||
    !validationResult.success;

  useEffect(() => {
    let isMounted = true;

    const hydrateThrottleState = async () => {
      const storedState = await readStoredLoginThrottleState();
      const hasExpiredLockout =
        typeof storedState.lockoutEndsAt === 'number' &&
        storedState.lockoutEndsAt <= Date.now();

      const nextState = hasExpiredLockout
        ? { failedAttempts: 0, lockoutEndsAt: null }
        : storedState;

      if (hasExpiredLockout) {
        await writeStoredLoginThrottleState(nextState);
      }

      if (!isMounted) {
        return;
      }

      setFailedAttempts(nextState.failedAttempts);
      setLockoutEndsAt(nextState.lockoutEndsAt);
      setLockoutSecondsLeft(
        nextState.lockoutEndsAt
          ? Math.max(
              0,
              Math.ceil((nextState.lockoutEndsAt - Date.now()) / 1000),
            )
          : 0,
      );
    };

    void hydrateThrottleState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!lockoutEndsAt) {
      return undefined;
    }

    const updateRemainingTime = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((lockoutEndsAt - Date.now()) / 1000),
      );

      setLockoutSecondsLeft(remainingSeconds);

      if (remainingSeconds === 0) {
        setLockoutEndsAt(null);
        setFailedAttempts(0);
        void writeStoredLoginThrottleState({
          failedAttempts: 0,
          lockoutEndsAt: null,
        });
      }
    };

    updateRemainingTime();
    const intervalId = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(intervalId);
  }, [lockoutEndsAt]);

  const registerFailedAttempt = () => {
    setFailedAttempts((currentAttempts) => {
      const nextAttempts = currentAttempts + 1;
      if (nextAttempts < MAX_FAILED_ATTEMPTS) {
        void writeStoredLoginThrottleState({
          failedAttempts: nextAttempts,
          lockoutEndsAt: null,
        });
        return nextAttempts;
      }

      const nextLockoutEndsAt = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockoutEndsAt(nextLockoutEndsAt);
      setLockoutSecondsLeft(LOCKOUT_SECONDS);
      void writeStoredLoginThrottleState({
        failedAttempts: 0,
        lockoutEndsAt: nextLockoutEndsAt,
      });
      return 0;
    });
  };

  const clearThrottleState = () => {
    setFailedAttempts(0);
    setLockoutEndsAt(null);
    setLockoutSecondsLeft(0);
    void writeStoredLoginThrottleState({
      failedAttempts: 0,
      lockoutEndsAt: null,
    });
  };

  const handleSignIn = async () => {
    if (isSubmitting || isLockoutActive) {
      return;
    }

    setErrorMessage('');
    setInfoMessage('');

    if (!validationResult.success) {
      setTouchedFields({ email: true, password: true });
      setFocusedField(null);
      setErrorMessage(fieldErrors.email ?? fieldErrors.password ?? '');
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      if (error) {
        registerFailedAttempt();
        setErrorMessage(
          'Credenciales inválidas o acceso bloqueado temporalmente.',
        );
        return;
      }

      clearThrottleState();

      if (data.session) {
        router.replace((redirectTo ?? '/(tabs)/home') as Href);
        return;
      }

      setInfoMessage('Sesión creada. Continuá para ingresar.');
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error) ??
          'No se pudo iniciar sesión en este momento. Intentá nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const markFieldTouched = (field: keyof LoginFormValues) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  return {
    email,
    errorMessage,
    failedAttempts,
    fieldErrors,
    focusedField,
    handleSignIn,
    infoMessage,
    isLockoutActive,
    isPasswordVisible,
    isSubmitDisabled,
    isSubmitting,
    lockoutSecondsLeft,
    markFieldTouched,
    password,
    redirectTo,
    setEmail,
    setFocusedField,
    setIsPasswordVisible,
    setPassword,
    touchedFields,
  };
}

export const loginScreenLimits = {
  MAX_EMAIL_LENGTH,
  MAX_FAILED_ATTEMPTS,
  MAX_PASSWORD_LENGTH,
} as const;
