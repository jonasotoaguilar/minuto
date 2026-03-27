import { type Href, Link, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { PrimaryButton, Screen, ThemedText } from '@/theme/primitives';

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
    <Screen
      keyboardAvoiding
      scroll
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: theme.spacing['2xl'],
          paddingBottom: theme.spacing['3xl'],
        },
      ]}
    >
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View
            style={[
              styles.brandIcon,
              { backgroundColor: theme.colors.brand.primary },
            ]}
          >
            <ThemedText
              colorToken="inverse"
              style={[
                styles.brandLetter,
                {
                  fontSize: theme.typography.subtitle.fontSize,
                  fontWeight: theme.typography.subtitle.fontWeight,
                },
              ]}
            >
              M
            </ThemedText>
          </View>
          <ThemedText
            variant="title"
            style={[styles.brandText, { fontSize: 20 }]}
          >
            Minuto
          </ThemedText>
        </View>
        {/* <View style={styles.topLinks}>
          <ThemedText
            colorToken="secondary"
            variant="caption"
            style={[
              styles.topLink,
              { fontWeight: theme.typography.label.fontWeight },
            ]}
          >
            About
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            variant="caption"
            style={[
              styles.topLink,
              { fontWeight: theme.typography.label.fontWeight },
            ]}
          >
            Support
          </ThemedText>
        </View> */}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.background.card,
            shadowColor: theme.colors.shadow.color,
          },
        ]}
      >
        <View
          style={[
            styles.cardBanner,
            { backgroundColor: theme.colors.brand.primary },
          ]}
        >
          <View
            style={[
              styles.cardShield,
              { backgroundColor: theme.colors.brand.muted },
            ]}
          >
            <ThemedText
              colorToken="brand"
              style={[
                styles.cardShieldText,
                {
                  fontSize: theme.typography.body.fontSize,
                  fontWeight: theme.typography.label.fontWeight,
                },
              ]}
            >
              OK
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardBody}>
          <ThemedText variant="heading" style={styles.cardTitle}>
            Bienvenido a Minuto
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            style={[
              styles.cardSubtitle,
              { fontSize: theme.typography.bodySmall.fontSize },
            ]}
          >
            Ingresa a tu cuenta
          </ThemedText>

          <View style={styles.form}>
            <Field
              label="Email"
              placeholder="nombre@empresa.com"
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
            {/* TODO: Implementar recuperación de contraseña */}
            <View style={styles.passwordRow}>
              <ThemedText variant="label">Contraseña</ThemedText>
              <ThemedText
                colorToken="brand"
                variant="caption"
                style={[
                  styles.linkText,
                  { fontWeight: theme.typography.label.fontWeight },
                ]}
              >
                ¿Olvidaste la contraseña?
              </ThemedText>
            </View>
            <Field
              placeholder="********"
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
                  <ThemedText
                    colorToken="brand"
                    variant="caption"
                    style={[
                      styles.toggleText,
                      { fontWeight: theme.typography.label.fontWeight },
                    ]}
                  >
                    {isPasswordVisible ? 'Ocultar' : 'Ver'}
                  </ThemedText>
                </Pressable>
              }
            />
          </View>

          <PrimaryButton
            disabled={isSubmitDisabled}
            label={isSubmitting ? 'Ingresando...' : 'Iniciar Sesión →'}
            loading={isSubmitting}
            onPress={handleSignIn}
          />

          {errorMessage ? (
            <ThemedText
              colorToken="error"
              style={[
                styles.messageText,
                {
                  fontSize: theme.typography.caption.fontSize,
                  fontWeight: theme.typography.label.fontWeight,
                },
              ]}
            >
              {errorMessage}
            </ThemedText>
          ) : null}

          {infoMessage ? (
            <ThemedText
              colorToken="secondary"
              style={[
                styles.messageText,
                {
                  fontSize: theme.typography.caption.fontSize,
                  fontWeight: theme.typography.label.fontWeight,
                },
              ]}
            >
              {infoMessage}
            </ThemedText>
          ) : null}

          {/* <ThemedText
            colorToken="secondary"
            style={[
              styles.helpText,
              { fontSize: theme.typography.caption.fontSize },
            ]}
          >
            ¿Problemas para entrar?{' '}
            <ThemedText
              colorToken="brand"
              style={[
                styles.helpLink,
                {
                  fontSize: theme.typography.caption.fontSize,
                  fontWeight: theme.typography.label.fontWeight,
                },
              ]}
            >
              Estamos aquí para ayudarte
            </ThemedText>
          </ThemedText> */}

          <ThemedText
            colorToken="secondary"
            style={[
              styles.footerText,
              { fontSize: theme.typography.caption.fontSize },
            ]}
          >
            ¿Aún no tienes cuenta?{' '}
            <Link
              href="/register"
              style={{
                color: theme.colors.brand.primary,
                fontWeight: theme.typography.label.fontWeight,
              }}
            >
              Registrate en Minuto
            </Link>
          </ThemedText>

          {isLockoutActive ? (
            <ThemedText
              colorToken="error"
              style={[
                styles.messageText,
                {
                  fontSize: theme.typography.caption.fontSize,
                  fontWeight: theme.typography.label.fontWeight,
                },
              ]}
            >
              Demasiados intentos fallidos. Probá en {lockoutSecondsLeft}s.
            </ThemedText>
          ) : failedAttempts > 0 ? (
            <ThemedText
              colorToken="secondary"
              style={[
                styles.helpText,
                { fontSize: theme.typography.caption.fontSize },
              ]}
            >
              Intentos fallidos: {failedAttempts}/{MAX_FAILED_ATTEMPTS}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {/* <View style={styles.bottomLinks}>
        <ThemedText colorToken="secondary" variant="eyebrow">
          PRIVACIDAD
        </ThemedText>
        <ThemedText colorToken="secondary" variant="eyebrow">
          TÉRMINOS
        </ThemedText>
        <ThemedText colorToken="secondary" variant="eyebrow">
          COOKIES
        </ThemedText>
      </View> */}
    </Screen>
  );
}

type FieldProps = {
  label?: string;
  placeholder: string;
  icon: string;
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
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup}>
      {label ? <ThemedText variant="label">{label}</ThemedText> : null}
      <View
        style={[
          styles.field,
          {
            borderColor: error
              ? theme.colors.status.error
              : theme.colors.border.default,
          },
        ]}
      >
        <ThemedText
          colorToken="brand"
          style={[
            styles.fieldIcon,
            {
              fontSize: theme.typography.bodySmall.fontSize,
              fontWeight: theme.typography.label.fontWeight,
            },
          ]}
        >
          {icon}
        </ThemedText>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.muted}
          style={[
            styles.fieldInput,
            {
              color: theme.colors.text.primary,
              fontSize: theme.typography.bodySmall.fontSize,
            },
          ]}
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
        <ThemedText
          colorToken="error"
          variant="caption"
          style={[
            styles.fieldError,
            { fontWeight: theme.typography.label.fontWeight },
          ]}
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    // Using label typography for compact brand icon text
  },
  brandText: {
    // fontSize applied inline via theme.typography.title
  },
  topLinks: {
    flexDirection: 'row',
    gap: 8,
  },
  topLink: {
    // fontWeight applied inline via theme.typography.label
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
    // Using body typography with semibold weight
  },
  cardBody: {
    padding: 16,
    gap: 16,
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardSubtitle: {
    // fontSize applied inline via theme.typography.bodySmall
    textAlign: 'center',
  },
  form: {
    gap: 8,
  },
  fieldGroup: {
    gap: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  fieldIcon: {
    // Typography applied inline via theme.typography.label
  },
  fieldInput: {
    flex: 1,
    // fontSize applied inline via theme.typography.bodySmall
    paddingVertical: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    // fontWeight applied inline via theme.typography.label
  },
  toggleText: {
    // fontWeight applied inline via theme.typography.label (bold)
  },
  fieldError: {
    // fontWeight applied inline via theme.typography.label
  },
  messageText: {
    // Typography applied inline via theme.typography.caption with semibold
    textAlign: 'center',
  },
  helpText: {
    // fontSize applied inline via theme.typography.caption
    textAlign: 'center',
  },
  helpLink: {
    // fontWeight applied inline via theme.typography.label
  },
  footerText: {
    // fontSize applied inline via theme.typography.caption
    textAlign: 'center',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
});
