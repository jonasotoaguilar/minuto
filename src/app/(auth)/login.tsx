import { type Href, Link, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const MAX_EMAIL_LENGTH = 120;
const MAX_PASSWORD_LENGTH = 72;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

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

type LoginFormValues = z.infer<typeof loginSchema>;
type LoginFieldErrors = Partial<Record<keyof LoginFormValues, string>>;
type TouchedFields = Partial<Record<keyof LoginFormValues, boolean>>;

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutEndsAt, setLockoutEndsAt] = useState<number | null>(null);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});
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
        return nextAttempts;
      }

      setLockoutEndsAt(Date.now() + LOCKOUT_SECONDS * 1000);
      setLockoutSecondsLeft(LOCKOUT_SECONDS);
      return 0;
    });
  };

  const handleSignIn = async () => {
    if (isSubmitting || isLockoutActive) return;
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

      setFailedAttempts(0);

      if (data.session) {
        const redirectTo = '/(tabs)/home' as Href;
        router.replace(redirectTo);
        return;
      }

      setInfoMessage('Sesión creada. Continuá para ingresar.');
    } catch {
      setErrorMessage(
        'No se pudo iniciar sesión en este momento. Intentá nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        style={[styles.page, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.five,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View
              style={[styles.brandIcon, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.brandLetter}>M</Text>
            </View>
            <Text style={[styles.brandText, { color: theme.text }]}>
              Minuto
            </Text>
          </View>
          <View style={styles.topLinks}>
            <Text style={[styles.topLink, { color: theme.textSecondary }]}>
              About
            </Text>
            <Text style={[styles.topLink, { color: theme.textSecondary }]}>
              Support
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={[styles.cardBanner, { backgroundColor: theme.primary }]}>
            <View
              style={[
                styles.cardShield,
                { backgroundColor: theme.primaryMuted },
              ]}
            >
              <Text style={[styles.cardShieldText, { color: theme.primary }]}>
                OK
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Bienvenido a Minuto
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              Ingresa a tu cuenta
            </Text>

            <View style={styles.form}>
              <Field
                label="Email"
                placeholder="nombre@empresa.com"
                theme={theme}
                icon="@"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={MAX_EMAIL_LENGTH}
                onFocus={() => setFocusedField('email')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouchedFields((current) => ({ ...current, email: true }));
                }}
                error={
                  touchedFields.email && focusedField !== 'email'
                    ? fieldErrors.email
                    : undefined
                }
              />
              <View style={styles.passwordRow}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  Contraseña
                </Text>
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  ¿Olvidaste la contraseña?
                </Text>
              </View>
              <Field
                placeholder="********"
                theme={theme}
                icon="*"
                secure={!isPasswordVisible}
                value={password}
                onChangeText={setPassword}
                autoCorrect={false}
                maxLength={MAX_PASSWORD_LENGTH}
                onFocus={() => setFocusedField('password')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouchedFields((current) => ({
                    ...current,
                    password: true,
                  }));
                }}
                error={
                  touchedFields.password && focusedField !== 'password'
                    ? fieldErrors.password
                    : undefined
                }
                rightElement={
                  <Pressable
                    onPress={() => setIsPasswordVisible((current) => !current)}
                    hitSlop={8}
                  >
                    <Text style={[styles.toggleText, { color: theme.primary }]}>
                      {isPasswordVisible ? 'Ocultar' : 'Ver'}
                    </Text>
                  </Pressable>
                }
              />
            </View>

            <Pressable
              onPress={handleSignIn}
              disabled={isSubmitDisabled}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.primary,
                  opacity: isSubmitDisabled ? 0.6 : 1,
                },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Ingresando...' : 'Iniciar Sesión →'}
              </Text>
            </Pressable>

            {errorMessage ? (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errorMessage}
              </Text>
            ) : null}

            {infoMessage ? (
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {infoMessage}
              </Text>
            ) : null}

            <Text style={[styles.helpText, { color: theme.textSecondary }]}>
              ¿Problemas para entrar?{' '}
              <Text style={[styles.helpLink, { color: theme.primary }]}>
                Estamos aquí para ayudarte
              </Text>
            </Text>

            {isLockoutActive ? (
              <Text style={[styles.errorText, { color: theme.error }]}>
                Demasiados intentos fallidos. Probá en {lockoutSecondsLeft}s.
              </Text>
            ) : failedAttempts > 0 ? (
              <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                Intentos fallidos: {failedAttempts}/{MAX_FAILED_ATTEMPTS}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          ¿Aún no tienes cuenta?{' '}
          <Link
            href="/register"
            style={{ color: theme.primary, fontWeight: '600' }}
          >
            Contrata Minuto para tu negocio
          </Link>
        </Text>

        <View style={styles.bottomLinks}>
          <Text style={[styles.bottomLink, { color: theme.textSecondary }]}>
            PRIVACIDAD
          </Text>
          <Text style={[styles.bottomLink, { color: theme.textSecondary }]}>
            TÉRMINOS
          </Text>
          <Text style={[styles.bottomLink, { color: theme.textSecondary }]}>
            COOKIES
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label?: string;
  placeholder: string;
  icon: string;
  theme: ReturnType<typeof useTheme>;
  secure?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  error?: string;
  rightElement?: ReactNode;
  onBlur?: () => void;
  onFocus?: () => void;
};

function Field({
  label,
  placeholder,
  icon,
  theme,
  secure,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  error,
  rightElement,
  onBlur,
  onFocus,
}: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.field,
          { borderColor: error ? theme.error : theme.border },
        ]}
      >
        <Text style={[styles.fieldIcon, { color: theme.primary }]}>{icon}</Text>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.fieldInput, { color: theme.text }]}
          secureTextEntry={secure}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          onBlur={onBlur}
          onFocus={onFocus}
        />
        {rightElement}
      </View>
      {error ? (
        <Text style={[styles.fieldError, { color: theme.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: Fonts.serif,
  },
  topLinks: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  topLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardBanner: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShield: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShieldText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.two,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  fieldIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.one,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    paddingVertical: Spacing.two,
    borderRadius: 999,
    alignItems: 'center',
  },
  fieldError: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
  },
  helpLink: {
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  bottomLink: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
